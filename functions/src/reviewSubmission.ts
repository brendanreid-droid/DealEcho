/**
 * reviewSubmission.ts — authoritative write path for reviews.
 *
 * Reviews are NO LONGER created directly by the client. firestore.rules blocks
 * client `create`, so every review flows through these callables. This lets us
 * enforce a rate limit the client cannot bypass:
 *
 *   A user may only submit ONE review per company every 6 months, counted from
 *   their most recent APPROVED review for that company. Rejected / pending
 *   reviews do NOT lock the user out — they can edit and resubmit instead.
 *
 * Two callables:
 *   submitReview   — create a new pending review (enforces the 6-month lock)
 *   resubmitReview — edit a previously REJECTED review and re-queue moderation
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db } from "./lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

const SIX_MONTHS_MS = 1000 * 60 * 60 * 24 * 182; // ~6 months

/** Fields the client is allowed to supply for a review. */
interface ReviewPayload {
  companyId: string;
  companyName: string;
  currency: string;
  tcvBracket: string;
  cycleDuration: string;
  status: "Won" | "Lost" | "Ongoing";
  isTender: boolean;
  buyingTeam: string[];
  location: string;
  communicationRating: number;
  negotiationLevel: number;
  timeWasterLevel: number;
  clarityOfScope: number;
  industry: string;
  country: string;
  content: string;
}

/** Whitelist + coerce the client payload; reject obviously invalid input. */
function sanitize(data: any): ReviewPayload {
  const str = (v: any) => (typeof v === "string" ? v : "");
  const num = (v: any) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(5, Math.max(0, n)) : 0;
  };

  const companyId = str(data?.companyId).trim();
  const content = str(data?.content).trim();
  if (!companyId) throw new HttpsError("invalid-argument", "companyId is required.");
  const wordCount = content.trim().split(/\s+/).length;
  if (wordCount < 50) {
    throw new HttpsError("invalid-argument", "Review is too short (minimum 50 words). Share what worked and what didn't in this sales cycle - communication, negotiation, buyer intent, and scope clarity.");
  }

  const outcome = ["Won", "Lost", "Ongoing"].includes(data?.status) ? data.status : "Ongoing";
  const buyingTeam = Array.isArray(data?.buyingTeam)
    ? data.buyingTeam.filter((d: any) => typeof d === "string").slice(0, 20)
    : [];

  return {
    companyId,
    companyName: str(data?.companyName).trim(),
    currency: str(data?.currency) || "USD",
    tcvBracket: str(data?.tcvBracket),
    cycleDuration: str(data?.cycleDuration),
    status: outcome,
    isTender: !!data?.isTender,
    buyingTeam,
    location: str(data?.location),
    communicationRating: num(data?.communicationRating),
    negotiationLevel: num(data?.negotiationLevel),
    timeWasterLevel: num(data?.timeWasterLevel),
    clarityOfScope: num(data?.clarityOfScope),
    industry: str(data?.industry),
    country: str(data?.country),
    content,
  };
}

/**
 * Returns the ISO date the user may next review this company, or null if they
 * are currently allowed to submit. Based on the most recent APPROVED review.
 */
async function nextAllowedDate(uid: string, companyId: string): Promise<string | null> {
  const snap = await db
    .collection("reviews")
    .where("userId", "==", uid)
    .where("companyId", "==", companyId)
    .where("moderationStatus", "==", "approved")
    .orderBy("createdAt", "desc")
    .limit(1)
    .get();

  if (snap.empty) return null;

  const last = snap.docs[0].data();
  const lastAt = new Date(last.createdAt).getTime();
  if (!Number.isFinite(lastAt)) return null; // malformed legacy date → don't block

  const unlockAt = lastAt + SIX_MONTHS_MS;
  return Date.now() < unlockAt ? new Date(unlockAt).toISOString() : null;
}

export const submitReview = onCall({ cors: true }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "You must be signed in to submit a review.");

  const payload = sanitize(request.data);

  const unlock = await nextAllowedDate(uid, payload.companyId);
  if (unlock) {
    throw new HttpsError(
      "failed-precondition",
      "You have already reviewed this company recently.",
      { nextAllowedAt: unlock, companyName: payload.companyName },
    );
  }

  const ref = await db.collection("reviews").add({
    ...payload,
    userId: uid,
    userName: request.auth?.token?.name ?? "Anonymous",
    moderationStatus: "pending",
    createdAt: new Date().toISOString(),
    submittedAt: FieldValue.serverTimestamp(),
  });

  return { id: ref.id, moderationStatus: "pending" };
});

export const resubmitReview = onCall({ cors: true }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "You must be signed in.");

  const reviewId = typeof request.data?.reviewId === "string" ? request.data.reviewId : "";
  if (!reviewId) throw new HttpsError("invalid-argument", "reviewId is required.");

  const ref = db.collection("reviews").doc(reviewId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Review not found.");

  const existing = snap.data()!;
  if (existing.userId !== uid) {
    throw new HttpsError("permission-denied", "You can only edit your own reviews.");
  }
  // Only rejected reviews may be edited. Approved reviews are locked (edits would
  // let a user rewrite public content post-moderation); pending ones are in flight.
  if (existing.moderationStatus !== "rejected") {
    throw new HttpsError(
      "failed-precondition",
      "Only rejected reviews can be edited and resubmitted.",
    );
  }

  const payload = sanitize({ ...existing, ...request.data });

  await ref.update({
    ...payload,
    companyId: existing.companyId, // company is immutable on edit
    moderationStatus: "pending",
    moderationReason: FieldValue.delete(),
    flaggedSegments: FieldValue.delete(),
    moderatedAt: FieldValue.delete(),
    resubmittedAt: FieldValue.serverTimestamp(),
  });

  return { id: reviewId, moderationStatus: "pending" };
});
