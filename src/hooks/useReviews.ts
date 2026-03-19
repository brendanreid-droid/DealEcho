import { useState, useEffect, useCallback } from 'react';
import { collection, addDoc, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase/config';
import { Review } from '../../types';

export const useReviews = () => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'reviews'), orderBy('createdAt', 'desc'), limit(200));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedReviews = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Review[];
      setReviews(fetchedReviews);
      setIsLoading(false);
    }, (error) => {
      console.error("Reviews sync error:", error);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const addReview = useCallback(async (newReview: Review) => {
    try {
      const { id, ...reviewData } = newReview;
      await addDoc(collection(db, 'reviews'), {
        ...reviewData,
        createdAt: new Date().toISOString()
      });
      return true;
    } catch (err) {
      console.error("Failed to save review:", err);
      alert("Failed to save review. Please try again.");
      return false;
    }
  }, []);

  return { reviews, isLoading, addReview };
};
