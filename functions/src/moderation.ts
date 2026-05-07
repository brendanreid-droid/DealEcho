import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { GoogleGenAI, Type } from "@google/genai";
import { db } from "./lib/firebaseAdmin";

/**
 * Regex patterns for detecting sensitive information client-side checks might miss.
 */
const SENSITIVE_PATTERNS: { name: string; pattern: RegExp }[] = [
  { name: "Email address", pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g },
  { name: "Phone number", pattern: /(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}/g },
  { name: "ABN/ACN", pattern: /\b\d{2}\s?\d{3}\s?\d{3}\s?\d{3}\b/g },
  { name: "URL", pattern: /https?:\/\/[^\s]+/g },
  { name: "Credit card number", pattern: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g },
];

/**
 * Checks content against regex patterns for obvious sensitive data.
 * Returns flagged segments if found.
 */
function regexCheck(content: string): { flagged: boolean; segments: string[] } {
  const segments: string[] = [];
  for (const { name, pattern } of SENSITIVE_PATTERNS) {
    const matches = content.match(pattern);
    if (matches) {
      segments.push(`${name}: ${matches.join(", ")}`);
    }
  }
  return { flagged: segments.length > 0, segments };
}

/**
 * Calls Gemini AI to moderate review content for PII, commercial secrets, and trade secrets.
 * Returns { isSafe, reason, flaggedSegments }.
 * On error, fails open (returns isSafe: true) and logs the error.
 */
async function aiModerate(
  content: string,
): Promise<{ isSafe: boolean; reason?: string; flaggedSegments?: string[] }> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey.length < 20 || apiKey.toLowerCase().includes("placeholder")) {
    console.warn("[Moderation] No valid GEMINI_API_KEY — auto-approving (fail-open).");
    return { isSafe: true };
  }

  const ai = new GoogleGenAI({ apiKey });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: `Analyse this B2B sales review for sensitive information. 
      Flag any:
      - Personal names of individuals (PII)
      - Specific confidential pricing details that are commercially sensitive (exact dollar amounts like "$247,000" — note that generic TCV brackets like "$100k - $250k" are acceptable)
      - Trade secrets mentioned
      - Internal company processes or proprietary methodologies
      
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
    console.error("[Moderation] Gemini API error — auto-approving (fail-open):", error);
    return { isSafe: true };
  }
}

/**
 * Firestore trigger: moderates new reviews when they are created.
 * Uses onDocumentCreated (NOT onDocumentWritten) to prevent infinite loops —
 * this function only fires once when the document is first written.
 */
export const moderateNewReview = onDocumentCreated(
  "reviews/{reviewId}",
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
      console.warn("[Moderation] No data in event — skipping.");
      return;
    }

    const reviewId = event.params.reviewId;
    const data = snapshot.data();
    const content = data?.content as string | undefined;

    if (!content) {
      console.log(`[Moderation] Review ${reviewId} has no content — auto-approving.`);
      await snapshot.ref.update({
        moderationStatus: "approved",
        moderatedAt: new Date().toISOString(),
      });
      return;
    }

    console.log(`[Moderation] Processing review ${reviewId} (${content.length} chars)...`);

    // Step 1: Quick regex check for obvious patterns
    const regexResult = regexCheck(content);

    if (regexResult.flagged) {
      console.log(`[Moderation] Review ${reviewId} flagged by regex: ${regexResult.segments.join("; ")}`);
      await snapshot.ref.update({
        moderationStatus: "flagged",
        moderationReason: `Contains sensitive data: ${regexResult.segments.join("; ")}`,
        flaggedSegments: regexResult.segments,
        moderatedAt: new Date().toISOString(),
      });
      return;
    }

    // Step 2: AI moderation via Gemini
    const aiResult = await aiModerate(content);

    if (!aiResult.isSafe) {
      console.log(`[Moderation] Review ${reviewId} flagged by AI: ${aiResult.reason}`);
      await snapshot.ref.update({
        moderationStatus: "flagged",
        moderationReason: aiResult.reason || "Flagged by AI moderation",
        flaggedSegments: aiResult.flaggedSegments || [],
        moderatedAt: new Date().toISOString(),
      });
      return;
    }

    // All checks passed
    console.log(`[Moderation] Review ${reviewId} approved.`);
    await snapshot.ref.update({
      moderationStatus: "approved",
      moderatedAt: new Date().toISOString(),
    });
  },
);
