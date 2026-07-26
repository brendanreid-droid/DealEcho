import { createHash } from "node:crypto";

/** Mirrors services/accountFlags.ts. The two workspaces cannot import each other. */
export type FlagSeverity = "critical" | "caution" | "watch";

export interface AccountFlag {
  id: string;
  label: string;
  severity: FlagSeverity;
  stat: string;
  qualify: string[];
  reviewIds: string[];
  strength: number;
  priority: number;
  source: "mechanics" | "reports";
  polarity: "risk" | "strength";
}

export interface CorpusEntry {
  id: string;
  content: string;
}

/** Bump to force regeneration when the prompt changes. Replaces a time-based TTL. */
export const PROMPT_VERSION = 1;

/** Free-text flags supplement the structured bank; they should not swamp it. */
export const MAX_AI_FLAGS = 4;

/** A free-text claim needs corroboration. One review is one person's account. */
const MIN_AI_CITATIONS = 2;

/** Everything a free-text flag gets, so the ranker treats it as mid-weight. */
const AI_PRIORITY = 72;

/**
 * Content-addressed cache key. Regenerate when the corpus actually changes -
 * a new review, a deleted review, or an EDITED review, which a plain count
 * misses entirely. Deliberately not time-based: re-running Gemini over an
 * unchanged corpus only reshuffles the wording, and a seller mid-cycle should
 * not find the flags reworded between visits.
 */
export function corpusFingerprint(corpus: CorpusEntry[]): string {
  const canonical = corpus
    .map((r) => `${r.id}:${createHash("sha1").update(r.content).digest("hex")}`)
    .sort()
    .join("|");
  return createHash("sha1").update(`v${PROMPT_VERSION}|${canonical}`).digest("hex");
}

const SEVERITIES: FlagSeverity[] = ["critical", "caution", "watch"];

/**
 * Strip anything the model invented or under-evidenced. A free-text flag
 * survives only with a label, a stat containing a number, at least one
 * qualification point, and at least two review IDs that exist in the corpus.
 *
 * Validating that an ID exists is not the same as validating that the review
 * says the thing - requiring two independent citations is what makes a single
 * planted review insufficient to manufacture a flag.
 */
export function validateAiFlags(raw: unknown, knownIds: string[]): AccountFlag[] {
  if (!Array.isArray(raw)) return [];
  const known = new Set(knownIds);
  const out: AccountFlag[] = [];

  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;

    const label = typeof e["label"] === "string" ? e["label"].trim() : "";
    const stat = typeof e["stat"] === "string" ? e["stat"].trim() : "";
    if (!label || !stat || !/\d/.test(stat)) continue;

    const qualify = Array.isArray(e["qualify"])
      ? e["qualify"].filter((q): q is string => typeof q === "string" && q.trim().length > 0).map((q) => q.trim())
      : [];
    if (qualify.length === 0) continue;

    const ids = Array.isArray(e["reviewIds"]) ? e["reviewIds"] : [];
    const valid = Array.from(
      new Set(ids.filter((id: unknown): id is string => typeof id === "string" && known.has(id))),
    );
    if (valid.length < MIN_AI_CITATIONS) continue;

    const severity = SEVERITIES.includes(e["severity"] as FlagSeverity)
      ? (e["severity"] as FlagSeverity)
      : "caution";

    out.push({
      id: `ai-${createHash("sha1").update(label.toLowerCase()).digest("hex").slice(0, 8)}`,
      label,
      severity,
      stat,
      qualify: qualify.slice(0, 3),
      reviewIds: valid,
      strength: valid.length / Math.max(knownIds.length, 1),
      priority: AI_PRIORITY,
      source: "reports",
      // The free-text prompt asks for risks only - see the prompt in getAccountFlags.
      polarity: "risk",
    });
    if (out.length === MAX_AI_FLAGS) break;
  }
  return out;
}

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { GoogleGenAI, Type } from "@google/genai";
import { db } from "./lib/firebaseAdmin";
import { isProRole } from "./extension/gating";

const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");

/** Below this many reviews, a free-text pattern is one person's opinion. */
const MIN_FLAG_REVIEWS = 3;
/** Cap the corpus so one company cannot drive an unbounded prompt. */
export const MAX_CORPUS_REVIEWS = 60;
/** Cap each review so one long review cannot dominate the context. */
export const MAX_CONTENT_CHARS = 2000;

/** Legacy reviews predate moderation and count as approved. Mirrors reviewModeration.ts:219. */
export const isApproved = (d: FirebaseFirestore.DocumentData): boolean =>
  !d["moderationStatus"] || d["moderationStatus"] === "approved";

/**
 * Review text is user-submitted and gets interpolated next to `[id]` citation
 * markers. Square brackets are replaced so planted text cannot imitate a marker
 * and win a fabricated attribution - validateAiFlags checks that an ID exists,
 * not that the review actually says the thing.
 */
export const sanitise = (content: string): string =>
  content.slice(0, MAX_CONTENT_CHARS).replace(/\[/g, "(").replace(/\]/g, ")");

