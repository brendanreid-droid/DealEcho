import React, { useEffect, useState } from 'react';
import { collection, doc, onSnapshot } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '../src/firebase/config';
import { useAuth } from '../src/hooks/useAuth';

interface TeamMember {
  uid: string;
  email: string;
  teamRole: 'manager' | 'user';
  status: 'active' | 'invited';
}

interface Team {
  ownerId: string;
  seats: number;
  stripeSubscriptionId: string;
}

const TeamSettings: React.FC = () => {
  const { user, teamId, teamRole, isTeamManager, isEnterprise, refreshClaims } = useAuth();
  const [team, setTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'manager' | 'user'>('user');
  const [addSeatsCount, setAddSeatsCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fns = getFunctions();

  useEffect(() => {
    if (!teamId) return;

    const unsubTeam = onSnapshot(doc(db, 'teams', teamId), (snap) => {
      if (snap.exists()) setTeam(snap.data() as Team);
    });

    const unsubMembers = onSnapshot(collection(db, 'teams', teamId, 'members'), (snap) => {
      setMembers(snap.docs.map((d) => ({ uid: d.id, ...d.data() } as TeamMember)));
      setLoading(false);
    });

    return () => { unsubTeam(); unsubMembers(); };
  }, [teamId]);

  const call = async (fnName: string, data: object, loadingKey: string) => {
    setActionLoading(loadingKey);
    setError('');
    setSuccess('');
    try {
      await httpsCallable(fns, fnName)(data);
      setSuccess('Done.');
      await refreshClaims();
    } catch (e: any) {
      setError(e.message || 'Something went wrong.');
    } finally {
      setActionLoading(null);
    }
  };

  if (!isEnterprise) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <p className="text-slate-500">Enterprise plan required to access team settings.</p>
      </div>
    );
  }

  if (loading || !team) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-accent animate-spin" />
      </div>
    );
  }

  const activeCount = members.filter((m) => m.status === 'active').length;
  const monthlyCost = team.seats * 13;

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-slate-900 mb-1">Team Settings</h1>

      {/* Billing header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">Enterprise Plan</div>
          <div className="text-slate-600 text-sm">
            {activeCount} of {team.seats} seats used · ${monthlyCost}/mo
          </div>
        </div>
        {isTeamManager && user?.id === team.ownerId && (
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={5}
              placeholder="New seat count"
              value={addSeatsCount ?? ''}
              onChange={(e) => setAddSeatsCount(Number(e.target.value))}
              className="w-32 px-3 py-2 border border-slate-200 rounded-lg text-sm"
            />
            <button
              disabled={!addSeatsCount || actionLoading === 'seats'}
              onClick={() => addSeatsCount && call('updateTeamSeats', { seats: addSeatsCount }, 'seats')}
              className="px-4 py-2 bg-accent text-white text-sm font-semibold rounded-lg hover:bg-accent/90 disabled:opacity-50 transition"
            >
              {actionLoading === 'seats' ? 'Updating…' : 'Update Seats'}
            </button>
          </div>
        )}
      </div>

      {/* Feedback */}
      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
      {success && <p className="text-green-600 text-sm mb-4">{success}</p>}

      {/* Members table */}
      <div className="border border-slate-200 rounded-xl overflow-hidden mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="text-left px-4 py-3 text-slate-500 font-medium">Member</th>
              <th className="text-left px-4 py-3 text-slate-500 font-medium">Role</th>
              <th className="text-left px-4 py-3 text-slate-500 font-medium">Status</th>
              {isTeamManager && <th className="px-4 py-3" />}
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.uid} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-3 text-slate-700">{m.email}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                    m.teamRole === 'manager'
                      ? 'bg-violet-100 text-violet-700'
                      : 'bg-slate-100 text-slate-600'
                  }`}>
                    {m.teamRole === 'manager' ? (m.uid === team.ownerId ? 'Manager (Owner)' : 'Manager') : 'User'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {m.status === 'active'
                    ? <span className="text-green-600 text-xs">● Active</span>
                    : <span className="text-amber-500 text-xs">⏳ Invite pending</span>
                  }
                </td>
                {isTeamManager && (
                  <td className="px-4 py-3 text-right space-x-2">
                    {m.status === 'invited' ? (
                      <>
                        <button
                          disabled={!!actionLoading}
                          onClick={() => call('resendTeamInvite', { inviteEmail: m.email }, `resend-${m.uid}`)}
                          className="text-xs text-slate-500 hover:text-slate-800 border border-slate-200 px-2 py-1 rounded disabled:opacity-50"
                        >
                          {actionLoading === `resend-${m.uid}` ? '…' : 'Resend'}
                        </button>
                        <button
                          disabled={!!actionLoading}
                          onClick={() => call('cancelPendingInvite', { inviteEmail: m.email }, `cancel-${m.uid}`)}
                          className="text-xs text-red-500 hover:text-red-700 border border-red-200 px-2 py-1 rounded disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </>
                    ) : m.uid !== team.ownerId ? (
                      <>
                        <button
                          disabled={!!actionLoading}
                          onClick={() => call('updateTeamMemberRole', { targetUid: m.uid, newRole: m.teamRole === 'manager' ? 'user' : 'manager' }, `role-${m.uid}`)}
                          className="text-xs text-slate-500 hover:text-slate-800 border border-slate-200 px-2 py-1 rounded disabled:opacity-50"
                        >
                          {actionLoading === `role-${m.uid}` ? '…' : m.teamRole === 'manager' ? 'Make User' : 'Make Manager'}
                        </button>
                        <button
                          disabled={!!actionLoading}
                          onClick={() => {
                            if (window.confirm(`Remove ${m.email} from the team? They'll revert to free.`)) {
                              call('removeTeamMember', { targetUid: m.uid }, `remove-${m.uid}`);
                            }
                          }}
                          className="text-xs text-red-500 hover:text-red-700 border border-red-200 px-2 py-1 rounded disabled:opacity-50"
                        >
                          {actionLoading === `remove-${m.uid}` ? '…' : 'Remove'}
                        </button>
                      </>
                    ) : null}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Invite form — managers only */}
      {isTeamManager && (
        <div className="flex gap-2">
          <input
            type="email"
            placeholder="colleague@company.com"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
          />
          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value as 'manager' | 'user')}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
          >
            <option value="user">User</option>
            <option value="manager">Manager</option>
          </select>
          <button
            disabled={!inviteEmail || !!actionLoading}
            onClick={() => {
              call('inviteTeamMember', { email: inviteEmail, teamRole: inviteRole }, 'invite').then(() => setInviteEmail(''));
            }}
            className="px-4 py-2 bg-accent text-white text-sm font-semibold rounded-lg hover:bg-accent/90 disabled:opacity-50 transition"
          >
            {actionLoading === 'invite' ? 'Sending…' : 'Send Invite'}
          </button>
        </div>
      )}
    </div>
  );
};

export default TeamSettings;
