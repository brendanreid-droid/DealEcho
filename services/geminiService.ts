import { GoogleGenAI, Type } from "@google/genai";
import { Company, AIModerationResult, Review } from "../types";

/** Returns true if a real Gemini API key is configured */
export const isGeminiAvailable = (): boolean => {
  const key = process.env.API_KEY;
  return !!key && key.length > 20 && !key.toLowerCase().includes("placeholder");
};

export const searchCompanies = async (query: string): Promise<Company[]> => {
  if (!isGeminiAvailable()) {
    console.warn("[GeminiService] No valid API key — AI search disabled.");
    return [];
  }
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Search for companies matching: "${query}". Return a JSON array of objects with: name, industry, country, and a brief description. Use real data from your knowledge or search.`,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              industry: { type: Type.STRING },
              country: { type: Type.STRING },
              description: { type: Type.STRING },
            },
            required: ["name", "industry", "country"],
          },
        },
      },
    });

    const results = JSON.parse(response.text || "[]");
    return results.map((r: any, index: number) => ({
      ...r,
      id: `ai-${index}-${Date.now()}`,
      logoUrl: `https://logo.clearbit.com/${r.name.toLowerCase().replace(/\s/g, "")}.com`,
    }));
  } catch (error) {
    console.error("Search error:", error);
    return [];
  }
};

export const moderateReview = async (
  content: string,
): Promise<AIModerationResult> => {
  if (!isGeminiAvailable()) {
    console.warn("[GeminiService] No valid API key — skipping AI moderation.");
    return { isSafe: true };
  }
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Analyse this B2B sales review for sensitive information. 
      Flag any:
      - Personal names of individuals (PII)
      - Specific confidential pricing details that are commercially sensitive
      - Trade secrets mentioned
      
      Review Content: "${content}"`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isSafe: { type: Type.BOOLEAN },
            reason: { type: Type.STRING },
            flaggedSegments: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
          required: ["isSafe"],
        },
      },
    });

    return JSON.parse(response.text || '{"isSafe": true}');
  } catch (error) {
    console.error("Moderation error:", error);
    return { isSafe: true };
  }
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

  if (!isGeminiAvailable()) {
    console.warn(
      "[GeminiService] No valid API key — skipping AI persona generation.",
    );
    return fallback;
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const reviewsSummary = reviews
    .map(
      (r) =>
        `Team: ${r.buyingTeam.join(", ")}, Status: ${r.status}, TCV: ${r.tcvBracket}, Content: ${r.content}`,
    )
    .join("\n\n");

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `Based on these B2B sales reviews for "${companyName}", generate a structured "Buyer Persona Summary".
      
      Requirements:
      1. MEDDPICC Blueprint: High-level strategic advice for each pillar.
      2. Departmental Playbooks: Provide specific tactics for interacting with the distinct departments mentioned in the reviews (e.g. IT, Legal, Procurement).
      3. General Strategic Advice: A summary of the account's overall vendor-readiness and culture.

      Reviews:
      ${reviewsSummary}`,
      config: {
        systemInstruction:
          "You are a world-class sales enablement strategist. Analyse buyer behaviour across different departments and return structured MEDDPICC and Departmental Playbook intelligence in JSON format.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            keyTraits: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            strategicAdvice: { type: Type.STRING },
            teamPlaybooks: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  teamName: {
                    type: Type.STRING,
                    description:
                      "e.g. 'Legal / Compliance' or 'IT / Engineering'",
                  },
                  tactic: {
                    type: Type.STRING,
                    description:
                      "One-sentence actionable tactic for this team.",
                  },
                },
                required: ["teamName", "tactic"],
              },
            },
            meddpicc: {
              type: Type.OBJECT,
              properties: {
                metrics: { type: Type.STRING },
                economicBuyer: { type: Type.STRING },
                decisionCriteria: { type: Type.STRING },
                decisionProcess: { type: Type.STRING },
                paperProcess: { type: Type.STRING },
                identifyPain: { type: Type.STRING },
                champion: { type: Type.STRING },
                competition: { type: Type.STRING },
              },
              required: [
                "metrics",
                "economicBuyer",
                "decisionCriteria",
                "decisionProcess",
                "paperProcess",
                "identifyPain",
                "champion",
                "competition",
              ],
            },
          },
          required: [
            "summary",
            "keyTraits",
            "strategicAdvice",
            "teamPlaybooks",
            "meddpicc",
          ],
        },
      },
    });

    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("Persona generation error:", error);
    return {
      summary: "Insufficient data to generate persona intelligence.",
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
  }
};
