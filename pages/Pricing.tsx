import React, { useState, useEffect } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";
import { useLocation, useNavigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../src/firebase/config";
import { useAuth } from "../src/hooks/useAuth";
import { useSEO } from "../src/hooks/useSEO";

interface PricingProps {
  user: any;
  isPaid: boolean;
}

const Pricing: React.FC<PricingProps> = ({ user, isPaid }) => {
  useSEO({
    title: "DealEcho Pricing - Unlock Advanced B2B Buyer Intelligence & Playbooks",
    description: "Scale your closing rate. Start a 30-day free trial of Sales Pro to access unlimited account tracking, AI MEDDPICC strategic blueprints, and stakeholder buying team personas.",
    keywords: "Sales Pro pricing, sales intelligence subscription, MEDDPICC trial, B2B deal close rate, DealEcho",
  });

  const [isAnnual, setIsAnnual] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    type: "success" | "info" | "error";
  } | null>(null);
  const [monthlyAmount, setMonthlyAmount] = useState(15);
  const [annualAmount, setAnnualAmount] = useState(144);
  const [priceCurrency, setPriceCurrency] = useState("AUD");
  const [hasUsedTrial, setHasUsedTrial] = useState(false);

  const { search } = useLocation();
  const navigate = useNavigate();
  const { refreshClaims } = useAuth();
  const functions = getFunctions(undefined, "australia-southeast1");

  // Fetch dynamic pricing from Firestore
  useEffect(() => {
    const fetchPricing = async () => {
      try {
        const snap = await getDoc(doc(db, "config", "pricing"));
        if (snap.exists()) {
          const data = snap.data();
          if (data.monthlyAmount) setMonthlyAmount(data.monthlyAmount / 100);
          if (data.annualAmount) setAnnualAmount(data.annualAmount / 100);
          if (data.currency) setPriceCurrency(data.currency.toUpperCase());
        }
      } catch {
        // Use defaults if fetch fails
      }
    };
    fetchPricing();
  }, []);

  // Fetch user trial eligibility
  useEffect(() => {
    if (!user) {
      setHasUsedTrial(false);
      return;
    }
    const fetchEligibility = async () => {
      try {
        const snap = await getDoc(doc(db, "users", user.id));
        if (snap.exists()) {
          setHasUsedTrial(!!snap.data()?.hasUsedTrial);
        }
      } catch (err) {
        console.error("Error fetching trial eligibility:", err);
      }
    };
    fetchEligibility();
  }, [user]);

  // ── Handle redirect back from Stripe ──────────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(search);
    if (params.get("checkout") === "success") {
      setMessage({
        text: "Activating your Sales Pro membership…",
        type: "info",
      });
      // Clean up URL immediately
      navigate("/pricing", { replace: true });

      // The Stripe webhook may take a few seconds to fire and update Firestore/claims.
      // Poll refreshClaims with retries so the UI picks up the new role.
      let attempts = 0;
      const maxAttempts = 10;
      const poll = async () => {
        attempts++;
        await refreshClaims();
        // After refreshClaims, the useAuth hook will have the latest role.
        // We can't read isPaid directly here (stale closure), so we re-check via auth token.
        const { getIdTokenResult } = await import("firebase/auth");
        const { auth: appAuth } = await import("../src/firebase/config");
        if (appAuth.currentUser) {
          const tokenResult = await getIdTokenResult(appAuth.currentUser, true);
          if (
            tokenResult.claims.role === "paid" ||
            tokenResult.claims.role === "admin" ||
            tokenResult.claims.role === "free_full"
          ) {
            setMessage({
              text: "Upgrade successful! Welcome to Sales Pro. 🎉",
              type: "success",
            });
            return;
          }
        }
        if (attempts < maxAttempts) {
          setTimeout(poll, 3000); // retry every 3 seconds
        } else {
          setMessage({
            text: "Payment received! Your membership will activate shortly. Please refresh if needed.",
            type: "success",
          });
        }
      };
      // Start polling after a short initial delay to give webhook time
      setTimeout(poll, 2000);
    } else if (params.get("checkout") === "cancelled") {
      setMessage({
        text: "Checkout cancelled. No charges were made.",
        type: "info",
      });
      navigate("/pricing", { replace: true });
    }
  }, [search, navigate, refreshClaims]);

  const handleSubscribe = async () => {
    if (!user) {
      setMessage({
        text: "Please sign in to upgrade your account.",
        type: "info",
      });
      return;
    }

    setIsProcessing(true);
    try {
      const createSession = httpsCallable<
        { plan: "monthly" | "annual" },
        { sessionUrl: string }
      >(functions, "createCheckoutSession");
      const result = await createSession({
        plan: isAnnual ? "annual" : "monthly",
      });

      if (result.data.sessionUrl) {
        window.location.href = result.data.sessionUrl;
      }
    } catch (err: any) {
      console.error("Subscription error:", err);
      setMessage({
        text: err.message || "Failed to start checkout. Please try again.",
        type: "error",
      });
      setIsProcessing(false);
    }
  };

  return (
    <div className="py-20 px-6 max-w-7xl mx-auto">
      {/* Toast-style notice */}
      {message && (
        <div
          className={`fixed top-24 right-6 z-50 px-6 py-4 rounded-2xl shadow-2xl font-bold text-sm flex items-center gap-3 animate-fade-in ${
            message.type === "success"
              ? "bg-emerald-600 text-white"
              : message.type === "error"
                ? "bg-rose-600 text-white"
                : "bg-slate-900 text-white"
          }`}
        >
          <i
            className={`fas ${message.type === "success" ? "fa-check-circle" : "fa-info-circle"}`}
          ></i>
          {message.text}
          <button
            onClick={() => setMessage(null)}
            className="ml-2 hover:opacity-60 transition-opacity"
          >
            <i className="fas fa-times"></i>
          </button>
        </div>
      )}

      <div className="text-center mb-16 space-y-4">
        {!isPaid && !hasUsedTrial && (
          <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-emerald-600 text-white text-[11px] font-black uppercase tracking-widest mb-4 shadow-lg shadow-emerald-600/20 animate-pulse">
            <i className="fas fa-gift text-sm"></i> Limited Offer: First Month Free
          </div>
        )}
        <h1 className="text-4xl md:text-6xl font-black text-[#1e293b] tracking-tight">
          Invest in your <span className="text-[#4f46e5]">Closing Rate</span>.
        </h1>
        <p className="text-slate-500 text-lg md:text-xl max-w-2xl mx-auto font-medium">
          Unlock deep-dive AI personas, MEDDPICC blueprints, and unlimited
          account tracking.
        </p>

        <div className="flex items-center justify-center space-x-4 pt-8">
          <span
            className={`text-sm font-bold ${!isAnnual ? "text-slate-900" : "text-slate-400"}`}
          >
            Monthly
          </span>
          <button
            onClick={() => setIsAnnual(!isAnnual)}
            className="w-14 h-8 bg-indigo-100 rounded-full p-1 transition-all flex items-center"
          >
            <div
              className={`w-6 h-6 bg-indigo-600 rounded-full transition-all transform ${isAnnual ? "translate-x-6" : "translate-x-0"}`}
            ></div>
          </button>
          <span
            className={`text-sm font-bold ${isAnnual ? "text-slate-900" : "text-slate-400"}`}
          >
            Annual{" "}
            <span className="text-emerald-500 text-[10px] ml-1">Save 20%</span>
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
        {/* Free Plan */}
        <div className="bg-white border-2 border-slate-50 p-10 rounded-[40px] flex flex-col h-full hover:border-slate-100 transition-all">
          <div className="mb-8">
            <h3 className="text-xl font-black text-slate-900 mb-2">Pioneer</h3>
            <div className="text-4xl font-black text-slate-900">A$0</div>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-2">
              Free Forever
            </p>
          </div>

          <ul className="space-y-4 mb-10 flex-grow">
            {[
              "Search Companies",
              "Basic Review Feeds",
              "Submit Intelligence",
              "3 Tracked Accounts",
            ].map((item) => (
              <li
                key={item}
                className="flex items-center text-slate-600 text-sm font-medium"
              >
                <i className="fas fa-check text-emerald-500 mr-3"></i>
                {item}
              </li>
            ))}
          </ul>

          <button className="w-full py-4 rounded-2xl border-2 border-slate-100 text-slate-400 font-bold text-sm cursor-not-allowed">
            Current Plan
          </button>
        </div>

        {/* Pro Plan */}
        <div className="bg-[#101426] p-10 rounded-[40px] flex flex-col h-full text-white relative overflow-hidden shadow-2xl shadow-indigo-100">
          <div className="absolute top-0 right-0 bg-indigo-600 text-[10px] font-black uppercase tracking-widest px-6 py-2 rounded-bl-2xl">
            Recommended
          </div>

          <div className="mb-8">
            <h3 className="text-xl font-black mb-2">Sales Pro Intel</h3>
            <div className="flex items-baseline">
              <span className="text-4xl font-black">
                {priceCurrency}${isAnnual ? annualAmount : monthlyAmount}
              </span>
              <span className="text-slate-400 text-sm ml-2">
                / {isAnnual ? "year" : "month"}
              </span>
            </div>
            <p className="text-indigo-400 text-xs font-bold uppercase tracking-widest mt-2">
              {isAnnual
                ? `Billed Annually ($${(annualAmount / 12).toFixed(0)}/mo) (${priceCurrency})`
                : `Billed Monthly (${priceCurrency})`}
            </p>
            {!isPaid && !hasUsedTrial && (
              <div className="mt-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-2 flex items-center gap-2 text-emerald-400 text-xs font-bold w-fit">
                <i className="fas fa-gift text-sm animate-bounce"></i>
                First Month $0 — 30-Day Free Trial
              </div>
            )}
          </div>

          <ul className="space-y-4 mb-10 flex-grow">
            {[
              "Unlimited Tracked Accounts",
              "AI Account Persona Intelligence",
              "Deep-dive MEDDPICC Blueprints",
              "Departmental Playbooks",
              "Live Notification Alerts",
            ].map((item) => (
              <li
                key={item}
                className="flex items-center text-slate-300 text-sm font-medium"
              >
                <i className="fas fa-star text-indigo-400 mr-3"></i>
                {item}
              </li>
            ))}
          </ul>

          {isPaid ? (
            <button className="w-full py-4 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 font-black text-sm uppercase tracking-widest">
              Active Subscription
            </button>
          ) : (
            <div className="space-y-3">
              <button
                onClick={handleSubscribe}
                disabled={isProcessing}
                className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-lg ${
                  !hasUsedTrial
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-900/20"
                    : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-900/20"
                }`}
              >
                {isProcessing ? (
                  <i className="fas fa-spinner fa-spin"></i>
                ) : !hasUsedTrial ? (
                  "Start 30-Day Free Trial"
                ) : (
                  "Upgrade to Pro"
                )}
              </button>
              
              {!hasUsedTrial && (
                <p className="text-[11px] text-slate-400 text-center font-medium leading-normal">
                  <i className="fas fa-lock mr-1.5 text-slate-500"></i>
                  $0 today. Billed after 30 days. Cancel anytime.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="mt-20 bg-slate-50 p-12 rounded-[48px] text-center border border-slate-100">
        <h4 className="text-xl font-bold text-slate-900 mb-4">
          The Enterprise Choice
        </h4>
        <p className="text-slate-500 max-w-xl mx-auto text-sm leading-relaxed mb-8">
          Need a license for your whole sales team? Get centralized billing,
          admin controls, and private data silos.
        </p>
        <button className="text-indigo-600 font-black text-[11px] uppercase tracking-[0.2em] border-b-2 border-indigo-100 hover:border-indigo-600 transition-all">
          Contact Sales for Enterprise
        </button>
      </div>
    </div>
  );
};

export default Pricing;
