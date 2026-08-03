import { getFunctions, httpsCallable } from "firebase/functions";
import { Company, AIModerationResult } from "../types";
import { companyLogoUrl, guessDomainFromName } from "../src/utils/companyLogo";

/** @deprecated Moderation runs server-side in Cloud Functions. Always returns false. */
export const isGeminiAvailable = (): boolean => false;

/**
 * Cache key version. **Bump this in the same commit whenever the shape of a
 * cached result changes, or the way any field on it is derived changes.**
 *
 * sessionStorage survives a reload, so without a version bump a tab that was
 * open before a deploy keeps serving results built by the old code and the fix
 * never reaches it. That is not hypothetical: the company-logo alias fix looked
 * dead in production for exactly this reason, because the cached entry still
 * held the logoUrl the old build had derived.
 *
 * v2: results carry a logoUrl derived through companyLogo's domain aliases.
 */
const SEARCH_CACHE_VERSION = "v2";

export const SEARCH_CACHE_PREFIX = `dealecho_search_cache:${SEARCH_CACHE_VERSION}:`;

/**
 * How long a cached search stays good. A version bump only helps when we
 * deploy; this covers the rest - a tab left open all day would otherwise keep
 * showing the morning's answer, including "No Reviews" for an account that has
 * since been reviewed.
 */
export const SEARCH_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

interface CacheEnvelope<T> {
  at: number;
  data: T;
}

// Helper functions for sessionStorage caching with fallback
const getSessionCache = <T>(key: string): T | null => {
  try {
    const val = sessionStorage.getItem(key);
    if (!val) return null;
    const parsed = JSON.parse(val) as CacheEnvelope<T>;
    // Anything without a timestamp predates the envelope, or is junk. Either
    // way we cannot judge its age, so we do not trust it.
    if (!parsed || typeof parsed.at !== "number") {
      sessionStorage.removeItem(key);
      return null;
    }
    if (Date.now() - parsed.at > SEARCH_CACHE_TTL_MS) {
      sessionStorage.removeItem(key);
      return null;
    }
    return parsed.data;
  } catch (e) {
    return null;
  }
};

const setSessionCache = <T>(key: string, data: T): void => {
  try {
    const envelope: CacheEnvelope<T> = { at: Date.now(), data };
    sessionStorage.setItem(key, JSON.stringify(envelope));
  } catch (e) {
    // Fail silently if quota exceeded or sessionStorage is blocked
  }
};

export const searchCompanies = async (query: string): Promise<Company[]> => {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return [];

  const cacheKey = `${SEARCH_CACHE_PREFIX}${normalizedQuery}`;
  const cached = getSessionCache<Company[]>(cacheKey);
  if (cached) {
    console.info(`[GeminiService] Search cache hit for: "${normalizedQuery}"`);
    return cached;
  }

  try {
    const functions = getFunctions(undefined, "australia-southeast1");
    const searchFn = httpsCallable<{ query: string }, { results: any[] }>(
      functions,
      "searchCompanyEntities"
    );
    const result = await searchFn({ query });
    const rawResults = result.data.results || [];

    const formattedResults = rawResults.map((r: any, index: number) => ({
      ...r,
      id: `ai-${index}-${Date.now()}`,
      logoUrl: r.logoUrl || companyLogoUrl({ name: r.name, domain: r.domain || guessDomainFromName(r.name) }),
    }));

    setSessionCache(cacheKey, formattedResults);
    return formattedResults;
  } catch (error) {
    console.error("Search error via Cloud Function:", error);
    return [];
  }
};

/**
 * @deprecated Client-side moderation removed — the Cloud Function onReviewWritten
 * is the authoritative moderation layer. Reviews are held as 'pending' until approved.
 */
export const moderateReview = async (
  _content: string,
): Promise<AIModerationResult> => {
  return { isSafe: true };
};
