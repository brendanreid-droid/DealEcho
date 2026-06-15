import React, { useState, useEffect } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";
import { useLocation, useNavigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../src/firebase/config";
import { useAuth } from "../src/hooks/useAuth";
import { useSEO } from "../src/hooks/useSEO";
import Icon from "../src/components/Icon";

interface PricingProps {
  user: any;
  isPaid: boolean;
}

const Pricing: React.FC<PricingProps> = ({ user, isPaid }) => {
  useSEO({
    title: "DealEcho Pricing - Unlock Advanced B2B Buyer Intelligence & Playbooks",
    description:
      "Scale your closing rate. Start a 30-day free trial of Sales Pro to access unlimited account tracking, AI MEDDPICC strategic blueprints, and stakeholder buying team personas.",
    keywords:
      "Sales Pro pricing, sales intelligence subscription, MEDDPICC trial, B2B deal close rate, DealEcho",
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
        /* defaults */
      }
    };
    fetchPricing();
  }, []);

  useEffect(() => {
    if (!user) {
      setHasUsedTrial(false);
      return;
    }
    const fetchEligibility = async () => {
      try {
        const snap = await getDoc(doc(db, "users", user.id));
        if (snap.exists()) setHasUsedTrial(!!snap.data()?.hasUsedTrial);
      } catch (err) {
        console.error("Error fetching trial eligibility:", err);
      }
    };
    fetchEligibility();
  }, [user]);

  useEffect(() => {
    const params = new URLSearchParams(search);
    if (params.get("checkout") === "success") {
      setMessage({ text: "Activating your Sales Pro membership…", type: "info" });
      navigate("/pricing", { replace: true });
      let attempts = 0;
      const maxAttempts = 10;
      const poll = async () => {
        attempts++;
        await refreshClaims();
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
              text: "Upgrade successful! Welcome to Sales Pro.",
              type: "success",
            });
            return;
          }
        }
        if (attempts < maxAttempts) setTimeout(poll, 3000);
        else
          setMessage({
            text: "Payment received! Your membership will activate shortly. Please refresh if needed.",
            type: "success",
          });
      };
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
      setMessage({ text: "Please sign in to upgrade your account.", type: "info" });
      return;
    }
    setIsProcessing(true);
    try {
      const createSession = httpsCallable<
        { plan: "monthly" | "annual" },
        { sessionUrl: string }
      >(functions, "createCheckoutSession");
      const result = await createSession({ plan: isAnnual ? "annual" : "monthly" });
      if (result.data.sessionUrl) window.location.href = result.data.sessionUrl;
    } catch (err: any) {
      console.error("Subscription error:", err);
      setMessage({
        text: err.message || "Failed to start checkout. Please try again.",
        type: "error",
      });
      setIsProcessing(false);
    }
  };

  const proFeatures = [
    "Unlimited tracked accounts",
    "AI account persona intelligence",
    "Deep-dive MEDDPICC blueprints",
    "Departmental playbooks",
    "Live notification alerts",
  ];
  const freeFeatures = [
    "Search companies",
    "Basic review feeds",
    "Submit intelligence",
    "3 tracked accounts",
  ];

  return (
    <div className="py-20 px-6 max-w-7xl mx-auto">
      {message && (
        <div
          className={`fixed top-20 right-6 z-50 px-5 py-4 rounded-card shadow-lift font-semibold text-sm flex items-center gap-3 ${
            message.type === "success"
              ? "bg-signal-healthy text-white"
              : message.type === "error"
                ? "bg-signal-risk text-white"
                : "bg-navy text-white"
          }`}
        >
          <Icon name={message.type === "success" ? "fa-check-circle" : "fa-info-circle"} size={16} />
          {message.text}
          <button onClick={() => setMessage(null)} className="ml-2 hover:opacity-60" aria-label="Dismiss">
            <Icon name="fa-times" size={16} />
          </button>
        </div>
      )}

      <div className="text-center mb-16 space-y-4">
        {!isPaid && !hasUsedTrial && (
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-signal-healthy text-white text-2xs font-bold uppercase tracking-wider mb-4 shadow-lg shadow-emerald-600/20">
            <Icon name="fa-gift" size={14} /> Limited offer: first month free
          </div>
        )}
        <h1 className="font-display text-4xl md:text-6xl font-bold text-navy tracking-tight">
          Invest in your <span className="text-accent">closing rate</span>.
        </h1>
        <p className="text-slate-500 text-lg md:text-xl max-w-2xl mx-auto">
          Unlock deep-dive AI personas, MEDDPICC blueprints, and unlimited account tracking.
        </p>

        <div className="flex items-center justify-center gap-4 pt-8">
          <span className={`text-sm font-semibold ${!isAnnual ? "text-slate-900" : "text-slate-400"}`}>
            Monthly
          </span>
          <button
            onClick={() => setIsAnnual(!isAnnual)}
            className="w-14 h-8 bg-accent-100 rounded-full p-1 flex items-center"
            aria-label="Toggle annual billing"
          >
            <div
              className={`w-6 h-6 bg-accent rounded-full transition-transform ${isAnnual ? "translate-x-6" : "translate-x-0"}`}
            />
          </button>
          <span className={`text-sm font-semibold flex items-center gap-1.5 ${isAnnual ? "text-slate-900" : "text-slate-400"}`}>
            Annual
            <span className="text-signal-healthy text-2xs bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5">
              Save 20%
            </span>
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
        {/* Free */}
        <div className="de-card p-10 flex flex-col h-full">
          <div className="mb-8">
            <h3 className="text-xl font-bold text-slate-900 mb-2">Pioneer</h3>
            <div className="font-display text-4xl font-bold text-slate-900">A$0</div>
            <p className="text-slate-400 text-2xs font-semibold uppercase tracking-wider mt-2">
              Free forever
            </p>
          </div>
          <ul className="space-y-3.5 mb-10 flex-grow">
            {freeFeatures.map((item) => (
              <li key={item} className="flex items-center text-slate-600 text-sm">
                <Icon name="fa-check" size={16} className="text-signal-healthy mr-3" />
                {item}
              </li>
            ))}
          </ul>
          <button className="w-full py-4 rounded-control border-2 border-slate-100 text-slate-400 font-semibold text-sm cursor-not-allowed">
            Current plan
          </button>
        </div>

        {/* Pro */}
        <div className="bg-navy p-10 rounded-card flex flex-col h-full text-white relative overflow-hidden shadow-lift">
          <div className="absolute top-0 right-0 bg-accent text-2xs font-bold uppercase tracking-wider px-5 py-2 rounded-bl-card">
            Recommended
          </div>
          <div className="mb-8">
            <h3 className="text-xl font-bold mb-2">Sales Pro Intel</h3>
            <div className="flex items-baseline">
              <span className="font-display text-4xl font-bold">
                {priceCurrency}${isAnnual ? annualAmount : monthlyAmount}
              </span>
              <span className="text-slate-400 text-sm ml-2">/ {isAnnual ? "year" : "month"}</span>
            </div>
            <p className="text-accent-soft text-2xs font-semibold uppercase tracking-wider mt-2">
              {isAnnual
                ? `Billed annually ($${(annualAmount / 12).toFixed(0)}/mo) (${priceCurrency})`
                : `Billed monthly (${priceCurrency})`}
            </p>
            {!isPaid && !hasUsedTrial && (
              <div className="mt-3 bg-emerald-500/10 border border-emerald-500/20 rounded-control px-4 py-2 flex items-center gap-2 text-signal-healthy-bright text-xs font-semibold w-fit">
                <Icon name="fa-gift" size={14} /> First month $0 — 30-day free trial
              </div>
            )}
          </div>
          <ul className="space-y-3.5 mb-10 flex-grow">
            {proFeatures.map((item) => (
              <li key={item} className="flex items-center text-slate-300 text-sm">
                <Icon name="fa-star" size={15} className="text-accent-soft mr-3" />
                {item}
              </li>
            ))}
          </ul>
          {isPaid ? (
            <button className="w-full py-4 rounded-control bg-accent-500/20 border border-accent-500/30 text-accent-soft font-bold text-sm uppercase tracking-wider">
              Active subscription
            </button>
          ) : (
            <div className="space-y-3">
              <button
                onClick={handleSubscribe}
                disabled={isProcessing}
                className={`w-full py-4 rounded-control font-bold text-sm uppercase tracking-wider transition-all shadow-lg ${
                  !hasUsedTrial
                    ? "bg-signal-healthy hover:bg-emerald-700 text-white"
                    : "bg-accent hover:bg-accent-700 text-white"
                }`}
              >
                {isProcessing ? "Processing…" : !hasUsedTrial ? "Start 30-day free trial" : "Upgrade to Pro"}
              </button>
              {!hasUsedTrial && (
                <p className="text-2xs text-slate-400 text-center leading-normal flex items-center justify-center gap-1.5">
                  <Icon name="fa-lock" size={11} className="text-slate-500" />
                  $0 today. Billed after 30 days. Cancel anytime.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="mt-20 de-card p-12 text-center">
        <h4 className="font-display text-xl font-semibold text-slate-900 mb-4">
          The enterprise choice
        </h4>
        <p className="text-slate-500 max-w-xl mx-auto text-sm leading-relaxed mb-8">
          Need a license for your whole sales team? Get centralized billing, admin
          controls, and private data silos.
        </p>
        <button className="text-accent font-bold text-2xs uppercase tracking-[0.2em] border-b-2 border-accent-100 hover:border-accent transition-all pb-0.5">
          Contact sales for enterprise
        </button>
      </div>
    </div>
  );
};

export default Pricing;
