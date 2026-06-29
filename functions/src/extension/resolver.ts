import { registrableDomain, isCrmHost } from "./domains";
import { bestNameMatch, CompanyRef } from "./matching";

export interface ResolverInput {
  domain?: string;
  name?: string;
}

export interface ResolverDeps {
  lookupDomainCache(domain: string): Promise<CompanyRef | null>;
  saveDomainCache(domain: string, ref: CompanyRef): Promise<void>;
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

  if (usableDomain) {
    const cached = await deps.lookupDomainCache(usableDomain);
    if (cached) return cached;
  }

  if (input.domain) {
    const names = await deps.listCompanyNames();
    const ai = await deps.canonicalizeViaAI(input.domain);
    if (ai?.name) {
      const match = bestNameMatch(ai.name, names);
      if (match) {
        if (usableDomain) await deps.saveDomainCache(usableDomain, match);
        return match;
      }
    }
  }

  return null;
}
