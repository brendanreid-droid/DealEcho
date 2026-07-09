import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../src/firebase/config';
import { useAuth } from '../src/hooks/useAuth';

const AcceptInvite: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, isLoading, refreshClaims } = useAuth();
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  // Inline auth for invitees without an account yet
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const token = searchParams.get('token');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setSubmitting(true);
    try {
      try {
        await createUserWithEmailAndPassword(auth, email.trim(), password);
      } catch (err: any) {
        if (err?.code === 'auth/email-already-in-use') {
          await signInWithEmailAndPassword(auth, email.trim(), password);
        } else {
          throw err;
        }
      }
      // On success, useAuth picks up the user and the accept effect runs automatically.
    } catch (err: any) {
      setAuthError(err?.message || 'Could not sign in. Check your email and password.');
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (isLoading || !token || !user || status !== 'idle') return;

    setStatus('loading');
    const functions = getFunctions(undefined, 'australia-southeast1');
    const accept = httpsCallable(functions, 'acceptTeamInvite');

    accept({ token })
      .then(async () => {
        await refreshClaims();
        setStatus('success');
      })
      .catch((err) => {
        setStatus('error');
        setErrorMsg(err.message || 'Something went wrong.');
      });
  }, [isLoading, user, token, status, refreshClaims]);

  if (!token) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <p className="text-slate-500">Invalid invite link.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-accent animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 px-4">
        <h1 className="text-2xl font-bold text-slate-900 text-center">You've been invited to Dealecho Enterprise</h1>
        <p className="text-slate-500 max-w-md text-center">
          Enter the email this invite was sent to, and choose a password to create your account (or sign in if you already have one).
        </p>
        <form onSubmit={handleAuth} className="w-full max-w-sm flex flex-col gap-3 mt-2">
          <input
            type="email"
            required
            placeholder="Invited email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="px-4 py-3 border border-slate-200 rounded-xl text-sm"
          />
          <input
            type="password"
            required
            minLength={6}
            placeholder="Choose a password (min 6 chars)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="px-4 py-3 border border-slate-200 rounded-xl text-sm"
          />
          {authError && <p className="text-red-500 text-sm">{authError}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-3 rounded-xl bg-accent text-white font-semibold hover:bg-accent/90 disabled:opacity-50 transition"
          >
            {submitting ? 'Working…' : 'Create account & accept invite'}
          </button>
        </form>
        <p className="text-xs text-slate-400 max-w-sm text-center">
          Use the exact email address your invite was sent to — the invite is tied to that address.
        </p>
      </div>
    );
  }

  if (status === 'loading' || status === 'idle') {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-accent animate-spin" />
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-center px-4">
        <h1 className="text-2xl font-bold text-slate-900">You're in!</h1>
        <p className="text-slate-500">You now have Enterprise access. Head to your team settings to see your team.</p>
        <button
          onClick={() => navigate('/settings/team')}
          className="px-6 py-3 rounded-xl bg-accent text-white font-semibold hover:bg-accent/90 transition"
        >
          Go to Team Settings
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-center px-4">
      <h1 className="text-2xl font-bold text-slate-900">Couldn't accept invite</h1>
      <p className="text-red-500 max-w-md">{errorMsg}</p>
    </div>
  );
};

export default AcceptInvite;
