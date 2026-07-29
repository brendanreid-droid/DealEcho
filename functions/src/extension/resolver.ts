import { registrableDomain, isCrmHost } from "./domains";
import { bestNameMatch, CompanyRef } from "./matching";

export interface ResolverInput {
  domain?: string;
  name?: string;
}

export interface ResolverDeps {
  lookupDomainCache(domain: string): Promise<CompanyRef | null>;
  saveDomainCache(domain: string, ref: CompanyRef): Promise<void>;
  dropDomainCache(domain: string): Promise<void>;
  listCompanyNames(): Promise<CompanyRef[]>;
  canonicalizeViaAI(query: string): Promise<{ name: string; domain?: string } | null>;
}

/**
 * Resolve a website domain and/or company name to a known company.
 *
 * A highlighted/typed NAME is explicit intent and always wins: we match by name
 * (then AI-canonicalize) and never read or write the domain cache — because the
 * page the name was highlighted on (dealecho.io, a CRM, a news site) is usually
 * NOT that company's own domain, so caching domain→company there is wrong.
 *
 * With NO name, we treat the page as the prospect's own site: domain-cache →
 * AI-canonicalize the domain → re-match, caching the domain→company mapping.
 */
export async function resolveCompany(
  input: ResolverInput,
  deps: ResolverDeps,
): Promise<CompanyRef | null> {
  const name = input.name?.trim() || "";

  // ── Name provided: name-first, no domain cache involvement ──────────────────
  if (name) {
    const names = await deps.listCompanyNames();
    const direct = bestNameMatch(name, names);
    if (direct) return direct;
    const ai = await deps.canonicalizeViaAI(name);
    if (ai?.name) return bestNameMatch(ai.name, names);
    return null;
  }

  // ── No name: domain-based resolution for a prospect's own site ──────────────
  const usableDomain =
    input.domain && !isCrmHost(input.domain) ? registrableDomain(input.domain) : "";

  if (input.domain) {
    // Loaded at most once per call, whether the cache validation or the AI
    // fallback needs it.
    let names: CompanyRef[] | null = null;
    const loadNames = async (): Promise<CompanyRef[]> => (names ??= await deps.listCompanyNames());

    if (usableDomain) {
      const cached = await deps.lookupDomainCache(usableDomain);
      if (cached) {
        // A cache hit is a hint, not an answer. companyIds are regenerated when a
        // company's reviews are recreated, so a mapping cached weeks ago can point
        // at an id nothing references any more - which resolves "successfully" and
        // then renders a card of zeros over a dead /company/<id> link.
        //
        // Return the LIVE ref rather than the cached one: the stored companyName
        // goes stale too (casing, renames).
        const live = (await loadNames()).find((n) => n.companyId === cached.companyId);
        if (live) return live;
        await deps.dropDomainCache(usableDomain);
      }
    }

    const ai = await deps.canonicalizeViaAI(input.domain);
    if (ai?.name) {
      const match = bestNameMatch(ai.name, await loadNames());
      if (match) {
        if (usableDomain) await deps.saveDomainCache(usableDomain, match);
        return match;
      }
    }
  }

  return null;
}
