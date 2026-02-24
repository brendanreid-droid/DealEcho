import { useState, useEffect, useCallback } from 'react';

export const useTracking = (userId: string | undefined, isPro: boolean) => {
  const [trackedCompanies, setTrackedCompanies] = useState<string[]>([]);

  // Load user-specific tracking data when userId changes
  useEffect(() => {
    if (userId) {
      const saved = localStorage.getItem(`dealecho_tracked_${userId}`);
      setTrackedCompanies(saved ? JSON.parse(saved) : []);
    } else {
      setTrackedCompanies([]);
    }
  }, [userId]);

  // Save to user-specific storage whenever data changes
  useEffect(() => {
    if (userId) {
      localStorage.setItem(`dealecho_tracked_${userId}`, JSON.stringify(trackedCompanies));
    }
  }, [trackedCompanies, userId]);

  const toggleTrack = useCallback((id: string) => {
    if (!userId) return;
    setTrackedCompanies((prev) => {
      const isTracked = prev.includes(id);
      if (isTracked) {
        return prev.filter((cid) => cid !== id);
      } else {
        if (!isPro && prev.length >= 3) {
          alert('Pioneer plan is limited to 3 tracked accounts. Upgrade to Sales Pro for unlimited tracking!');
          return prev;
        }
        return [...prev, id];
      }
    });
  }, [userId, isPro]);

  return { trackedCompanies, toggleTrack };
};
