/**
 * reviewModeration.ts — server-side review pipeline for DealEcho
 *
 * Two responsibilities:
 *  1. MODERATION (authoritative): when a review is created with
 *     moderationStatus 'pending', run Gemini moderation server-side and flip
 *     the status to 'approved' or 'rejected'. The API key never leaves the
 *     server (stored as a Firebase secret, NOT in the client bundle).
 *  2. PUBLIC SUMMARIES: maintain a `review_summaries` collection containing
 *     only the fields free users may see (scores + truncated excerpt). This
 *     lets Firestore rules lock the full `reviews` collection to Pro users,
 *     closing the paywall leak properly.
 *
 * Setup:
 *   cd functions
 *   npm i @google/genai
 *   firebase functions:secrets:set GEMINI_API_KEY
 *   # then export these functions from functions/src/index.ts:
 *   #   export { onReviewWritten } from "./reviewModeration";
 *   firebase deploy --only functions:onReviewWritten
 *
 * Backfill existing reviews once (creates summaries for legacy docs):
 *   set RUN_BACKFILL guidance at bottom of this file.
 */

import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { defineSecret } from "firebase-functions/params";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { initializeApp, getApps } from "firebase-admin/app";
import { GoogleGenAI } from "@google/genai";

if (getApps().length === 0) initializeApp();

const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");
const REGION = "australia-southeast1"; // matches existing Stripe functions
const EXCERPT_LENGTH = 140; // characters of content exposed to free users

// Give-to-get: a user's first APPROVED review unlocks temporary full-review
// read access. Enforced by a self-expiring custom claim checked in
// firestore.rules, so no cleanup job is needed.
const REVIEW_UNLOCK_DAYS = 7;

/**
 * Grant the review-read unlock to `uid` when this is their first approved
 * review. Sets a `reviewUnlockUntil` custom claim (epoch seconds, read by
 * rules) and mirrors it onto the user doc so the client can surface it and
 * know to refresh its token. No-op if they already have another approved
 * review or an active unlock. Never throws into the moderation path.
 */
async function grantReviewUnlockIfFirst(
  db: FirebaseFirestore.Firestore,
  uid: string,
  reviewId: string,
): Promise<void> {
  try {
    // First approved review? Look for any OTHER approved review by this user.
    const others = await db
      .collection("reviews")
      .where("userId", "==", uid)
      .where("moderationStatus", "==", "approved")
      .limit(2)
      .get();
    const hasOtherApproved = others.docs.some((d) => d.id !== reviewId);
    if (hasOtherApproved) return;

    const auth = getAuth();
    const nowSec = Math.floor(Date.now() / 1000);
    const user = await auth.getUser(uid);
    const existing = (user.customClaims?.reviewUnlockUntil as number) ?? 0;
    if (existing > nowSec) return; // already has an active unlock

    const untilSec = nowSec + REVIEW_UNLOCK_DAYS * 24 * 60 * 60;
    await auth.setCustomUserClaims(uid, {
      ...(user.customClaims ?? {}),
      reviewUnlockUntil: untilSec,
    });
    await db.collection("users").doc(uid).set(
      {
        reviewUnlock: {
          until: new Date(untilSec * 1000).toISOString(),
          grantedAt: new Date().toISOString(),
          reason: "first_review",
        },
      },
      { merge: true },
    );
  } catch (err) {
    console.error(`Failed to grant review unlock for ${uid}:`, err);
  }
}

interface ModerationVerdict {
  isSafe: boolean;
  reason?: string;
}

// Weblinks are caught deterministically before the AI call — regex is more
// reliable than the model for URLs, and it saves an API round-trip on obvious
// violations. Matches http(s):// links, www.-prefixed, and bare domains.
const URL_PATTERN =
  /\b(?:https?:\/\/|www\.)\S+|\b[a-z0-9-]+\.(?:com|net|org|io|co|ai|app|dev|biz|info|gov|edu)\b(?:\/\S*)?/i;

