import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { GoogleGenAI, Type } from "@google/genai";

const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");

export const searchCompanyEntities = onCall(
  { cors: true, secrets: [GEMINI_API_KEY] },
  async (request) => {
    const query = request.data?.query;
    if (!query || typeof query !== "string" || !query.trim()) {
      throw new HttpsError("invalid-argument", "Query is required");
    }

    const apiKey = GEMINI_API_KEY.value();
    if (!apiKey || apiKey.includes("PLACEHOLDER")) {
      console.warn("No valid GEMINI_API_KEY — returning empty results.");
      return { results: [] };
    }

    const ai = new GoogleGenAI({ apiKey });

    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `Search for companies matching: "${query}". Return a JSON array of objects with: name, industry, country, domain (e.g. atlassian.com, when known, otherwise empty string), and a brief description. Use real data from your knowledge or search.`,
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
                domain: { type: Type.STRING },
                description: { type: Type.STRING },
              },
              required: ["name", "industry", "country"],
            },
          },
        },
      });

      const text = (response.text ?? "").replace(/```json|```/g, "").trim();
      const results = JSON.parse(text || "[]");
      return { results };
    } catch (error: any) {
      console.error("Search error in Cloud Function:", error);
      throw new HttpsError("internal", error?.message || "Failed to search companies");
    }
  }
);

export const getAICompanyPersona = onCall(
  { cors: true, secrets: [GEMINI_API_KEY] },
  async (request) => {
    const { companyName, reviews } = request.data ?? {};
    if (!companyName || typeof companyName !== "string" || !companyName.trim()) {
      throw new HttpsError("invalid-argument", "Company name is required");
    }

    if (!Array.isArray(reviews)) {
      throw new HttpsError("invalid-argument", "Reviews array is required");
    }

    const apiKey = GEMINI_API_KEY.value();
    if (!apiKey || apiKey.includes("PLACEHOLDER")) {
      console.warn("No valid GEMINI_API_KEY — returning error.");
      throw new HttpsError("failed-precondition", "AI services are not configured.");
    }

    const ai = new GoogleGenAI({ apiKey });

    const reviewsSummary = reviews
      .map(
        (r: any) =>
          `Team: ${Array.isArray(r.buyingTeam) ? r.buyingTeam.join(", ") : "Unknown"}, Status: ${r.status || "Unknown"}, TCV: ${r.tcvBracket || "Unknown"}, Content: ${r.content || ""}`
      )
      .join("\n\n");

    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash", // We can use gemini-2.5-flash which is standard and has high speed/intelligence
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
                      description: "e.g. 'Legal / Compliance' or 'IT / Engineering'",
                    },
                    tactic: {
                      type: Type.STRING,
                      description: "One-sentence actionable tactic for this team.",
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

      const text = (response.text ?? "").replace(/```json|```/g, "").trim();
      const persona = JSON.parse(text || "{}");
      return { persona };
    } catch (error: any) {
      console.error("Persona error in Cloud Function:", error);
      throw new HttpsError("internal", error?.message || "Failed to generate company persona");
    }
  }
);
