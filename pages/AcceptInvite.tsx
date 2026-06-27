import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useAuth } from '../src/hooks/useAuth';

const AcceptInvite: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, isLoading, refreshClaims } = useAuth();
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const token = searchParams.get('token');

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
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-center px-4">
        <h1 className="text-2xl font-bold text-slate-900">You've been invited to DealEcho Enterprise</h1>
        <p className="text-slate-500 max-w-md">Sign in or create an account to accept your team invite. Come back to this link after signing in.</p>
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