async function moderate(content: string, apiKey: string): Promise<ModerationVerdict> {
  // ── Deterministic pre-check: reject weblinks outright ──
  if (URL_PATTERN.test(content)) {
    return {
      isSafe: false,
      reason: "Reviews may not contain web links or URLs. Please remove any links.",
    };
  }

  const ai = new GoogleGenAI({ apiKey });
  const prompt = `You are a content moderator for a B2B sales review platform.
Reviews describe a company's BUYING behaviour. They MAY reference generic
departments or teams (e.g. "Procurement", "Legal", "the IT team", "their
finance department") — that is expected and ALLOWED.

Reject content that contains:
- Names of individual people (first names, surnames, initials, or nicknames)
- Job titles or positions that identify a SPECIFIC individual, e.g. "their CFO",
  "the Head of Procurement", "our VP of Sales", "the CEO said". Do NOT reject
  generic team/department references like "the procurement team".
- Defamatory claims, profanity, hate speech, or harassment
- Confidential pricing details or contract terms attributable to a named deal
- Contact details (emails, phone numbers) or web links / URLs

Respond ONLY with minified JSON: {"isSafe": boolean, "reason": "short, specific reason if unsafe — tell the reviewer exactly what to remove"}

REVIEW:
"""${content}"""`;

  const result = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
  });

  try {
    const text = (result.text ?? "").replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(text);
    return { isSafe: !!parsed.isSafe, reason: parsed.reason };
  } catch {
    // If the model response is unparseable, fail CLOSED: leave for human review.
    return { isSafe: false, reason: "Automatic moderation inconclusive — held for admin review" };
  }
}

/** Fields safe to expose publicly to non-Pro users. */
function toSummary(reviewId: string, data: FirebaseFirestore.DocumentData) {
  const content: string = data.content ?? "";
  return {
    reviewId,
    companyId: data.companyId ?? "",
    companyName: data.companyName ?? "",
    industry: data.industry ?? "",
    country: data.country ?? "",
    location: data.location ?? "",
    status: data.status ?? "Ongoing",
    communicationRating: data.communicationRating ?? 0,
    negotiationLevel: data.negotiationLevel ?? 0,
    timeWasterLevel: data.timeWasterLevel ?? 0,
    clarityOfScope: data.clarityOfScope ?? 3,
    excerpt:
      content.length > EXCERPT_LENGTH
        ? content.slice(0, EXCERPT_LENGTH).trimEnd() + "…"
        : content,
    createdAt: data.createdAt ?? new Date().toISOString(),
    syncedAt: FieldValue.serverTimestamp(),
  };
}

export const onReviewWritten = onDocumentWritten(
  {
    document: "reviews/{reviewId}",
    region: REGION,
    secrets: [GEMINI_API_KEY],
  },
  async (event) => {
    const db = getFirestore();
    const reviewId = event.params.reviewId;
    const after = event.data?.after;

    // Deleted review → remove its public summary
    if (!after?.exists) {
      await db.doc(`review_summaries/${reviewId}`).delete().catch(() => {});
      return;
    }

    const data = after.data()!;

    // ── 1. Moderation: only act on pending reviews ──────────────────────────
    if (data.moderationStatus === "pending") {
      let verdict: ModerationVerdict;
      try {
        verdict = await moderate(data.content ?? "", GEMINI_API_KEY.value());
      } catch (err) {
        console.error(`Moderation call failed for ${reviewId}:`, err);
        // Fail closed: keep pending so an admin can review in /admin.
        return;
      }

      await after.ref.update({
        moderationStatus: verdict.isSafe ? "approved" : "rejected",
        moderationReason: verdict.reason ?? null,
        moderatedAt: FieldValue.serverTimestamp(),
      });
      // Give-to-get: reward the author's first approved review with temporary
      // full-review access. Runs off the approval, so rejected reviews earn
      // nothing (no spam-to-unlock).
      if (verdict.isSafe && typeof data.userId === "string") {
        await grantReviewUnlockIfFirst(db, data.userId, reviewId);
      }
      // The update above re-triggers this function; the summary sync happens
      // on that second invocation (status will no longer be 'pending').
      return;
    }

    // ── 2. Summary sync: mirror approved reviews, remove everything else ────
    const isApproved = !data.moderationStatus || data.moderationStatus === "approved";
    const summaryRef = db.doc(`review_summaries/${reviewId}`);
    if (isApproved) {
      await summaryRef.set(toSummary(reviewId, data), { merge: true });
    } else {
      await summaryRef.delete().catch(() => {});
    }
  },
);

/*
 * ── One-time backfill for legacy reviews ────────────────────────────────────
 * Run locally with the Admin SDK (e.g. `npx ts-node scripts/backfill.ts`) or
 * temporarily as an HTTPS function. Pseudocode:
 *
 *   const snap = await db.collection("reviews").get();
 *   for (const doc of snap.docs) {
 *     const d = doc.data();
 *     const approved = !d.moderationStatus || d.moderationStatus === "approved";
 *     if (approved) {
 *       await db.doc(`review_summaries/${doc.id}`).set(toSummary(doc.id, d), { merge: true });
 *     }
 *   }
 *
 * Verify `review_summaries` is fully populated BEFORE tightening firestore.rules,
 * otherwise free users will see an empty site.
 */
