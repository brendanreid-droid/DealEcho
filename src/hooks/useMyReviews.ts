import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase/config';
import { Review } from '../../types';

export interface MyReview extends Review {
  moderationStatus?: 'pending' | 'approved' | 'rejected' | 'flagged';
  moderationReason?: string;
  flaggedSegments?: string[];
}

/**
 * Live stream of the signed-in user's OWN reviews, all moderation statuses
 * included. Firestore rules permit a user to read reviews where
 * `userId == request.auth.uid`, so rejected reviews (with their reason) are
 * visible only to their author.
 */
export const useMyReviews = (userId: string | undefined) => {
  const [myReviews, setMyReviews] = useState<MyReview[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setMyReviews([]);
      setIsLoading(false);
      return;
    }
    const q = query(
      collection(db, 'reviews'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(100),
    );
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setMyReviews(
          snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as MyReview[],
        );
        setIsLoading(false);
      },
      (error) => {
        console.error('My reviews sync error:', error);
        setIsLoading(false);
      },
    );
    return () => unsubscribe();
  }, [userId]);

  return { myReviews, isLoading };
};
