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
 * Order: domain-cache → name match → AI canonicalize → re-match. Returns null on miss.
 */
export async function resolveCompany(
  input: ResolverInput,
  deps: ResolverDeps,
): Promise<CompanyRef | null> {
  const usableDomain =
    input.domain && !isCrmHost(input.domain) ? registrableDomain(input.domain) : "";

  // 1. Domain cache (cheap, exact).
  if (usableDomain) {
    const cached = await deps.lookupDomainCache(usableDomain);
    if (cached) return cached;
  }

  // 2. Direct name match against known companies (only when an explicit name is provided).
  const names = await deps.listCompanyNames();
  const query = input.name?.trim() || "";
  if (query) {
    const match = bestNameMatch(query, names);
    if (match) {
      if (usableDomain) await deps.saveDomainCache(usableDomain, match);
      return match;
    }
  }

  // 3. AI fallback: canonicalize the raw query, then re-match.
  const aiQuery = input.name?.trim() || input.domain || "";
  if (aiQuery) {
    const ai = await deps.canonicalizeViaAI(aiQuery);
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
