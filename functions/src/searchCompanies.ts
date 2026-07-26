import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { GoogleGenAI } from "@google/genai";

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
        contents: `Search for companies matching: "${query}". Return a JSON array of objects with: name, industry, country, domain (e.g. atlassian.com, when known, otherwise empty string), logoUrl (URL to company logo/favicon if available, otherwise empty string), and a brief description. Use real data from your knowledge or search. Respond ONLY with a valid minified JSON array of objects.`,
        config: {
          tools: [{ googleSearch: {} }],
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
