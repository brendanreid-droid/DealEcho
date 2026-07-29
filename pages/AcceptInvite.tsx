import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { getFunctions, httpsCallable } from 'firebase/functions';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import { auth, googleProvider } from '../src/firebase/config';
import { useAuth } from '../src/hooks/useAuth';

/**
 * The server-side rule this page has to respect: acceptTeamInvite matches the
 * signed-in user's email against the invited address and refuses if they
 * differ. It does not care HOW they signed in - so Google is offered alongside
 * a password, and the only extra work is making a mismatch recoverable.
 */

/** Substring of the server's refusal, so the mismatch gets its own recovery UI. */
const MISMATCH = 'different email address';

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

  const handleGoogle = async () => {
    setAuthError('');
    setSubmitting(true);
    try {
      await signInWithPopup(auth, googleProvider);
      // Same as the password path: useAuth picks the user up and the accept
      // effect below runs. If the Google address is not the invited one, the
      // server refuses and the mismatch screen offers a way back.
    } catch (err: any) {
      // Closing the popup is a decision, not a failure worth shouting about.
      if (err?.code !== 'auth/popup-closed-by-user' && err?.code !== 'auth/cancelled-popup-request') {
        setAuthError(err?.message || 'Could not sign in with Google.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  /** Signing out returns the page to its chooser, with the token still in the URL. */
  const handleStartOver = async () => {
    await signOut(auth);
    setStatus('idle');
    setErrorMsg('');
    setAuthError('');
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
          Sign in with the email this invite was sent to - the invite is tied to that address.
        </p>

        <div className="w-full max-w-sm flex flex-col gap-3 mt-2">
          {/*
            Google first: an invitee is joining a tool a colleague already
            vouched for, and inventing a password is the least appealing way to
            start. The server accepts either.
          */}
          <button
            type="button"
            onClick={handleGoogle}
            disabled={submitting}
            className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-slate-200 bg-white font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z" />
              <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H1.96v2.33A9 9 0 0 0 9 18Z" />
              <path fill="#FBBC05" d="M3.97 10.72a5.41 5.41 0 0 1 0-3.44V4.95H1.96a9 9 0 0 0 0 8.1l2.01-2.33Z" />
              <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59C13.46.89 11.43 0 9 0A9 9 0 0 0 1.96 4.95l2.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z" />
            </svg>
            Continue with Google
          </button>

          <div className="flex items-center gap-3" aria-hidden="true">
            <span className="h-px flex-1 bg-slate-200" />
            <span className="text-2xs uppercase tracking-wider text-slate-400">or</span>
            <span className="h-px flex-1 bg-slate-200" />
          </div>

          <form onSubmit={handleAuth} className="flex flex-col gap-3">
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
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-3 rounded-xl bg-accent text-white font-semibold hover:bg-accent/90 disabled:opacity-50 transition"
            >
              {submitting ? 'Working…' : 'Create account & accept invite'}
            </button>
          </form>

          {authError && <p className="text-red-500 text-sm">{authError}</p>}
        </div>
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

  /*
   * Wrong-account recovery. Easy to reach now that one click signs you in as
   * whoever your browser last used with Google - without a way out this reads
   * as a broken invite rather than the wrong identity.
   *
   * The signed-in address is shown; the invited one is NOT, because the server
   * does not return it and echoing it would tell anyone holding a stolen token
   * who the invite was for.
   */
  if (errorMsg.includes(MISMATCH)) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-center px-4">
        <h1 className="text-2xl font-bold text-slate-900">Wrong account</h1>
        <p className="text-slate-500 max-w-md">
          You're signed in as <strong className="text-slate-700">{user.email}</strong>, but this invite was sent
          to a different address. Sign out and use the address the invite was sent to.
        </p>
        <button
          onClick={handleStartOver}
          className="px-6 py-3 rounded-xl bg-accent text-white font-semibold hover:bg-accent/90 transition"
        >
          Sign out and try again
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-center px-4">
      <h1 className="text-2xl font-bold text-slate-900">Couldn't accept invite</h1>
      <p className="text-red-500 max-w-md">{errorMsg}</p>
      <button
        onClick={handleStartOver}
        className="px-6 py-3 rounded-xl border border-slate-200 font-semibold text-slate-700 hover:bg-slate-50 transition"
      >
        Sign out and try again
      </button>
    </div>
  );
};

export default AcceptInvite;
