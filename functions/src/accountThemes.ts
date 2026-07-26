import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { GoogleGenAI, Type } from "@google/genai";
import { db } from "./lib/firebaseAdmin";

/** One recurring theme across review free text, with the reviews that support it. */
export interface AccountTheme {
  theme: string;
  reviewIds: string[];
}

/** Sellers scan. More than this and the themes stop being read. */
export const MAX_THEMES = 5;

/**
 * Strip anything the model invented. A theme survives only if it has a
 * non-empty label and at least one review ID that actually exists in the input
 * corpus. This is the difference between "3 sellers reported X [R2, R5, R7]"
 * and an unfalsifiable claim.
 */
export function validateThemes(raw: unknown, knownIds: string[]): AccountTheme[] {
  if (!Array.isArray(raw)) return [];
  const known = new Set(knownIds);
  const out: AccountTheme[] = [];

  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const theme = (entry as any).theme;
    const ids = (entry as any).reviewIds;
    if (typeof theme !== "string" || theme.trim().length === 0) continue;
    if (!Array.isArray(ids)) continue;

    const valid = Array.from(new Set(ids.filter((id: unknown) => typeof id === "string" && known.has(id))));
    if (valid.length === 0) continue;

    out.push({ theme: theme.trim(), reviewIds: valid });
    if (out.length === MAX_THEMES) break;
  }
  return out;
}

const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");

/** Themes go stale slowly; the reviewCount check catches real change sooner. */
const THEMES_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Below this many reviews, themes are one person's opinion, not a pattern. */
const MIN_THEME_REVIEWS = 3;

interface ThemeInput {
  id: string;
  content: string;
}

/**
 * Extracts recurring themes from review free text via Gemini, validates every
 * citation against the input corpus, and caches the result per
 * companyId + reviewCount. Degrades to an empty theme list on any failure -
 * Layers A and C render fine without this.
 *
 * Region is inherited from the global `setGlobalOptions` call in index.ts
 * (australia-southeast1), matching every other onCall in this codebase.
 */
export const getAccountThemes = onCall(
  { cors: true, secrets: [GEMINI_API_KEY] },
  async (request) => {
    const { companyId, reviews } = request.data ?? {};
    if (!companyId || typeof companyId !== "string") {
      throw new HttpsError("invalid-argument", "companyId is required");
    }
    if (!Array.isArray(reviews)) {
      throw new HttpsError("invalid-argument", "reviews array is required");
    }

    const corpus: ThemeInput[] = reviews
      .filter((r: any) => r && typeof r.id === "string" && typeof r.content === "string" && r.content.trim())
      .map((r: any) => ({ id: r.id, content: String(r.content).trim() }));

    if (corpus.length < MIN_THEME_REVIEWS) return { themes: [] };

    const cacheRef = db.doc(`account_themes/${companyId}`);
    const snap = await cacheRef.get();
    const cached = snap.exists ? (snap.data() as any) : null;
    if (
      cached &&
      cached.reviewCount === corpus.length &&
      Date.now() - (cached.generatedAt ?? 0) < THEMES_TTL_MS
    ) {
      return { themes: cached.themes ?? [] };
    }

    const apiKey = GEMINI_API_KEY.value();
    if (!apiKey || apiKey.includes("PLACEHOLDER")) {
      console.warn("No valid GEMINI_API_KEY - returning no themes.");
      return { themes: [] };
    }

    const ai = new GoogleGenAI({ apiKey });
    const body = corpus.map((r) => `[${r.id}] ${r.content}`).join("\n\n");

    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents:
          `Below are ${corpus.length} reviews written by B2B sellers about their experience ` +
          `selling to this company. Each review is prefixed with its ID in square brackets.\n\n` +
          `Identify up to ${MAX_THEMES} recurring themes in the buyer's behaviour. A theme must ` +
          `appear in at least two reviews. For each theme, cite the exact review IDs that support ` +
          `it - use only IDs that appear in the text below, never invent one. Write each theme as ` +
          `a single factual sentence about the buyer, in Australian English. Do not give advice.\n\n` +
          `Reviews:\n${body}`,
        config: {
          systemInstruction:
            "You extract recurring, evidence-backed themes from seller-submitted reviews. " +
            "You never state a claim you cannot cite. If the evidence is thin, return fewer themes.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              themes: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    theme: { type: Type.STRING, description: "One factual sentence about the buyer." },
                    reviewIds: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                      description: "IDs of the reviews supporting this theme.",
                    },
                  },
                  required: ["theme", "reviewIds"],
                },
              },
            },
            required: ["themes"],
          },
        },
      });

      const text = (response.text ?? "").replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(text || "{}");
      const themes = validateThemes(parsed.themes, corpus.map((r) => r.id));

      await cacheRef.set(
        { themes, generatedAt: Date.now(), reviewCount: corpus.length },
        { merge: true },
      );
      return { themes };
    } catch (error: any) {
      console.error("Theme extraction failed:", error);
      // Degrade gracefully - Layers A and C still render without this.
      return { themes: [] };
    }
  },
);
