import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";
import { GoogleGenAI } from "@google/genai";
import { resolveCompany, ResolverDeps } from "./resolver";
import { logoDomain } from "./domains";
import { CompanyRef } from "./matching";
import { isProRole } from "./gating";
import { getDealMechanics } from "../dealMechanics";
import { getStructuredFlags, groupFlags, redactFlag } from "../structuredFlags";
import {
  AccountFlag,
  CorpusEntry,
  corpusFingerprint,
  validateAiFlags,
  isApproved,
  MAX_CORPUS_REVIEWS,
} from "../accountFlags";

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();
const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");

/**
 * Free-text flags from the shared cache that getAccountFlags fills, or none.
 *
 * Read-only on purpose. Generating here would put a Gemini call in front of
 * every panel lookup, and would race the profile page for the same cache slot.
 * The fingerprint check is the same one the callable uses: a corpus that has
 * changed since the flags were generated invalidates them, so the panel never
 * cites a review that has since been edited or removed.
 */
async function readCachedAiFlags(companyId: string, reviews: any[]): Promise<AccountFlag[]> {
  const corpus: CorpusEntry[] = reviews
    .filter(
      (d) => isApproved(d) && typeof d.content === "string" && d.content.trim().length > 0,
    )
    .slice(0, MAX_CORPUS_REVIEWS)
    .map((d) => ({ id: d.id, content: String(d.content).trim() }));
  if (corpus.length === 0) return [];

  try {
    const snap = await db.doc(`account_flags/${companyId}`).get();
    const cached = snap.exists ? snap.data() : null;
    if (!cached || cached["fingerprint"] !== corpusFingerprint(corpus)) return [];
    return validateAiFlags(cached["flags"], corpus.map((c) => c.id));
  } catch (err) {
    console.error(`AI flag cache read failed for ${companyId}:`, err);
    return [];
  }
}

