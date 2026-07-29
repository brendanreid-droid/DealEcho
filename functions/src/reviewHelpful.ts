import { onCall, HttpsError } from "firebase-functions/v2/https";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "./lib/firebaseAdmin";

/**
 * "Was this review helpful?" - one thumbs up per user per review.
 *
 * Why a callable rather than a rule-guarded client write: the vote and the
 * counter must move together. A client that could write the counter could
 * write any number to it, and a client that could only write the vote would
 * leave the counter to a trigger, which means a second function invocation per
 * vote and a window where the UI and the count disagree. A transaction here
 * does both atomically and cannot be lied to.
 *
 * Toggling rather than write-once: a misclick should be undoable, and an
 * irreversible vote is the kind of thing people learn to distrust.
 */

/** Votes live under the review, keyed by voter uid - the key IS the one-vote rule. */
const voteRef = (reviewId: string, uid: string) =>
  db.collection("reviews").doc(reviewId).collection("helpfulVotes").doc(uid);

export interface ToggleHelpfulResult {
  /** Whether the caller's vote now stands. */
  helpful: boolean;
  /** Total after the toggle, for the client to render without a re-read. */
  helpfulCount: number;
}

/** True when a review is public. Legacy rows predate the moderation field. */
export function isPubliclyVisible(review: Record<string, unknown>): boolean {
  const status = review["moderationStatus"];
  return !status || status === "approved";
}

/**
 * Decide the outcome of one toggle. Pure, so the rules that matter - no
 * self-voting, no voting on an unapproved review, never a negative count - are
 * testable without a Firestore transaction around them.
 *
 * Throws the same HttpsError the callable surfaces, so the messages stay in one
 * place rather than drifting between the guard and its test.
 */
export function decideHelpfulToggle(
  review: Record<string, unknown> | null,
  hasVoted: boolean,
  uid: string,
): { adding: boolean; helpfulCount: number } {
  // Same error for missing and unapproved: distinguishing them would confirm a
  // hidden review exists to anyone who guessed its id.
  if (!review || !isPubliclyVisible(review)) {
    throw new HttpsError("not-found", "That review no longer exists.");
  }
  if (review["userId"] === uid) {
    throw new HttpsError("failed-precondition", "You cannot mark your own review helpful.");
  }

  // Recomputed from the stored value; a client-supplied total is never trusted.
  const current = typeof review["helpfulCount"] === "number" ? review["helpfulCount"] : 0;
  const adding = !hasVoted;
  // Clamped: a review whose votes were removed by hand must not go negative.
  return { adding, helpfulCount: Math.max(0, current + (adding ? 1 : -1)) };
}

export const toggleReviewHelpful = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign in to mark a review helpful.");
  }
  const uid = request.auth.uid;
  const reviewId = request.data?.reviewId;
  if (typeof reviewId !== "string" || !reviewId.trim() || reviewId.length > 200) {
    throw new HttpsError("invalid-argument", "reviewId is required.");
  }

  const reviewRef = db.collection("reviews").doc(reviewId);

  return db.runTransaction<ToggleHelpfulResult>(async (tx) => {
    const [reviewSnap, voteSnap] = await Promise.all([tx.get(reviewRef), tx.get(voteRef(reviewId, uid))]);

    const { adding, helpfulCount } = decideHelpfulToggle(
      reviewSnap.exists ? reviewSnap.data()! : null,
      voteSnap.exists,
      uid,
    );

    if (adding) {
      tx.set(voteRef(reviewId, uid), { userId: uid, createdAt: FieldValue.serverTimestamp() });
    } else {
      tx.delete(voteRef(reviewId, uid));
    }
    tx.set(reviewRef, { helpfulCount }, { merge: true });

    return { helpful: adding, helpfulCount };
  });
});
