import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getFunctions, httpsCallable } from "firebase/functions";
import Icon from "../src/components/Icon";

interface Invite {
  email: string;
  status: string;
  sentAt: string;
  rewardedAt: string | null;
}

interface ReferralStatus {
  eligible: boolean;
  ineligibleReason?: "not_paid" | "disabled" | null;
  invites: Invite[];
  truncated?: boolean;
  counts: { sent: number; signedUp: number; rewarded: number };
  monthsEarned: number;
  cap: { limit: number; usedThisYear: number; remaining: number };
  quotaRemainingToday: number;
  quotaRemainingLifetime?: number;
}

interface InviteResult {
  email: string;
  result: string;
}

const STATUS_LABELS: Record<string, string> = {
  sent: "Sent",
  signed_up: "Joined",
  rewarding: "Joined",
  rewarded: "Earned",
  capped: "Over cap",
  expired: "Expired",
  void: "Not sent",
};

const RESULT_MESSAGES: Record<string, string> = {
  sent: "Invite sent",
  already_member: "Already a Dealecho member",
  already_invited: "You've already invited them",
  invalid: "Not a valid email address",
  self: "That's your own address",
  rate_limited: "Daily invite limit reached",
  lifetime_limit: "You've used all your invites",
  send_failed: "We couldn't deliver this one",
};

const Referrals: React.FC = () => {
  const [status, setStatus] = useState<ReferralStatus | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [emails, setEmails] = useState("");
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState<InviteResult[] | null>(null);

  const load = useCallback(async () => {
    try {
      const fns = getFunctions(undefined, "australia-southeast1");
      const call = httpsCallable(fns, "getReferralStatus");
      const res = await call({});
      setStatus(res.data as ReferralStatus);
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const atCap = !!status && status.cap.remaining <= 0;
  const noQuota = !!status && status.quotaRemainingToday <= 0;
  // Distinct from noQuota: this one never resets, so the message must not
  // imply waiting will help.
  const noLifetimeQuota = !!status && status.quotaRemainingLifetime === 0;
  const canSend = !!status?.eligible && !atCap && !noQuota && !noLifetimeQuota;

  const handleSend = async () => {
    const list = emails
      .split(/[\s,;]+/)
      .map((e) => e.trim())
      .filter(Boolean)
      .slice(0, 10);
    if (list.length === 0) return;

    setSending(true);
    setResults(null);
    try {
      const fns = getFunctions(undefined, "australia-southeast1");
      const call = httpsCallable(fns, "sendReferralInvites");
      const res = await call({ emails: list });
      setResults((res.data as { results: InviteResult[] }).results);
      setEmails("");
      await load();
    } catch (err: any) {
      setResults([{ email: "", result: err?.message || "send_failed" }]);
    }
    setSending(false);
  };

  if (loadError) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16">
        <p className="text-sm text-slate-500">
          We couldn't load your referrals just now. Please refresh and try again.
        </p>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
          Loading
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-8">
      <header className="space-y-3">
        <h1 className="text-2xl font-black tracking-tight text-slate-900">
          Invite a colleague, get a month free
        </h1>
        <p className="text-sm text-slate-500 leading-relaxed">
          Invite someone to Dealecho. They get 30 days of Sales Pro free. Once
          their first payment goes through, a free month lands on your account.
        </p>
      </header>

      {!status.eligible ? (
        status.ineligibleReason === "disabled" ? (
          // The feature flag is off. Telling a paying member to upgrade here
          // would be flatly untrue - they already have the plan.
          <div className="p-6 bg-slate-50 rounded-card border border-slate-200 space-y-3">
            <div className="flex items-center space-x-3 text-slate-500">
              <Icon name="fa-clock" size={14} />
              <span className="text-[10px] font-bold uppercase tracking-widest">
                Not available yet
              </span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Referrals aren't switched on right now. Nothing is wrong with your
              account, and there's nothing you need to do. Check back soon.
            </p>
          </div>
        ) : (
          <div className="p-6 bg-accent-50 rounded-card border border-accent/30 space-y-4">
            <div className="flex items-center space-x-3 text-accent">
              <Icon name="fa-crown" size={14} />
              <span className="text-[10px] font-bold uppercase tracking-widest">
                Sales Pro only
              </span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Referrals are a Sales Pro benefit. Upgrade to start inviting
              colleagues and earning free months.
            </p>
            <Link
              to="/pricing"
              className="block text-center bg-accent text-white py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-accent-700 transition-all"
            >
              Upgrade to Sales Pro
            </Link>
          </div>
        )
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4">
            <Stat label="Invites sent" value={status.counts.sent + status.counts.signedUp + status.counts.rewarded} />
            <Stat label="Joined" value={status.counts.signedUp + status.counts.rewarded} />
            <Stat label="Months earned" value={status.monthsEarned} />
          </div>

          <section className="bg-white p-6 rounded-card border border-slate-200 space-y-4">
            <label
              htmlFor="referral-emails"
              className="block text-[10px] font-bold uppercase tracking-widest text-slate-400"
            >
              Email addresses
            </label>
            <textarea
              id="referral-emails"
              value={emails}
              onChange={(e) => setEmails(e.target.value)}
              rows={3}
              placeholder="colleague@company.com, another@company.com"
              className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
            />
            <p className="text-[11px] text-slate-400">
              Up to 10 at a time. {status.quotaRemainingToday} invites left today.
              {" "}
              {status.cap.remaining} left this year.
            </p>

            {noLifetimeQuota && (
              <p className="text-[11px] text-amber-600">
                You've used all of your invites. This one doesn't reset, so get
                in touch if you need more.
              </p>
            )}

            {atCap && (
              <p className="text-[11px] text-amber-600">
                You've reached the maximum of {status.cap.limit} free months for
                this year. You can keep inviting once your oldest reward passes
                12 months.
              </p>
            )}

            <button
              type="button"
              onClick={handleSend}
              disabled={!canSend || sending || emails.trim().length === 0}
              className="w-full bg-accent text-white py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-accent-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {sending ? "Sending" : "Send invites"}
            </button>

            {results && (
              <ul className="space-y-1 pt-2">
                {results.map((r, i) => (
                  <li key={`${r.email}-${i}`} className="text-[11px] text-slate-500">
                    <span className="font-semibold text-slate-700">{r.email}</span>{" "}
                    {RESULT_MESSAGES[r.result] ?? r.result}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {status.invites.length > 0 && (
            <section className="bg-white rounded-card border border-slate-200 overflow-hidden">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      Invited
                    </th>
                    <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {status.invites.map((invite) => (
                    <tr key={`${invite.email}-${invite.sentAt}`} className="border-b border-slate-50 last:border-0">
                      <td className="p-4 text-sm text-slate-700">{invite.email}</td>
                      <td className="p-4 text-[11px] font-bold uppercase tracking-widest text-slate-500">
                        {STATUS_LABELS[invite.status] ?? invite.status}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {status.truncated && (
                <p className="p-4 pt-0 text-[11px] text-slate-400">
                  Showing your 100 most recent invites. The totals above cover
                  all of them.
                </p>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
};

const Stat: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div className="bg-white p-4 rounded-card border border-slate-200">
    <div className="text-2xl font-black text-slate-900">{value}</div>
    <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">
      {label}
    </div>
  </div>
);

export default Referrals;