/**
 * Free-text flags for a company, cached on a corpus fingerprint.
 *
 * Trust model: the client sends only a companyId. The server reads the reviews
 * itself - a client-supplied corpus would let anyone poison the shared cache
 * for a real company with fabricated text and citations resolving to nothing.
 *
 * Region is inherited from setGlobalOptions in index.ts (australia-southeast1),
 * matching every other onCall in this codebase.
 */
export const getAccountFlags = onCall(
  { cors: true, secrets: [GEMINI_API_KEY] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Sign in to use Dealecho.");
    }
    if (!isProRole(request.auth.token.role as string | undefined)) {
      throw new HttpsError("permission-denied", "Sales Pro required.");
    }

    const companyId = request.data?.companyId;
    if (typeof companyId !== "string" || companyId.trim().length === 0 || companyId.length >= 200) {
      throw new HttpsError("invalid-argument", "companyId is required");
    }

    const cacheRef = db.doc(`account_flags/${companyId}`);

    // A Firestore outage must degrade to an empty flag list, not break the
    // page - the structured flags render without this.
    let corpus: CorpusEntry[];
    let cached: FirebaseFirestore.DocumentData | null = null;
    try {
      const [reviewsSnap, cacheSnap] = await Promise.all([
        db.collection("reviews").where("companyId", "==", companyId).get(),
        cacheRef.get(),
      ]);

      corpus = reviewsSnap.docs
        .map((doc) => ({ id: doc.id, data: doc.data() }))
        .filter(
          ({ data }) =>
            isApproved(data) && typeof data["content"] === "string" && data["content"].trim().length > 0,
        )
        .slice(0, MAX_CORPUS_REVIEWS)
        .map(({ id, data }) => ({ id, content: String(data["content"]).trim() }));

      cached = cacheSnap.exists ? (cacheSnap.data() ?? null) : null;
    } catch (error) {
      console.error("Failed to read reviews or cache for flag extraction:", error);
      return { flags: [] };
    }

    if (corpus.length < MIN_FLAG_REVIEWS) return { flags: [] };

    const knownIds = corpus.map((r) => r.id);
    const fingerprint = corpusFingerprint(corpus);

    // Content-addressed: an unchanged corpus always returns the same flags, so
    // a seller mid-cycle never finds them silently reworded.
    if (cached && cached["fingerprint"] === fingerprint) {
      return { flags: validateAiFlags(cached["flags"], knownIds) };
    }

    const apiKey = GEMINI_API_KEY.value();
    if (!apiKey || apiKey.includes("PLACEHOLDER")) {
      console.warn("No valid GEMINI_API_KEY - returning no flags.");
      return { flags: [] };
    }

    const ai = new GoogleGenAI({ apiKey });
    const body = corpus.map((r) => `[${r.id}] ${sanitise(r.content)}`).join("\n\n");

    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents:
          `Below are ${corpus.length} reviews written by B2B sellers about selling to this ` +
          `company. Each is prefixed with its ID in square brackets.\n\n` +
          `Identify up to ${MAX_AI_FLAGS} recurring risks a seller should know about, that are ` +
          `only visible in the written text - things like a champion leaving mid-cycle, the buyer ` +
          `hinting they could build it internally, a reorg stalling the deal, or a competitor ` +
          `already embedded. Do NOT report procurement mechanics such as security questionnaires, ` +
          `MSA redlines, pilots, payment terms or committee size - those are already covered ` +
          `elsewhere from structured data.\n\n` +
          `Each risk must appear in at least two reviews. For each one give:\n` +
          `- label: a short finding, at most eight words, about the buyer\n` +
          `- stat: how many reviews show it, written as "N of ${corpus.length} reports"\n` +
          `- severity: critical, caution or watch\n` +
          `- qualify: one to three short fragments a seller should nail down. Fragments, not ` +
          `questions, and not full sentences.\n` +
          `- reviewIds: the exact IDs supporting it. Use only IDs from the text below, never ` +
          `invent one.\n\n` +
          `Write in Australian English. Use plain hyphens, never em dashes. If the evidence is ` +
          `thin, return fewer risks.\n\nReviews:\n${body}`,
        config: {
          systemInstruction:
            "You extract evidence-backed risks from seller-submitted reviews. You never state a " +
            "claim you cannot cite to at least two reviews. You report what the reviews say, not advice.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              flags: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    label: { type: Type.STRING },
                    stat: { type: Type.STRING },
                    severity: { type: Type.STRING },
                    qualify: { type: Type.ARRAY, items: { type: Type.STRING } },
                    reviewIds: { type: Type.ARRAY, items: { type: Type.STRING } },
                  },
                  required: ["label", "stat", "severity", "qualify", "reviewIds"],
                },
              },
            },
            required: ["flags"],
          },
        },
      });

      const text = (response.text ?? "").replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(text || "{}");
      const flags = validateAiFlags(parsed.flags, knownIds);

      // Never cache an empty result - a transient model failure would otherwise
      // lock the panel empty until the corpus happens to change.
      if (flags.length > 0) {
        await cacheRef.set({ flags, fingerprint, generatedAt: Date.now() }, { merge: true });
      }
      return { flags };
    } catch (error) {
      console.error("Flag extraction failed:", error);
      return { flags: [] };
    }
  },
);
