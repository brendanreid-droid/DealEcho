import { useState, useEffect, useCallback } from 'react';
import { onAuthStateChanged, User, getIdTokenResult } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase/config';

export type UserRole = 'free' | 'paid' | 'admin';
export type UserTier = 'free' | 'paid_monthly' | 'paid_annual';

export interface MappedUser {
  id: string;
  name: string;
  email: string;
  avatar: string;
}

export interface AuthState {
  user: MappedUser | null;
  role: UserRole;
  tier: UserTier;
  isAdmin: boolean;
  isPaid: boolean;
  isLoading: boolean;
  /** Call after Stripe checkout completes to pick up new claims */
  refreshClaims: () => Promise<void>;
}

export const useAuth = (): AuthState => {
  const [user, setUser] = useState<MappedUser | null>(null);
  const [role, setRole] = useState<UserRole>('free');
  const [tier, setTier] = useState<UserTier>('free');
  const [isLoading, setIsLoading] = useState(true);

  const mapUser = useCallback((fbUser: User): MappedUser => ({
    id: fbUser.uid,
    name: fbUser.displayName || fbUser.email?.split('@')[0] || 'User',
    email: fbUser.email || '',
    avatar: fbUser.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(fbUser.displayName || fbUser.email || 'U')}`,
  }), []);

  const readClaims = useCallback(async (fbUser: User, forceRefresh = false) => {
    try {
      const tokenResult = await getIdTokenResult(fbUser, forceRefresh);
      setRole((tokenResult.claims.role as UserRole) ?? 'free');
      setTier((tokenResult.claims.tier as UserTier) ?? 'free');
    } catch {
      setRole('free');
      setTier('free');
    }
  }, []);

  useEffect(() => {
    let unsubscribeFirestore: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        setUser(mapUser(fbUser));
        await readClaims(fbUser);

        // Also listen to Firestore user doc for real-time role/tier updates (e.g. from webhooks)
        unsubscribeFirestore = onSnapshot(doc(db, 'users', fbUser.uid), (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            if (data.role) setRole(data.role as UserRole);
            if (data.tier) setTier(data.tier as UserTier);
          }
        });
      } else {
        if (unsubscribeFirestore) unsubscribeFirestore();
        setUser(null);
        setRole('free');
        setTier('free');
      }
      setIsLoading(false);
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeFirestore) unsubscribeFirestore();
    };
  }, [readClaims, mapUser]);

  const refreshClaims = useCallback(async () => {
    if (auth.currentUser) {
      await readClaims(auth.currentUser, true);
      setUser(mapUser(auth.currentUser));
    }
  }, [readClaims, mapUser]);

  return {
    user,
    role,
    tier,
    isAdmin: role === 'admin',
    isPaid: role === 'paid' || role === 'admin',
    isLoading,
    refreshClaims,
  };
};
