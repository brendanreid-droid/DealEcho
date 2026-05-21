import { useState, useEffect, useCallback } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { db } from '../firebase/config';

export const useTracking = (userId: string | undefined, isPro: boolean) => {
  const [trackedCompanies, setTrackedCompanies] = useState<string[]>([]);

  // Load user-specific tracking data from Firestore (single source of truth) with localStorage fallback
  useEffect(() => {
    if (!userId) {
      setTrackedCompanies([]);
      return;
    }

    const loadTracking = async () => {
      try {
        // 1. Try loading from Firestore
        const userDocRef = doc(db, 'users', userId);
        const userDocSnap = await getDoc(userDocRef);
        
        if (userDocSnap.exists()) {
          const data = userDocSnap.data();
          if (data.trackedCompanies) {
            setTrackedCompanies(data.trackedCompanies);
            localStorage.setItem(`dealecho_tracked_${userId}`, JSON.stringify(data.trackedCompanies));
            return;
          }
        }
      } catch (err) {
        console.error('Failed to load tracking list from Firestore:', err);
      }

      // 2. Fallback to localStorage if Firestore lookup fails or document doesn't exist yet
      const saved = localStorage.getItem(`dealecho_tracked_${userId}`);
      setTrackedCompanies(saved ? JSON.parse(saved) : []);
    };

    loadTracking();
  }, [userId]);

  // Synchronize local changes to Firestore and localStorage
  const saveTracking = useCallback(async (newTracked: string[]) => {
    if (!userId) return;
    
    // Save to local storage instantly for fast UI feedback
    localStorage.setItem(`dealecho_tracked_${userId}`, JSON.stringify(newTracked));
    
    try {
      // Sync to Firestore user profile document so backend triggers can see it
      const userDocRef = doc(db, 'users', userId);
      await setDoc(userDocRef, { email: getAuth().currentUser?.email ?? "", name: getAuth().currentUser?.displayName ?? "", trackedCompanies: newTracked }, { merge: true });
    } catch (err) {
      console.error('Failed to sync tracking list to Firestore:', err);
    }
  }, [userId]);

  const toggleTrack = useCallback((id: string) => {
    if (!userId) return;
    
    setTrackedCompanies((prev) => {
      const isTracked = prev.includes(id);
      let updated: string[];
      
      if (isTracked) {
        updated = prev.filter((cid) => cid !== id);
      } else {
        if (!isPro && prev.length >= 3) {
          alert('Pioneer plan is limited to 3 tracked accounts. Upgrade to Sales Pro for unlimited tracking!');
          return prev;
        }
        updated = [...prev, id];
      }
      
      // Save changes async
      saveTracking(updated);
      return updated;
    });
  }, [userId, isPro, saveTracking]);

  return { trackedCompanies, toggleTrack };
};
