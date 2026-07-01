import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase/config';

/**
 * ReviewSummary is a sanitised version of Review — only fields that are safe
 * for free users to see. Written by the Cloud Function (reviewModeration.ts)
 * when a review is approved.
 *
 * The full Review with content is in the /reviews collection (Pro only).
 */
export interface ReviewSummary {
  reviewId: string;
  companyId: string;
  companyName: string;
  industry: string;
  country: string;
  location: string;
  status: string; // "Ongoing", "Won", "Lost", etc.
  communicationRating: number;
  negotiationLevel: number;
  timeWasterLevel: number;
  clarityOfScope: number;
  excerpt: string; // Truncated content (~140 chars), safe to show
  createdAt: string;
}

export const useReviewSummaries = () => {
  const [summaries, setSummaries] = useState<ReviewSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    // SECURITY: this collection is public-readable (Firestore rules).
    // Only fields safe for free users are stored here; full content lives in /reviews.
    const q = query(
      collection(db, 'review_summaries'),
      orderBy('createdAt', 'desc'),
      limit(200)
    );
    
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetched = snapshot.docs
          .map(doc => ({
            reviewId: doc.id,
            ...doc.data()
          }))
          .filter(doc => doc.excerpt) // Only summaries with content
          .slice(0, 200) as ReviewSummary[];
        
        setSummaries(fetched);
        setIsLoading(false);
      },
      (error) => {
        console.error("Review summaries sync error:", error);
        setIsLoading(false);
        setIsError(true);
      }
    );

    return () => unsubscribe();
  }, []);

  return { summaries, isLoading, isError };
};
