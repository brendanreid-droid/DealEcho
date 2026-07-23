import React, { useState } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";
import { track } from "../utils/analytics";

/**
 * Post-signup role capture. Two surfaces share one callable:
 *  - MarketingProfileModal: skippable interstitial shown right after signup.
 *  - MarketingProfileBanner: one-line re-ask shown from the ~3rd session when
 *    the modal was skipped. Dismissing the banner is permanent (server-side).
 * Answers feed the admin marketing dashboard; must never block the app.
 */

export const ROLE_OPTIONS = [
  { value: "sales", label: "Sales" },
  { value: "procurement", label: "Procurement" },
  { value: "founder", label: "Founder / Exec" },
  { value: "finance", label: "Finance" },
  { value: "other", label: "Other" },
] as const;

export const SIZE_OPTIONS = ["1-10", "11-50", "51-200", "200+"] as const;

export async function saveMarketingProfile(payload: {
  role?: string;
  companySize?: string;
  dismissed?: boolean;
}): Promise<void> {
  try {
    const fn = httpsCallable(
      getFunctions(undefined, "australia-southeast1"),
      "updateMarketingProfile",
    );
    await fn(payload);
  } catch {
    /* profile capture must never break the app */
  }
}

const chipClass = (selected: boolean) =>
  `px-4 py-2 rounded-control border-2 text-[13px] font-bold transition-all ${
    selected
      ? "bg-navy border-navy text-white shadow"
      : "bg-slate-50 border-slate-100 text-slate-600 hover:border-slate-300"
  }`;

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MarketingProfileModal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [role, setRole] = useState<string | null>(null);
  const [size, setSize] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const submit = async () => {
    if (!role) return;
    setSaving(true);
    await saveMarketingProfile({
      role,
      ...(size ? { companySize: size } : {}),
    });
    track("marketing_role_submitted", { role, company_size: size ?? "" });
    setSaving(false);
    onClose();
  };

  const skip = () => {
    track("marketing_role_skipped");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[2000] overflow-y-auto">
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
        onClick={skip}
      ></div>
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="bg-white w-full max-w-md rounded-card shadow-2xl relative z-10 overflow-hidden my-8">
          <div className="bg-navy px-10 pt-10 pb-8 text-white relative">
            <div className="absolute top-0 right-0 w-1/2 h-full bg-accent/25 blur-[80px] rounded-full -mr-10 -mt-10"></div>
            <h2 className="text-2xl font-bold tracking-tight relative z-10">
              One quick question
            </h2>
            <p className="text-slate-300 text-xs font-semibold leading-relaxed relative z-10 mt-2">
              Helps us make Dealecho more useful for people like you. Two taps,
              or skip it.
            </p>
          </div>
          <div className="p-10 space-y-6">
            <div>
              <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-3">
                What best describes your role?
              </p>
              <div className="flex flex-wrap gap-2">
                {ROLE_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => setRole(o.value)}
                    aria-pressed={role === o.value}
                    className={chipClass(role === o.value)}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-3">
                Company size{" "}
                <span className="text-slate-300 normal-case tracking-normal font-semibold">
                  (optional)
                </span>
              </p>
              <div className="flex flex-wrap gap-2">
                {SIZE_OPTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSize(size === s ? null : s)}
                    aria-pressed={size === s}
                    className={chipClass(size === s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={skip}
                className="text-slate-400 hover:text-slate-600 text-[13px] font-bold transition-colors"
              >
                Skip
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={!role || saving}
                className="px-6 py-3 rounded-control bg-navy text-white text-[13px] font-black transition-all hover:bg-navy/90 disabled:opacity-40 shadow"
              >
                {saving ? "Saving..." : "Done"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface BannerProps {
  onAnswered: () => void;
  onDismissed: () => void;
}

export const MarketingProfileBanner: React.FC<BannerProps> = ({
  onAnswered,
  onDismissed,
}) => {
  const [saving, setSaving] = useState<string | null>(null);

  const answer = async (role: string) => {
    setSaving(role);
    await saveMarketingProfile({ role });
    track("marketing_role_submitted", { role, source: "banner" });
    onAnswered();
  };

  const dismiss = () => {
    void saveMarketingProfile({ dismissed: true });
    track("marketing_role_dismissed");
    onDismissed();
  };

  return (
    <div className="bg-navy text-white">
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="text-[13px] font-bold">
          Quick one - what best describes your role?
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          {ROLE_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => answer(o.value)}
              disabled={saving !== null}
              className="px-3 py-1 rounded-full bg-white/10 hover:bg-white/25 border border-white/20 text-[12px] font-bold transition-all disabled:opacity-50"
            >
              {saving === o.value ? "Saving..." : o.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="ml-auto text-white/50 hover:text-white text-sm font-black transition-colors px-2"
        >
          &times;
        </button>
      </div>
    </div>
  );
};
