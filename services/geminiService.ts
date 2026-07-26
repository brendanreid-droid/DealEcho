import { getFunctions, httpsCallable } from "firebase/functions";
import { Company, AIModerationResult } from "../types";
import { companyLogoUrl, guessDomainFromName } from "../src/utils/companyLogo";

/** @deprecated Moderation runs server-side in Cloud Functions. Always returns false. */
export const isGeminiAvailable = (): boolean => false;

// Helper functions for sessionStorage caching with fallback
const getSessionCache = <T>(key: string): T | null => {
  try {
    const val = sessionStorage.getItem(key);
    return val ? JSON.parse(val) : null;
  } catch (e) {
    return null;
  }
};

const setSessionCache = <T>(key: string, data: T): void => {
  try {
    sessionStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    // Fail silently if quota exceeded or sessionStorage is blocked
  }
};

export const searchCompanies = async (query: string): Promise<Company[]> => {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return [];

  const cacheKey = `dealecho_search_cache:${normalizedQuery}`;
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
