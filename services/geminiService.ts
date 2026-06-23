import { getFunctions, httpsCallable } from "firebase/functions";
import { Company, AIModerationResult, Review } from "../types";
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
      logoUrl: companyLogoUrl({ name: r.name, domain: r.domain || guessDomainFromName(r.name) }),
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

export interface TeamPlaybook {
  teamName: string;
  tactic: string;
}

export interface CompanyPersona {
  summary: string;
  keyTraits: string[];
  strategicAdvice: string;
  teamPlaybooks: TeamPlaybook[];
  meddpicc: {
    metrics: string;
    economicBuyer: string;
    decisionCriteria: string;
    decisionProcess: string;
    paperProcess: string;
    identifyPain: string;
    champion: string;
    competition: string;
  };
}

export const getAICompanyPersona = async (
  companyName: string,
  reviews: Review[],
): Promise<CompanyPersona> => {
  const fallback: CompanyPersona = {
    summary:
      "AI persona generation is currently unavailable. Review the community reports below for buyer intelligence.",
    keyTraits: [],
    strategicAdvice: "Monitor recent reviews for emerging patterns.",
    teamPlaybooks: [],
    meddpicc: {
      metrics: "Unknown",
      economicBuyer: "Unknown",
      decisionCriteria: "Unknown",
      decisionProcess: "Unknown",
      paperProcess: "Unknown",
      identifyPain: "Unknown",
      champion: "Unknown",
      competition: "Unknown",
    },
  };

  const reviewsSignature = reviews
    .map((r) => `${r.id}_${r.createdAt}`)
    .sort()
    .join("|");
  const normalizedCompany = companyName.trim().toLowerCase();
  const cacheKey = `dealecho_persona_cache:${normalizedCompany}:${reviewsSignature}`;

  const cached = getSessionCache<CompanyPersona>(cacheKey);
  if (cached) {
    console.info(`[GeminiService] Persona cache hit for company: "${normalizedCompany}"`);
    return cached;
  }

  try {
    const functions = getFunctions(undefined, "australia-southeast1");
    const personaFn = httpsCallable<
      { companyName: string; reviews: any[] },
      { persona: CompanyPersona }
    >(functions, "getAICompanyPersona");
    const result = await personaFn({ companyName, reviews });
    const persona = result.data.persona;

    if (persona) {
      setSessionCache(cacheKey, persona);
      return persona;
    }
    return fallback;
  } catch (error) {
    console.error("Persona generation error via Cloud Function:", error);
    return fallback;
  }
};
