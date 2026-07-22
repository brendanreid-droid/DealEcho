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
import {
  TCV_BRACKETS,
  DURATION_BRACKETS,
  OUTCOMES,
  DEAL_TYPES,
  DEAL_REGIONS,
  CURRENCIES,
  SELLER_CATEGORIES,
  SELLER_SIZES,
  FRICTION_EVENTS,
  VERBAL_TO_SIGNATURE,
  CLOSE_SLIPPAGE,
  PAYMENT_TERMS,
  PROCUREMENT_ENTRY,
  STAKEHOLDER_COUNTS,
  enumOr,
} from "./lib/reviewSchema";

const SIX_MONTHS_MS = 1000 * 60 * 60 * 24 * 182; // ~6 months

/** Fields the client is allowed to supply for a review. */
interface ReviewPayload {
  companyId: string;
  companyName: string;
  currency: string;
  tcvBracket: string;
  cycleDuration: string;
  status: "Won" | "Lost" | "No Decision" | "Withdrew" | "Ongoing";
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
  schemaVersion: number;
  dealType: string;
  dealRegion: string;
  dealPeriod: string;
  sellerCategory: string;
  sellerSize: string;
  frictionEvents: string[];
  verbalToSignature: string;
  closeSlippage: string;
  wentDark: boolean;
  paymentTerms: string;
  procurementEntry: string;
  stakeholderCount: string;
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

  const outcome = enumOr(OUTCOMES, data?.status, "Ongoing") as ReviewPayload["status"];
  const buyingTeam = Array.isArray(data?.buyingTeam)
    ? data.buyingTeam.filter((d: any) => typeof d === "string").slice(0, 20)
    : [];

  // Deal period is client-generated ("Q3 2026" / "Older") — validate shape, not membership.
  const dealPeriodRaw = str(data?.dealPeriod).trim();
  const dealPeriod =
    /^Q[1-4] 20\d{2}$/.test(dealPeriodRaw) || dealPeriodRaw === "Older" ? dealPeriodRaw : "Older";

  const frictionEvents: string[] = Array.isArray(data?.frictionEvents)
    ? Array.from(
        new Set(
          (data.frictionEvents as unknown[]).filter(
            (e: unknown): e is string => typeof e === "string" && (FRICTION_EVENTS as readonly string[]).includes(e),
          ),
        ),
      ).slice(0, FRICTION_EVENTS.length)
    : [];

  return {
    companyId,
    companyName: str(data?.companyName).trim(),
    currency: enumOr(CURRENCIES, data?.currency, "USD"),
    tcvBracket: enumOr(TCV_BRACKETS, data?.tcvBracket, TCV_BRACKETS[0]),
    cycleDuration: enumOr(DURATION_BRACKETS, data?.cycleDuration, DURATION_BRACKETS[0]),
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
    schemaVersion: 2,
    dealType: enumOr(DEAL_TYPES, data?.dealType, DEAL_TYPES[0]),
    dealRegion: enumOr(DEAL_REGIONS, data?.dealRegion, "Global / Multi-region"),
    dealPeriod,
    sellerCategory: enumOr(SELLER_CATEGORIES, data?.sellerCategory, "Other"),
    sellerSize: enumOr(SELLER_SIZES, data?.sellerSize, SELLER_SIZES[0]),
    frictionEvents,
    verbalToSignature: enumOr(VERBAL_TO_SIGNATURE, data?.verbalToSignature, "Unknown"),
    closeSlippage: enumOr(CLOSE_SLIPPAGE, data?.closeSlippage, "Unknown"),
    wentDark: !!data?.wentDark,
    paymentTerms: enumOr(PAYMENT_TERMS, data?.paymentTerms, "Unknown / N/A"),
    procurementEntry: enumOr(PROCUREMENT_ENTRY, data?.procurementEntry, "Unknown"),
    stakeholderCount: enumOr(STAKEHOLDER_COUNTS, data?.stakeholderCount, STAKEHOLDER_COUNTS[0]),
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
