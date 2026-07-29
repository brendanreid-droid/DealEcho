import { useCallback, useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { auth, db } from "../firebase/config";

interface ToggleResult {
  helpful: boolean;
  helpfulCount: number;
}

/**
 * Helpful votes for a set of reviews: which ones the current user has voted on,
 * and the running counts.
 *
 * Counts are seeded from the reviews themselves and then owned here, so a vote
 * updates the number immediately without refetching the review list.
 *
 * Whether the CURRENT user voted is read per review from
 * `reviews/{id}/helpfulVotes/{uid}`. Rules allow a user to read only their own
 * vote, so there is no bulk query to make instead - one get each, in parallel,
 * for the handful of reviews on screen.
 */
export function useHelpfulVotes(reviews: { id: string; helpfulCount?: number }[]) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [mine, setMine] = useState<Record<string, boolean>>({});
  const [pending, setPending] = useState<Record<string, boolean>>({});

  // Reviews arrive as a fresh array each render, so depend on their identity
  // and counts rather than the array itself or this loops forever.
  const signature = reviews.map((r) => `${r.id}:${r.helpfulCount ?? 0}`).join(",");

  useEffect(() => {
    setCounts(Object.fromEntries(reviews.map((r) => [r.id, r.helpfulCount ?? 0])));

    const uid = auth.currentUser?.uid;
    if (!uid || reviews.length === 0) {
      setMine({});
      return;
    }

    let cancelled = false;
    Promise.all(
      reviews.map(async (r) => {
        try {
          const snap = await getDoc(doc(db, "reviews", r.id, "helpfulVotes", uid));
          return [r.id, snap.exists()] as const;
        } catch {
          // A blocked read must not stop the others, and must not claim a vote
          // the user may not have cast.
          return [r.id, false] as const;
        }
      }),
    ).then((entries) => {
      if (!cancelled) setMine(Object.fromEntries(entries));
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  const toggle = useCallback(async (reviewId: string) => {
    if (!auth.currentUser) return;
    // Guard against a double-click racing itself: the second call would toggle
    // straight back, so the count would flicker and land wrong.
    if (pending[reviewId]) return;
    setPending((p) => ({ ...p, [reviewId]: true }));

    // Optimistic, because a vote should feel instant. Reconciled against the
    // server's authoritative total below, and rolled back on failure.
    const wasMine = !!mine[reviewId];
    const prevCount = counts[reviewId] ?? 0;
    setMine((m) => ({ ...m, [reviewId]: !wasMine }));
    setCounts((c) => ({ ...c, [reviewId]: Math.max(0, prevCount + (wasMine ? -1 : 1)) }));

    try {
      const fn = httpsCallable<{ reviewId: string }, ToggleResult>(
        getFunctions(undefined, "australia-southeast1"),
        "toggleReviewHelpful",
      );
      const { data } = await fn({ reviewId });
      setMine((m) => ({ ...m, [reviewId]: data.helpful }));
      setCounts((c) => ({ ...c, [reviewId]: data.helpfulCount }));
    } catch {
      setMine((m) => ({ ...m, [reviewId]: wasMine }));
      setCounts((c) => ({ ...c, [reviewId]: prevCount }));
    } finally {
      setPending((p) => ({ ...p, [reviewId]: false }));
    }
  }, [counts, mine, pending]);

  return { counts, mine, pending, toggle };
}
