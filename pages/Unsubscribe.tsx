import React, { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { getFunctions, httpsCallable } from "firebase/functions";
import { useAuth } from "../src/hooks/useAuth";

const Unsubscribe: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  
  const emailParam = searchParams.get("email") || "";
  const uidParam = searchParams.get("uid") || "";

  const [email, setEmail] = useState(emailParam);
  const [realTimeAlerts, setRealTimeAlerts] = useState(true);
  const [weeklyDigest, setWeeklyDigest] = useState(true);
  
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync state if user is logged in or if params exist
  useEffect(() => {
    if (user) {
      setEmail(user.email);
      setRealTimeAlerts(user.notificationPreferences?.realTimeAlerts !== false);
      setWeeklyDigest(user.notificationPreferences?.weeklyDigest !== false);
    } else if (emailParam) {
      setEmail(emailParam);
    }
  }, [user, emailParam]);

  const handleSavePreferences = async (optOutAll = false) => {
    setIsLoading(true);
    setErrorMessage(null);
    setIsSuccess(false);

    const targetRealTime = optOutAll ? false : realTimeAlerts;
    const targetWeekly = optOutAll ? false : weeklyDigest;

    try {
      const functions = getFunctions(undefined, "australia-southeast1");
      const updatePrefsFn = httpsCallable(functions, "updateNotificationPreferences");
      
      await updatePrefsFn({
        email: email || undefined,
        uid: uidParam || undefined,
        preferences: {
          realTimeAlerts: targetRealTime,
          weeklyDigest: targetWeekly,
        },
      });

      if (optOutAll) {
        setRealTimeAlerts(false);
        setWeeklyDigest(false);
      }
      setIsSuccess(true);
    } catch (err: any) {
      console.error("Failed to update preferences:", err);
      setErrorMessage(
        err.message || "Something went wrong updating your notification preferences."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-[#0f172a] min-h-screen flex items-center justify-center p-6 relative overflow-hidden">
      {/* Premium ambient light filters */}
      <div className="absolute top-0 right-0 w-1/2 h-full bg-indigo-500/5 blur-[120px] rounded-full"></div>
      <div className="absolute bottom-0 left-0 w-1/3 h-1/2 bg-indigo-600/5 blur-[100px] rounded-full"></div>

      <div className="max-w-xl w-full bg-white/5 border border-white/10 backdrop-blur-3xl rounded-[48px] p-8 md:p-12 text-center space-y-8 relative z-10 shadow-2xl">
        {/* Animated Brand Emblem */}
        <div className="w-20 h-20 bg-indigo-600 text-white rounded-[28px] flex items-center justify-center mx-auto text-3xl shadow-2xl border-b-4 border-indigo-700 hover:scale-105 transition-transform duration-300">
          <i className="fas fa-envelope-open-text"></i>
        </div>

        <div className="space-y-3">
          <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight uppercase tracking-widest">
            Email Preferences
          </h1>
          <p className="text-slate-400 text-sm font-medium max-w-sm mx-auto leading-relaxed">
            Manage your DealEcho intelligence notifications for{" "}
            <span className="text-indigo-400 font-bold block mt-1">{email || "your account"}</span>
          </p>
        </div>

        {isSuccess && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4 rounded-2xl text-xs font-bold uppercase tracking-wider flex items-center justify-center space-x-2 animate-pulse">
            <i className="fas fa-check-circle"></i>
            <span>Preferences updated successfully!</span>
          </div>
        )}

        {errorMessage && (
          <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-2xl text-xs font-bold uppercase tracking-wider flex items-center justify-center space-x-2">
            <i className="fas fa-exclamation-triangle"></i>
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Custom form controls */}
        <div className="text-left bg-slate-950/40 border border-white/5 rounded-3xl p-6 space-y-6">
          <div className="space-y-4">
            <label className="flex items-start space-x-4 cursor-pointer group">
              <input
                type="checkbox"
                checked={realTimeAlerts}
                onChange={(e) => setRealTimeAlerts(e.target.checked)}
                className="mt-1 h-5 w-5 rounded border-white/10 bg-white/5 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
              <div>
                <span className="text-sm font-bold text-slate-200 group-hover:text-indigo-400 transition-colors">
                  Real-time Buyer Alerts
                </span>
                <p className="text-xs text-slate-400 font-medium leading-relaxed mt-1">
                  Receive email notifications as soon as new buyer report cards are vetted and approved for companies you track.
                </p>
              </div>
            </label>

            <div className="border-t border-white/5 my-4"></div>

            <label className="flex items-start space-x-4 cursor-pointer group">
              <input
                type="checkbox"
                checked={weeklyDigest}
                onChange={(e) => setWeeklyDigest(e.target.checked)}
                className="mt-1 h-5 w-5 rounded border-white/10 bg-white/5 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
              <div>
                <span className="text-sm font-bold text-slate-200 group-hover:text-indigo-400 transition-colors">
                  Weekly Insights Digest
                </span>
                <p className="text-xs text-slate-400 font-medium leading-relaxed mt-1">
                  Get a comprehensive weekly brief summing up key score adjustments, trending accounts, and vetted sales intelligence.
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3 pt-4">
          <button
            onClick={() => handleSavePreferences(false)}
            disabled={isLoading}
            className="w-full bg-indigo-600 text-white py-4.5 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-indigo-950/50 hover:bg-indigo-500 hover:shadow-indigo-900/50 transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <i className="fas fa-spinner fa-spin text-sm"></i>
                <span>Saving Preferences…</span>
              </>
            ) : (
              <span>Save Email Settings</span>
            )}
          </button>

          <button
            onClick={() => handleSavePreferences(true)}
            disabled={isLoading}
            className="w-full bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 hover:text-white py-4.5 rounded-2xl font-bold uppercase tracking-widest text-xs transition-all"
          >
            Unsubscribe from all alerts
          </button>
        </div>

        <div className="border-t border-white/5 pt-6 text-center">
          <Link
            to={user ? "/my-intel" : "/"}
            className="text-indigo-400 hover:text-indigo-300 text-xs font-black uppercase tracking-widest transition-colors"
          >
            {user ? "Back to Dashboard" : "Return Home"}
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Unsubscribe;
