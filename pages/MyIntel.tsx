import React, { useMemo, useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { getFunctions, httpsCallable } from "firebase/functions";
import { doc, setDoc } from "firebase/firestore";
import { sendPasswordResetEmail } from "firebase/auth";
import { db, auth } from "../src/firebase/config";
import { Review } from "../types";
import CompanyLogo from "../components/CompanyLogo";
import { useAuth, MappedUser } from "../src/hooks/useAuth";
import Icon from "../src/components/Icon";
import MySubmissions from "../src/components/MySubmissions";
import { Loader2 } from "lucide-react";
import { companyLogoUrl, guessDomainFromName } from "../src/utils/companyLogo";

const getTimeAgo = (dateStr: string): string => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
};

interface MyIntelProps {
  user: MappedUser | null;
  isPaid: boolean;
  reviews: Review[];
  trackedIds: string[];
  onToggleTrack: (id: string) => void;
  notifications: Record<string, number>;
  onClearNotification: (id: string) => void;
  onSignInClick?: () => void;
}

const MyIntel: React.FC<MyIntelProps> = ({
  user,
  isPaid,
  reviews,
  trackedIds,
  onToggleTrack,
  notifications,
  onClearNotification,
  onSignInClick,
}) => {
  const navigate = useNavigate();
  const { refreshClaims } = useAuth();
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelSuccess, setCancelSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<'tracked' | 'reviews' | 'billing'>('tracked');
  const [resetSent, setResetSent] = useState(false);
  const [resetSending, setResetSending] = useState(false);
  const [localNotifPrefs, setLocalNotifPrefs] = useState({
    realTimeAlerts: user?.notificationPreferences?.realTimeAlerts !== false,
    weeklyDigest: user?.notificationPreferences?.weeklyDigest !== false,
  });

  useEffect(() => {
    setLocalNotifPrefs({
      realTimeAlerts: user?.notificationPreferences?.realTimeAlerts !== false,
      weeklyDigest: user?.notificationPreferences?.weeklyDigest !== false,
    });
  }, [user?.notificationPreferences]);

  const handleCancelSubscription = async () => {
    if (
      !window.confirm(
        "Are you sure you want to cancel your Sales Pro subscription? You will lose access to all Pro features immediately.",
      )
    ) {
      return;
    }
    setCancelling(true);
    setCancelError(null);
    setCancelSuccess(false);
    try {
      const functions = getFunctions(undefined, "australia-southeast1");
      const cancelFn = httpsCallable(functions, "cancelSubscription");
      await cancelFn({});
      await refreshClaims();
      setCancelSuccess(true);
    } catch (err: any) {
      setCancelError(
        err.message || "Failed to cancel subscription. Please try again.",
      );
    } finally {
      setCancelling(false);
    }
  };

  const [billingLoading, setBillingLoading] = useState(false);
  const [billingError, setBillingError] = useState<string | null>(null);

  const handleManageBilling = async () => {
    setBillingLoading(true);
    setBillingError(null);
    try {
      const functions = getFunctions(undefined, "australia-southeast1");
      const portalFn = httpsCallable<
        Record<string, never>,
        { portalUrl: string }
      >(functions, "createBillingPortalSession");
      const res = await portalFn({});
      if (res.data?.portalUrl) {
        window.location.href = res.data.portalUrl;
      } else {
        setBillingError("Could not open billing portal. Please try again.");
      }
    } catch (err: any) {
      setBillingError(err.message || "Could not open billing portal.");
    } finally {
      setBillingLoading(false);
    }
  };

  const handleNotificationToggle = async (
    setting: 'realTimeAlerts' | 'weeklyDigest',
    value: boolean,
  ) => {
    const newPrefs = {
      realTimeAlerts: setting === 'realTimeAlerts' ? value : localNotifPrefs.realTimeAlerts,
      weeklyDigest: setting === 'weeklyDigest' ? value : localNotifPrefs.weeklyDigest,
    };

    try {
      const userDocRef = doc(db, "users", user.id);
      await setDoc(userDocRef, { notificationPreferences: newPrefs }, { merge: true });
      setLocalNotifPrefs(newPrefs);
    } catch (err) {
      console.error("Failed to update notification settings", err);
    }
  };

  // Hooks must be called before any early returns to satisfy the Rules of Hooks
  const trackedCompanies = useMemo(() => {
    const stats: Record<string, any> = {};
    reviews.forEach((review) => {
      const id = review.companyId;
      if (!trackedIds.includes(id)) return;
      if (!stats[id]) {
        stats[id] = {
          id,
          name: review.companyName,
          industry: review.industry,
          count: 0,
          lastReviewDate: review.createdAt,
          logoUrl: companyLogoUrl({ name: review.companyName, domain: guessDomainFromName(review.companyName) }),
        };
      }
      stats[id].count++;
      if (new Date(review.createdAt) > new Date(stats[id].lastReviewDate)) {
        stats[id].lastReviewDate = review.createdAt;
      }
    });
    return Object.values(stats);
  }, [reviews, trackedIds]);

  const userReviews = useMemo(() => {
    if (!user?.id) return [];
    return reviews
      .filter((r) => r.userId === user.id)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
  }, [reviews, user?.id]);

  // Unauthenticated "Vault" Screen (Unified Template)
  if (!user) {
    return (
      <div className="bg-navy min-h-screen flex items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-1/2 h-full bg-accent/5 blur-[120px] rounded-full"></div>
        <div className="max-w-xl w-full bg-white/5 border border-white/10 backdrop-blur-3xl rounded-card p-10 md:p-16 text-center space-y-10 relative z-10 shadow-2xl">
          <div className="w-20 h-20 bg-accent text-white rounded-card flex items-center justify-center mx-auto shadow-2xl">
            <Icon name="fa-fingerprint" size={30} />
          </div>
          <div className="space-y-4">
            <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight uppercase tracking-widest">
              My Intel
            </h1>
            <p className="text-slate-400 text-sm md:text-base font-medium leading-relaxed">
              Track target accounts, manage deal notifications, and monitor your
              personal intelligence contributions in your private vault.
            </p>
          </div>
          <button
            onClick={onSignInClick}
            className="w-full bg-accent text-white py-5 rounded-control font-bold uppercase tracking-widest shadow-xl hover:bg-accent-700 transition-all flex items-center justify-center space-x-3"
          >
            <Icon name="fa-lock" className="opacity-50" size={12} />
            <span>Sign In to Access</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-12 space-y-12">
      {/* Tab Navigation */}
      <div className="flex gap-8 border-b border-slate-200 mb-8 px-6">
        <button
          onClick={() => setActiveTab('tracked')}
          aria-selected={activeTab === 'tracked'}
          role="tab"
          className={`pb-4 px-0 font-semibold text-sm transition-colors flex items-center gap-2 border-b-2 ${
            activeTab === 'tracked'
              ? 'text-accent border-accent'
              : 'text-slate-500 border-transparent hover:text-slate-700'
          }`}
        >
          <Icon name="fa-bookmark" size={16} />
          Tracked Accounts
        </button>
        <button
          onClick={() => setActiveTab('reviews')}
          aria-selected={activeTab === 'reviews'}
          role="tab"
          className={`pb-4 px-0 font-semibold text-sm transition-colors flex items-center gap-2 border-b-2 ${
            activeTab === 'reviews'
              ? 'text-accent border-accent'
              : 'text-slate-500 border-transparent hover:text-slate-700'
          }`}
        >
          <Icon name="fa-history" size={16} />
          My Reviews
        </button>
        <button
          onClick={() => setActiveTab('billing')}
          aria-selected={activeTab === 'billing'}
          role="tab"
          className={`pb-4 px-0 font-semibold text-sm transition-colors flex items-center gap-2 border-b-2 ${
            activeTab === 'billing'
              ? 'text-accent border-accent'
              : 'text-slate-500 border-transparent hover:text-slate-700'
          }`}
        >
          <Icon name="fa-credit-card" size={16} />
          Billing & Account
        </button>
      </div>

      {/* Tab Content */}
      <div className="max-w-7xl mx-auto px-6 pb-12">
        {activeTab === 'tracked' && (
          <div className="space-y-8">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold flex items-center">
                <Icon name="fa-bookmark" className="text-accent mr-3" size={18} />
                Tracked Accounts
              </h3>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                {trackedIds.length} / {isPaid ? "∞" : "3"}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
              {trackedCompanies.length > 0 ? (
                trackedCompanies.map((c) => {
                  const companyReviews = reviews.filter((r) => r.companyId === c.id);
                  const avgComm = companyReviews.length > 0 ? Math.round((companyReviews.reduce((sum, r) => sum + r.communicationRating, 0) / companyReviews.length) * 10) / 10 : 0;
                  const avgNeg = companyReviews.length > 0 ? Math.round((companyReviews.reduce((sum, r) => sum + r.negotiationLevel, 0) / companyReviews.length) * 10) / 10 : 0;
                  const avgTime = companyReviews.length > 0 ? Math.round((companyReviews.reduce((sum, r) => sum + r.timeWasterLevel, 0) / companyReviews.length) * 10) / 10 : 0;
                  const avgClarity = companyReviews.length > 0 ? Math.round((companyReviews.reduce((sum, r) => sum + (r.clarityOfScope || 3), 0) / companyReviews.length) * 10) / 10 : 0;
                  const mostRecent = companyReviews.length > 0 ? companyReviews.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] : null;

                  return (
                    <div
                      key={c.id}
                      className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm relative group hover:shadow-lg hover:border-accent/30 hover:-translate-y-0.5 transition-all cursor-pointer"
                    >
                      {notifications[c.id] && (
                        <div className="absolute -top-2 -right-2 bg-rose-500 text-white text-[9px] font-bold px-2 py-1 rounded-lg">
                          NEW
                        </div>
                      )}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center space-x-3 flex-1">
                          <CompanyLogo
                            name={c.name}
                            logoUrl={c.logoUrl}
                            size="md"
                          />
                          <div>
                            <Link
                              to={`/company/${c.id}`}
                              className="font-bold text-slate-900 text-base group-hover:text-accent transition-colors block"
                            >
                              {c.name}
                            </Link>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                              {c.industry}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <div className="bg-slate-900 text-white px-2 py-1 rounded-lg text-center">
                            <div className="text-[8px] font-bold uppercase tracking-tighter opacity-60">
                              Overall
                            </div>
                            <div className="text-sm font-bold text-accent-soft">
                              {Math.round((avgComm + avgNeg + avgTime + avgClarity) / 4)}%
                            </div>
                          </div>
                          <button
                            onClick={() => onToggleTrack(c.id)}
                            className="text-slate-200 hover:text-rose-500 flex items-center justify-center"
                          >
                            <Icon name="fa-times-circle" size={14} />
                          </button>
                        </div>
                      </div>

                      {mostRecent && (
                        <p className="text-slate-600 text-sm leading-relaxed line-clamp-2 mb-2 font-medium">
                          {mostRecent.content}
                        </p>
                      )}

                      <div className="grid grid-cols-4 gap-1.5 mb-3 py-2 bg-slate-50 rounded-lg px-2">
                        <div className="text-center">
                          <div className="text-[9px] text-slate-500 uppercase font-bold">Communication</div>
                          <div className="text-base font-bold text-slate-900">{avgComm}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-[9px] text-slate-500 uppercase font-bold">Negotiation</div>
                          <div className="text-base font-bold text-slate-900">{avgNeg}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-[9px] text-slate-500 uppercase font-bold">Intent</div>
                          <div className="text-base font-bold text-slate-900">{avgTime}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-[9px] text-slate-500 uppercase font-bold">Scope</div>
                          <div className="text-base font-bold text-slate-900">{avgClarity}</div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[10px]">
                        <span className="font-bold text-slate-300">
                          {mostRecent && getTimeAgo(mostRecent.createdAt)}
                        </span>
                        <div className="font-bold text-accent uppercase">
                          {c.count} Reports
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="md:col-span-2 bg-white p-12 rounded-card border border-dashed border-slate-200 text-center space-y-4">
                  <Icon name="fa-search" className="text-slate-200 mx-auto block" size={40} />
                  <p className="text-slate-400 text-xs font-bold uppercase">
                    No accounts tracked
                  </p>
                  <Link
                    to="/"
                    className="text-accent text-[10px] font-bold uppercase tracking-widest hover:underline"
                  >
                    Start Searching
                  </Link>
                </div>
              )}

              {!isPaid && trackedIds.length >= 3 && (
                <div className="md:col-span-2 p-6 bg-accent-50 rounded-card border border-accent/30 space-y-4">
                  <div className="flex items-center space-x-3 text-accent">
                    <Icon name="fa-crown" size={14} />
                    <span className="text-[10px] font-bold uppercase tracking-widest">
                      Limit Reached
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Upgrade to Sales Pro to track unlimited accounts and get
                    AI-powered persona intelligence.
                  </p>
                  <Link
                    to="/pricing"
                    className="block text-center bg-accent text-white py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-accent-700 transition-all"
                  >
                    Upgrade Now
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'reviews' && (
          <div className="space-y-8">
            {user?.id && <MySubmissions userId={user.id} />}

            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold flex items-center">
                <Icon name="fa-history" className="text-accent mr-3" size={18} />
                Workspace History
              </h3>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                {userReviews.length} Reviews
              </span>
            </div>

            {userReviews.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                {userReviews.map((review) => {
                  const domainGuess = guessDomainFromName(review.companyName);
                  const logoUrl = review.logoUrl || companyLogoUrl({ name: review.companyName, domain: domainGuess });
                  const avgScore = Math.round(
                    ((review.communicationRating +
                      review.negotiationLevel +
                      review.timeWasterLevel +
                      (review.clarityOfScope || 3)) /
                      20) *
                      100,
                  );
                  const timeAgo = getTimeAgo(review.createdAt);

                  return (
                    <div
                      key={review.id}
                      onClick={() =>
                        navigate(
                          `/company/${encodeURIComponent(review.companyId)}`,
                          {
                            state: {
                              company: {
                                id: review.companyId,
                                name: review.companyName,
                                industry: review.industry,
                                country: review.country || review.location,
                              },
                            },
                          },
                        )
                      }
                      className="bg-white p-4 md:p-5 rounded-card border border-slate-100 shadow-sm hover:shadow-lg hover:border-accent/30 hover:-translate-y-0.5 transition-all cursor-pointer group"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <CompanyLogo
                            name={review.companyName}
                            logoUrl={logoUrl}
                            size="md"
                            className="group-hover:scale-105 transition"
                          />
                          <div>
                            <h4 className="font-bold text-slate-900 group-hover:text-accent transition-colors text-base">
                              {review.companyName}
                            </h4>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                              {review.industry} &bull;{" "}
                              {review.country || review.location}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest ${
                              review.status === "Won"
                                ? "bg-emerald-50 text-emerald-600 border border-emerald-100"
                                : review.status === "Lost"
                                  ? "bg-rose-50 text-rose-600 border border-rose-100"
                                  : "bg-amber-50 text-amber-600 border border-amber-100"
                            }`}
                          >
                            {review.status}
                          </span>
                          <div className="bg-slate-900 text-white px-2 py-1 rounded-lg text-center">
                            <div className="text-[8px] font-bold uppercase tracking-tighter opacity-60">
                              Overall
                            </div>
                            <div className="text-sm font-bold text-accent-soft">
                              {avgScore}%
                            </div>
                          </div>
                        </div>
                      </div>

                      <p className="text-slate-600 text-sm leading-relaxed line-clamp-2 mb-2 font-medium">
                        {review.content}
                      </p>

                      <div className="grid grid-cols-4 gap-1.5 mb-3 py-2 bg-slate-50 rounded-lg px-2">
                        <div className="text-center">
                          <div className="text-[9px] text-slate-500 uppercase font-bold">Communication</div>
                          <div className="text-base font-bold text-slate-900">{review.communicationRating}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-[9px] text-slate-500 uppercase font-bold">Negotiation</div>
                          <div className="text-base font-bold text-slate-900">{review.negotiationLevel}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-[9px] text-slate-500 uppercase font-bold">Time Waster</div>
                          <div className="text-base font-bold text-slate-900">{review.timeWasterLevel}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-[9px] text-slate-500 uppercase font-bold">Clarity</div>
                          <div className="text-base font-bold text-slate-900">{review.clarityOfScope || 3}</div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[10px]">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-400 uppercase tracking-widest flex items-center">
                            <Icon name="fa-dollar-sign" className="mr-0.5" size={9} />
                            {review.tcvBracket}
                          </span>
                          <span className="font-bold text-slate-400 uppercase tracking-widest flex items-center">
                            <Icon name="fa-clock" className="mr-0.5" size={9} />
                            {review.cycleDuration}
                          </span>
                        </div>
                        <span className="font-bold text-slate-300">
                          {timeAgo}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-white rounded-card p-12 border border-slate-100 flex flex-col items-center justify-center text-center space-y-6 shadow-sm">
                <div className="w-16 h-16 bg-slate-50 rounded-2xl shadow-inner flex items-center justify-center text-slate-200 text-3xl">
                  <Icon name="fa-pen-nib" size={30} />
                </div>
                <div>
                  <h4 className="text-2xl font-bold text-slate-900 mb-2">
                    No Reviews Yet
                  </h4>
                  <p className="text-slate-500 text-sm max-w-sm mx-auto font-medium leading-relaxed">
                    Write your first review to start building your workplace
                    intelligence history.
                  </p>
                </div>
                <Link
                  to="/review/new"
                  className="bg-accent text-white px-8 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-accent-700 transition-all shadow-lg flex items-center gap-1.5"
                >
                  <Icon name="fa-pen-nib" size={10} />Write Review
                </Link>
              </div>
            )}
          </div>
        )}

        {activeTab === 'billing' && (
          <div className="space-y-8">
            {/* Profile Section */}
            <div className="bg-gradient-to-r from-slate-900 to-slate-800 p-10 rounded-card text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-1/3 h-full bg-accent/10 blur-[100px] rounded-full"></div>
              <div className="flex items-center space-x-6 relative z-10">
                <img
                  src={user.avatar}
                  className="w-20 h-20 rounded-card border-4 border-white/10"
                  alt="avatar"
                />
                <div>
                  <h2 className="text-3xl font-bold tracking-tight">{user.name}</h2>
                  <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">
                    {user.email}
                  </p>
                </div>
              </div>
            </div>

            {/* Plan & Subscription Section */}
            <div className="bg-white p-8 rounded-card border border-slate-100 shadow-sm space-y-6">
              <h3 className="text-lg font-bold text-slate-900">Subscription & Plan</h3>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                    Current Plan
                  </p>
                  <div
                    className={`px-6 py-3 rounded-control text-center border inline-block ${isPaid ? "bg-accent/20 border-accent-soft/30" : "bg-white/10 border-white/10"}`}
                  >
                    <div className="text-sm font-bold">
                      {isPaid ? "Sales Pro Member" : "Pioneer Plan"}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-3">
                  {cancelSuccess && (
                    <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">
                      Subscription cancelled successfully
                    </span>
                  )}
                  {cancelError && (
                    <span className="text-[10px] font-bold text-rose-400 uppercase tracking-widest">
                      {cancelError}
                    </span>
                  )}
                  {!isPaid && (
                    <Link
                      to="/pricing"
                      className="px-6 py-3 bg-accent text-white rounded-control text-[10px] font-bold uppercase tracking-widest hover:bg-accent-700 transition-all shadow-lg flex items-center space-x-2"
                    >
                      <Icon name="fa-crown" size={10} />
                      <span>Upgrade to Sales Pro</span>
                    </Link>
                  )}
                  {isPaid && (
                    <button
                      onClick={handleCancelSubscription}
                      disabled={cancelling}
                      className="px-6 py-3 bg-rose-600/20 border border-rose-500/30 text-rose-400 rounded-control text-[10px] font-bold uppercase tracking-widest hover:bg-rose-600/40 transition-all flex items-center space-x-2 disabled:opacity-50 justify-center"
                    >
                      {cancelling ? (
                        <>
                          <Loader2 className="animate-spin text-rose-400" size={10} />
                          <span>Cancelling…</span>
                        </>
                      ) : (
                        <>
                          <Icon name="fa-times-circle" size={10} />
                          <span>Cancel Subscription</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Payment Details Section */}
            <div className="bg-white p-8 rounded-card border border-slate-100 shadow-sm space-y-6">
              <h3 className="text-lg font-bold text-slate-900">Payment Details</h3>
              {isPaid ? (
                <>
                  <p className="text-sm text-slate-500 font-medium">
                    Update your card, change how you pay, view invoices, or cancel your plan through Stripe's secure billing portal.
                  </p>
                  {billingError && (
                    <p className="text-sm text-red-500 font-medium">{billingError}</p>
                  )}
                  <button
                    onClick={handleManageBilling}
                    disabled={billingLoading}
                    className="px-6 py-3 rounded-2xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-50 transition inline-flex items-center gap-2"
                  >
                    {billingLoading ? "Opening…" : "Manage Billing & Payment Method"}
                  </button>
                </>
              ) : (
                <p className="text-sm text-slate-500 font-medium">
                  You're on the free plan. Upgrade to manage payment methods and billing here.
                </p>
              )}
            </div>

            {/* Account Security Section */}
            <div className="bg-white p-8 rounded-card border border-slate-100 shadow-sm space-y-6">
              <h3 className="text-lg font-bold flex items-center text-slate-900">
                <Icon name="fa-shield-alt" className="text-accent mr-3" size={18} />
                Account Security
              </h3>
              {(() => {
                const provider = auth.currentUser?.providerData?.[0]?.providerId;
                if (provider === "google.com") {
                  return (
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center flex-shrink-0">
                        <svg viewBox="0 0 24 24" className="w-5 h-5" xmlns="http://www.w3.org/2000/svg">
                          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-800">Signed in with Google</p>
                        <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed">
                          Your password and security settings are managed by Google. Update them at{" "}
                          <a
                            href="https://myaccount.google.com/security"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-accent hover:underline"
                          >
                            myaccount.google.com/security
                          </a>
                          .
                        </p>
                      </div>
                    </div>
                  );
                }
                return (
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm font-bold text-slate-800">Password Reset</p>
                      <p className="text-xs text-slate-500 font-medium mt-1">
                        We'll send a reset link to <span className="text-slate-700">{user?.email}</span>.
                      </p>
                    </div>
                    {resetSent ? (
                      <div className="flex items-center gap-2 text-emerald-600 text-sm font-bold">
                        <Icon name="fa-check-circle" size={15} />
                        Reset email sent - check your inbox.
                      </div>
                    ) : (
                      <button
                        onClick={async () => {
                          if (!user?.email) return;
                          setResetSending(true);
                          try {
                            await sendPasswordResetEmail(auth, user.email);
                            setResetSent(true);
                          } finally {
                            setResetSending(false);
                          }
                        }}
                        disabled={resetSending}
                        className="px-4 py-2 bg-slate-900 text-white text-xs font-bold uppercase tracking-widest rounded-xl hover:bg-slate-700 transition-colors disabled:opacity-50"
                      >
                        {resetSending ? "Sending..." : "Send Reset Email"}
                      </button>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Email Notification Settings Card */}
            <div className="bg-white p-8 rounded-card border border-slate-100 shadow-sm space-y-6">
              <h3 className="text-lg font-bold flex items-center text-slate-900">
                <Icon name="fa-envelope-open-text" className="text-accent mr-3" size={18} />
                Email Notifications
              </h3>

              <p className="text-xs text-slate-400 font-medium leading-relaxed">
                Customize how and when you receive intelligence reports on your tracked accounts.
              </p>

              <div className="space-y-4">
                <label className="flex items-start space-x-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={localNotifPrefs.realTimeAlerts}
                    onChange={(e) => handleNotificationToggle('realTimeAlerts', e.target.checked)}
                    className="mt-1 h-4.5 w-4.5 rounded border-slate-300 text-accent focus:ring-accent cursor-pointer"
                  />
                  <div>
                    <span className="text-sm font-bold text-slate-800 group-hover:text-accent transition-colors">
                      Real-time Alerts
                    </span>
                    <p className="text-[11px] text-slate-400 font-medium leading-normal mt-0.5">
                      Instantly receive an email report when a new vetted review is created on any tracked account.
                    </p>
                  </div>
                </label>

                <label className="flex items-start space-x-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={localNotifPrefs.weeklyDigest}
                    onChange={(e) => handleNotificationToggle('weeklyDigest', e.target.checked)}
                    className="mt-1 h-4.5 w-4.5 rounded border-slate-300 text-accent focus:ring-accent cursor-pointer"
                  />
                  <div>
                    <span className="text-sm font-bold text-slate-800 group-hover:text-accent transition-colors">
                      Weekly Digest
                    </span>
                    <p className="text-[11px] text-slate-400 font-medium leading-normal mt-0.5">
                      A summary of the week's key buyer activity, trends, and scorecard movements.
                    </p>
                  </div>
                </label>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MyIntel;