export const lookupCompanyReviews = onCall(
  { cors: true, secrets: [GEMINI_API_KEY] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Sign in to use Dealecho.");
    }
    const domain = typeof request.data?.domain === "string" ? request.data.domain : undefined;
    const name = typeof request.data?.name === "string" ? request.data.name : undefined;
    if (!domain && !name) {
      throw new HttpsError("invalid-argument", "A domain or name is required.");
    }
    if ((domain && domain.length > 500) || (name && name.length > 500)) {
      throw new HttpsError("invalid-argument", "Query too long.");
    }

    const apiKey = GEMINI_API_KEY.value();
    const ai = apiKey && !apiKey.includes("PLACEHOLDER") ? new GoogleGenAI({ apiKey }) : null;

    // ── Build real resolver deps ────────────────────────────────────────────
    const deps: ResolverDeps = {
      async lookupDomainCache(d) {
        const snap = await db.doc(`company_domains/${d}`).get();
        return snap.exists ? (snap.data() as CompanyRef) : null;
      },
      async saveDomainCache(d, ref) {
        await db.doc(`company_domains/${d}`).set(
          { ...ref, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
          { merge: true },
        );
      },
      async dropDomainCache(d) {
        // Best-effort: a failed eviction must not fail the lookup. The resolver
        // has already stopped trusting this entry for the current request.
        await db.doc(`company_domains/${d}`).delete().catch(() => {});
      },
      async listCompanyNames() {
        // Distinct {companyId, companyName} from public review_summaries.
        const snap = await db.collection("review_summaries").get();
        const seen = new Map<string, CompanyRef>();
        snap.forEach((doc) => {
          const d = doc.data();
          if (d["companyId"] && d["companyName"] && !seen.has(d["companyId"])) {
            seen.set(d["companyId"], { companyId: d["companyId"], companyName: d["companyName"] });
          }
        });
        return [...seen.values()];
      },
      async canonicalizeViaAI(query) {
        if (!ai) return null;
        try {
          const resp = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `What company is at or named "${query}"? Respond ONLY with minified JSON {"name": string, "domain": string}.`,
            config: { tools: [{ googleSearch: {} }] },
          });
          const text = (resp.text ?? "").replace(/```json|```/g, "").trim();
          const parsed = JSON.parse(text || "{}");
          return parsed?.name ? { name: parsed.name, domain: parsed.domain } : null;
        } catch {
          return null;
        }
      },
    };

    const company = await resolveCompany({ domain, name }, deps);
    const isPro = isProRole(request.auth.token.role as string | undefined);
    if (!company) return { matched: false, isPro };

    // ── Aggregate from review_summaries for this company ────────────────────
    const sumSnap = await db
      .collection("review_summaries")
      .where("companyId", "==", company.companyId)
      .get();
    const sums = sumSnap.docs.map((d) => d.data());
    const reviewCount = sums.length;
    // Defence in depth behind the resolver's cache validation. Every company the
    // resolver knows about is derived from review_summaries, so zero summaries
    // means the match is not real - and "matched" with nothing behind it renders
    // a card of zeros linking to a company page that does not exist. Prefer the
    // honest "no reviews yet" state and its CTA.
    if (reviewCount === 0) return { matched: false, isPro };
    const avg = (key: string) =>
      reviewCount ? sums.reduce((a, s) => a + ((s[key] as number) || 0), 0) / reviewCount : 0;
    const ratingKeys = ["communicationRating", "negotiationLevel", "timeWasterLevel", "clarityOfScope"];
    const rating = reviewCount
      ? ratingKeys.reduce((a, k) => a + avg(k), 0) / ratingKeys.length
      : 0;
    const summary = {
      companyId: company.companyId,
      companyName: company.companyName,
      reviewCount,
      rating: Number(rating.toFixed(2)),
      healthIndex: Number((rating * 20).toFixed(0)), // ratings are 1–5 → 20–100 scale
      // Per-element aggregate averages (each 1–5, high = good) for the extension's micro-bars.
      metrics: {
        communicationRating: Number(avg("communicationRating").toFixed(2)),
        negotiationLevel: Number(avg("negotiationLevel").toFixed(2)),
        timeWasterLevel: Number(avg("timeWasterLevel").toFixed(2)),
        clarityOfScope: Number(avg("clarityOfScope").toFixed(2)),
      },
    };

    // ── Flags + recent reviews ──────────────────────────────────────────────
    // One read of the review set serves both. Every caller needs it: the
    // mechanics run over the whole corpus, and free callers need the flag COUNT
    // to make the upgrade CTA honest even though they cannot see the detail.
    //
    // Degrade gracefully throughout: a Firestore or mechanics failure should
    // cost the flags, not the whole lookup — the rep still gets the summary.
    let risks: AccountFlag[] = [];
    let strengths: AccountFlag[] = [];
    let recentReviews: any[] | undefined;
    let storedDomain: string | null = null;

    try {
      const revSnap = await db
        .collection("reviews")
        .where("companyId", "==", company.companyId)
        .get();
      const reviews = revSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];
      // The company's OWN domain, recorded on the review at submit time. Safe
      // where the page domain is not: a name-path match came off a CRM or a
      // news site, so logoDomain rightly refuses it, but this is the company's.
      storedDomain = reviews.find((r) => typeof r.domain === "string" && r.domain)?.domain ?? null;

      if (isPro) {
        recentReviews = [...reviews]
          .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
          .slice(0, 3);
      }

      const mechanics = getDealMechanics(reviews);
      const structured = mechanics ? getStructuredFlags(mechanics) : [];

      // Read-only on the AI cache: generation belongs to getAccountFlags, and a
      // panel lookup must not sit behind a Gemini call. A company nobody has
      // opened on the site yet shows structured flags alone, which is the
      // deterministic majority of the bank.
      const aiFlags = await readCachedAiFlags(company.companyId, reviews);

      ({ risks, strengths } = groupFlags(structured, aiFlags));
    } catch (err) {
      console.error(`Flag assembly failed for ${company.companyId}:`, err);
    }

    return {
      matched: true,
      isPro,
      companyId: company.companyId,
      companyName: company.companyName,
      matchedDomain: logoDomain(domain, name) ?? storedDomain,
      summary,
      // Free callers get labels and polarity only. Stripped server-side rather
      // than hidden client-side: `stat` and `reviewIds` are the paid product,
      // and shipping them to a free client puts them one devtools tab away.
      risks: isPro ? risks : risks.map(redactFlag),
      strengths: isPro ? strengths : strengths.map(redactFlag),
      recentReviews,
    };
  },
);
