import { useState, useEffect, useCallback } from 'react';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '../firebase/config';
import { Review } from '../../types';

/** Thrown when a user is still within the 6-month per-company cooldown. */
export class ReviewCooldownError extends Error {
  nextAllowedAt?: string;
  constructor(message: string, nextAllowedAt?: string) {
    super(message);
    this.name = 'ReviewCooldownError';
    this.nextAllowedAt = nextAllowedAt;
  }
}

export const useReviews = () => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'reviews'), orderBy('createdAt', 'desc'), limit(200));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedReviews = snapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        .filter((doc: any) => {
          // Show reviews that are approved or don't have a moderationStatus (legacy data)
          const status = doc.moderationStatus;
          return !status || status === 'approved';
        }) as Review[];
      setReviews(fetchedReviews);
      setIsLoading(false);
    }, (error) => {
      console.error("Reviews sync error:", error);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const addReview = useCallback(async (newReview: Review) => {
    // Reviews are written server-side by the submitReview callable, which
    // enforces the 6-month-per-company limit that Firestore rules cannot.
    const { id, userId, userName, ...reviewData } = newReview;
    const functions = getFunctions(undefined, 'australia-southeast1');
    const submit = httpsCallable(functions, 'submitReview');
    try {
      await submit(reviewData);
      return true;
    } catch (err: any) {
      // Firebase surfaces custom HttpsError details on err.details.
      if (err?.code === 'functions/failed-precondition') {
        throw new ReviewCooldownError(
          err.message || 'You have already reviewed this company recently.',
          err?.details?.nextAllowedAt,
        );
      }
      console.error('Failed to save review:', err);
      return false;
    }
  }, []);

  return { reviews, isLoading, addReview };
};
