import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  getConsent,
  setConsent,
  ACCEPT_ALL,
  NECESSARY_ONLY,
  type ConsentState,
} from "../utils/consent";
import { captureAttribution } from "../utils/attribution";
import { track } from "../utils/analytics";

/** Event other components (e.g. the footer link) dispatch to reopen the banner
 *  so visitors can change a saved choice. */
const OPEN_EVENT = "dealecho:open-cookie-preferences";

/** Call from anywhere to let the visitor review/change their cookie choice. */
export function openCookiePreferences(): void {
  window.dispatchEvent(new CustomEvent(OPEN_EVENT));
}

/** Apply a freshly-saved choice to the live page: start analytics and/or
 *  capture attribution immediately, without a reload. */
function applyChoice(state: ConsentState): void {
  setConsent(state);
  if (state.marketing) captureAttribution();
  if (state.analytics) {
    track("page_view", {
      page_path: window.location.pathname,
      page_location: window.location.href,
    });
  }
}

const CookieConsent: React.FC = () => {
  // Show automatically on first visit (no saved choice).
  const [open, setOpen] = useState(false);
  const [managing, setManaging] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    if (getConsent() === null) setOpen(true);
    const reopen = () => {
      const current = getConsent();
      setAnalytics(current?.analytics ?? false);
      setMarketing(current?.marketing ?? false);
      setManaging(true);
      setOpen(true);
    };
    window.addEventListener(OPEN_EVENT, reopen);
    return () => window.removeEventListener(OPEN_EVENT, reopen);
  }, []);

  if (!open) return null;

  const close = () => {
    setOpen(false);
    setManaging(false);
  };

  const choose = (state: ConsentState) => {
    applyChoice(state);
    close();
  };

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="Cookie preferences"
      className="fixed inset-x-0 bottom-0 z-[60] p-4 sm:p-6"
    >
      <div className="mx-auto max-w-4xl rounded-card border border-slate-200 bg-white shadow-2xl p-5 sm:p-6">
        {!managing ? (
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="text-sm text-slate-600 leading-relaxed md:pr-6">
              <p className="font-semibold text-slate-800 mb-1">We use cookies</p>
              <p>
                We use essential cookies to run Dealecho, and — with your consent —
                analytics and marketing cookies to understand usage and measure our
                campaigns. See our{" "}
                <Link to="/privacy" className="text-accent hover:underline font-medium">
                  Privacy Policy
                </Link>
                .
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 shrink-0">
              <button
                onClick={() => choose(NECESSARY_ONLY)}
                className="px-4 py-2 rounded-full text-sm font-semibold border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Necessary only
              </button>
              <button
                onClick={() => choose(ACCEPT_ALL)}
                className="px-4 py-2 rounded-full text-sm font-semibold bg-accent text-white hover:opacity-90 transition-opacity"
              >
                Accept all
              </button>
              <button
                onClick={() => {
                  const current = getConsent();
                  setAnalytics(current?.analytics ?? false);
                  setMarketing(current?.marketing ?? false);
                  setManaging(true);
                }}
                className="px-4 py-2 rounded-full text-sm font-medium text-slate-500 hover:text-accent transition-colors"
              >
                Manage
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <p className="font-semibold text-slate-800">Cookie preferences</p>
              <button
                onClick={close}
                aria-label="Close"
                className="text-slate-400 hover:text-slate-600 text-lg leading-none"
              >
                ×
              </button>
            </div>

            <ul className="space-y-3 text-sm">
              <li className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3">
                <div className="text-slate-600">
                  <p className="font-medium text-slate-800">Necessary</p>
                  <p className="text-slate-500">
                    Required for sign-in and to remember this choice. Always on.
                  </p>
                </div>
                <span className="text-xs font-semibold text-slate-400 mt-1 whitespace-nowrap">
                  Always on
                </span>
              </li>

              <li className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3">
                <div className="text-slate-600">
                  <p className="font-medium text-slate-800">Analytics</p>
                  <p className="text-slate-500">
                    Google Analytics, to understand how the product is used.
                  </p>
                </div>
                <Toggle checked={analytics} onChange={setAnalytics} label="Analytics cookies" />
              </li>

              <li className="flex items-start justify-between gap-4 pb-1">
                <div className="text-slate-600">
                  <p className="font-medium text-slate-800">Marketing</p>
                  <p className="text-slate-500">
                    Attribution of visits to our marketing campaigns.
                  </p>
                </div>
                <Toggle checked={marketing} onChange={setMarketing} label="Marketing cookies" />
              </li>
            </ul>

            <div className="flex flex-col sm:flex-row gap-2 justify-end">
              <button
                onClick={() => choose(NECESSARY_ONLY)}
                className="px-4 py-2 rounded-full text-sm font-semibold border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Reject all
              </button>
              <button
                onClick={() => choose({ analytics, marketing })}
                className="px-4 py-2 rounded-full text-sm font-semibold bg-accent text-white hover:opacity-90 transition-opacity"
              >
                Save preferences
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const Toggle: React.FC<{
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}> = ({ checked, onChange, label }) => (
  <button
    role="switch"
    aria-checked={checked}
    aria-label={label}
    onClick={() => onChange(!checked)}
    className={`relative shrink-0 mt-1 w-10 h-6 rounded-full transition-colors ${
      checked ? "bg-accent" : "bg-slate-300"
    }`}
  >
    <span
      className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
        checked ? "translate-x-4" : ""
      }`}
    />
  </button>
);

export default CookieConsent;
