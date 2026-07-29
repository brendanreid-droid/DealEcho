import { db } from "../lib/firebaseAdmin";
import { normalizeDomain } from "../lib/reviewSchema";
import { matchByDomainLabel, domainLabel, CompanyRef } from "../extension/matching";

/**
 * Backfills `domain` on reviews written before submission started storing it.
 *
 * Without a stored domain every consumer falls back to guessing one from the
 * company name, and that guess deliberately gives up on any multi-word name -
 * so "Crown Resorts", "Australia Post" and "Harris Farm Markets" could never
 * render a logo however the UI was written.
 *
 * Sources, in order of trust. It NEVER invents a domain: a company it cannot
 * resolve is reported and left alone, because a wrong logo on a review is worse
 * than the initials avatar it already has.
 *
 *   1. OVERRIDES below - hand-verified, highest trust.
 *   2. The `company_domains` cache, matched by NAME rather than companyId.
 *      Matching by id would miss almost everything: ids are regenerated when a
 *      company's reviews are recreated, which is what left every cached entry
 *      pointing at a dead id in the first place.
 *
 * Dry run by default. Pass --apply to write.
 *
 *   npx tsx src/maintenance/backfillReviewDomains.ts
 *   npx tsx src/maintenance/backfillReviewDomains.ts --apply
 *
 * Writes `domain` to the review AND to its public summary.
 *
 * The onReviewWritten trigger does mirror the field, but only once the
 * toSummary change is deployed - and a review touched before that lands gets a
 * summary without a domain and no reason to ever be rewritten. Writing both
 * directly makes the script correct regardless of deploy order, and idempotent
 * enough to re-run.
 */

/**
 * Hand-verified company name → domain. Extend as needed.
 *
 * Verify before adding - every entry here becomes a logo on a real review, and
 * these are looked up rather than recalled for exactly that reason. The two
 * marked below were judgement calls rather than single unambiguous answers.
 */
const OVERRIDES: Record<string, string> = {
  "australia post": "auspost.com.au",
  "harris farm markets": "harrisfarm.com.au",
  "genesis energy limited": "genesisenergy.co.nz",
  victra: "victra.com",
  // Busy Bees trades globally as busybeesglobal.com; busybees.edu.au is the
  // Australian early-learning arm, which is what the other accounts suggest.
  "busy bees": "busybees.edu.au",
  // atlantis.com is the Atlantis Resorts group (Dubai/Sanya). The Bahamas
  // property sits on atlantisbahamas.com - switch if the review meant that one.
  "atlantis resorts": "atlantis.com",
};

const APPLY = process.argv.includes("--apply");

const norm = (s: string): string => s.trim().toLowerCase();

async function backfill(): Promise<void> {
  console.log(APPLY ? "Applying domain backfill..." : "DRY RUN - pass --apply to write.\n");

  const [reviewsSnap, domainsSnap] = await Promise.all([
    db.collection("reviews").get(),
    db.collection("company_domains").get(),
  ]);

  // Every cached domain, as a candidate keyed by its own label, so the same
  // matcher the resolver uses can decide whether it belongs to a company.
  const cachedDomains = domainsSnap.docs.map((d) => d.id);

  // Summaries share their parent review's document id.
  const summariesSnap = await db.collection("review_summaries").get();
  const summaryHasDomain = new Map(
    summariesSnap.docs.map((d) => [d.id, !!normalizeDomain(d.data()["domain"])]),
  );

  // A review needs work if IT lacks a domain, or if its summary does - the
  // second case is how a review backfilled before the trigger shipped looks.
  const missing = reviewsSnap.docs.filter(
    (d) => !normalizeDomain(d.data()["domain"]) || summaryHasDomain.get(d.id) === false,
  );
  if (missing.length === 0) {
    console.log("Every review and summary already has a domain. Nothing to do.");
    return;
  }

  // Already-correct reviews still need their summary filled, so carry their
  // stored domain through rather than re-resolving it.
  const existingDomain = new Map(
    reviewsSnap.docs.map((d) => [d.id, normalizeDomain(d.data()["domain"])]),
  );

  // One decision per company, applied to all of its reviews.
  const byCompany = new Map<string, { name: string; ids: string[] }>();
  for (const doc of missing) {
    const data = doc.data();
    const companyId = String(data["companyId"] ?? "");
    const name = String(data["companyName"] ?? "").trim();
    if (!companyId || !name) continue;
    const entry = byCompany.get(companyId) ?? { name, ids: [] };
    entry.ids.push(doc.id);
    byCompany.set(companyId, entry);
  }

  const resolved = new Map<string, { domain: string; via: string }>();
  const unresolved: string[] = [];

  for (const [companyId, { name, ids }] of byCompany) {
    const alreadyStored = ids.map((id) => existingDomain.get(id) ?? "").find(Boolean);
    if (alreadyStored) {
      resolved.set(companyId, { domain: alreadyStored, via: "already on the review" });
      continue;
    }

    const override = OVERRIDES[norm(name)];
    if (override) {
      const d = normalizeDomain(override);
      if (d) {
        resolved.set(companyId, { domain: d, via: "override" });
        continue;
      }
      console.warn(`  Override for "${name}" is not a valid domain and was ignored.`);
    }

    // Ask the matcher, per cached domain, whether that domain's label resolves
    // to THIS company - the same despaced comparison the resolver relies on.
    const self: CompanyRef[] = [{ companyId, companyName: name }];
    const hit = cachedDomains.find((d) => matchByDomainLabel(domainLabel(d), self));
    const viaCache = hit ? normalizeDomain(hit) : "";
    if (viaCache) {
      resolved.set(companyId, { domain: viaCache, via: "company_domains" });
      continue;
    }

    unresolved.push(name);
  }

  console.log(`Reviews missing a domain: ${missing.length}, across ${byCompany.size} companies.\n`);
  for (const [companyId, { domain, via }] of resolved) {
    const { name, ids } = byCompany.get(companyId)!;
    console.log(`  ${name} -> ${domain}  (${via}, ${ids.length} review${ids.length === 1 ? "" : "s"})`);
  }
  if (unresolved.length > 0) {
    console.log(`\n  Unresolved, left untouched: ${unresolved.join(", ")}`);
    console.log("  Add them to OVERRIDES once verified, then re-run.");
  }

  if (!APPLY) {
    console.log("\nDry run complete. Nothing written.");
    return;
  }

  let written = 0;
  for (const [companyId, { domain }] of resolved) {
    const { ids } = byCompany.get(companyId)!;
    // Chunked: a batch is capped at 500 writes.
    for (let i = 0; i < ids.length; i += 400) {
      const batch = db.batch();
      for (const id of ids.slice(i, i + 400)) {
        batch.set(db.collection("reviews").doc(id), { domain }, { merge: true });
        // Only touch a summary that exists: creating one here would publish a
        // review that moderation has not approved.
        if (summaryHasDomain.has(id)) {
          batch.set(db.collection("review_summaries").doc(id), { domain }, { merge: true });
        }
      }
      await batch.commit();
      written += Math.min(400, ids.length - i);
    }
  }
  console.log(`\nWrote domain to ${written} reviews.`);
}

backfill()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Backfill failed:", err);
    process.exit(1);
  });
