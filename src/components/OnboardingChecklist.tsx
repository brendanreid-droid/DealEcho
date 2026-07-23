import React from "react";
import { useNavigate } from "react-router-dom";
import Icon from "./Icon";
import { saveMarketingProfile } from "./MarketingProfilePrompt";
import { track } from "../utils/analytics";

/**
 * Getting-started checklist that steers new users toward writing their first
 * review (the core contribution) plus tracking an account and answering the
 * profile questions. Steps auto-complete from data already tracked elsewhere -
 * no separate progress state to keep in sync.
 *
 * Two surfaces:
 *  - modal (open === true): shown first session and whenever the user reopens
 *    it from the launcher.
 *  - launcher: a floating progress pill; render it from the parent when the
 *    checklist is incomplete and not dismissed.
 */

// TODO: replace with the real Chrome Web Store URL once the extension is
// published. "#" keeps the step functional (clicking still marks it done).
const EXTENSION_URL = "#";

export interface OnboardingSteps {
  hasReview: boolean;
  hasTracked: boolean;
  hasProfile: boolean;
  hasExtension: boolean;
}

export function onboardingComplete(s: OnboardingSteps): boolean {
  return s.hasReview && s.hasTracked && s.hasProfile && s.hasExtension;
}

function completedCount(s: OnboardingSteps): number {
  return [s.hasReview, s.hasTracked, s.hasProfile, s.hasExtension].filter(
    Boolean,
  ).length;
}

interface ModalProps {
  open: boolean;
  steps: OnboardingSteps;
  /** Active review unlock expiry (ISO) if the reward is already earned. */
  reviewUnlockUntil: string | null;
  onClose: () => void;
  onDismiss: () => void;
  onAnswerQuestions: () => void;
}

const STEP_TOTAL = 4;

export const OnboardingChecklistModal: React.FC<ModalProps> = ({
  open,
  steps,
  reviewUnlockUntil,
  onClose,
  onDismiss,
  onAnswerQuestions,
}) => {
  const navigate = useNavigate();
  if (!open) return null;

  const done = completedCount(steps);
  const pct = Math.round((done / STEP_TOTAL) * 100);

  const go = (path: string, label: string) => {
    track("onboarding_step_click", { step: label });
    onClose();
    navigate(path);
  };

  const items: {
    key: string;
    done: boolean;
    title: string;
    body: string;
    cta: string;
    action: () => void;
  }[] = [
    {
      key: "review",
      done: steps.hasReview,
      title: "Write your first review",
      body: "Share one deal. It unlocks 7 days of full review access across every company.",
      cta: "Write a review",
      action: () => go("/review/new", "review"),
    },
    {
      key: "track",
      done: steps.hasTracked,
      title: "Track your first account",
      body: "Follow a company to get alerts when new intel lands.",
      cta: "Find a company",
      action: () => go("/search", "track"),
    },
    {
      key: "profile",
      done: steps.hasProfile,
      title: "Tell us about you",
      body: "Two taps - your role and company size. Helps us tailor Dealecho.",
      cta: "Answer",
      action: () => {
        track("onboarding_step_click", { step: "profile" });
        onAnswerQuestions();
      },
    },
    {
      key: "extension",
      done: steps.hasExtension,
      title: "Get the browser extension",
      body: "Pull deal intel and log reviews without leaving your CRM or inbox.",
      cta: "Get the extension",
      action: () => {
        track("onboarding_step_click", { step: "extension" });
        // Mark done on click; we can't detect the actual install. Opens the
        // store in a new tab once EXTENSION_URL is a real link.
        void saveMarketingProfile({ extensionAdded: true });
        if (EXTENSION_URL !== "#") {
          window.open(EXTENSION_URL, "_blank", "noopener,noreferrer");
        }
      },
    },
  ];

  const allDone = done === STEP_TOTAL;

  return (
    <div className="fixed inset-0 z-[2000] overflow-y-auto">
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
        onClick={onClose}
      ></div>
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="bg-white w-full max-w-md rounded-card shadow-2xl relative z-10 overflow-hidden my-8">
          <div className="bg-navy px-8 pt-8 pb-6 text-white relative">
            <div className="absolute top-0 right-0 w-1/2 h-full bg-accent/25 blur-[80px] rounded-full -mr-10 -mt-10"></div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="absolute top-5 right-5 text-white/50 hover:text-white text-lg font-black z-10"
            >
              &times;
            </button>
            <h2 className="text-2xl font-bold tracking-tight relative z-10">
              {allDone ? "You're all set" : "Get started on Dealecho"}
            </h2>
            <p className="text-slate-300 text-xs font-semibold relative z-10 mt-2">
              {allDone
                ? "Nice work - you've completed setup."
                : `${done} of ${STEP_TOTAL} done. Writing a review unlocks full access.`}
            </p>
            <div className="relative z-10 mt-4 h-2 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full bg-accent rounded-full transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          <div className="p-6 space-y-3">
            {items.map((item) => (
              <div
                key={item.key}
                className={`flex items-start gap-3 rounded-control border-2 p-4 transition-colors ${
                  item.done
                    ? "border-signal-healthy/30 bg-signal-healthy/5"
                    : "border-slate-100"
                }`}
              >
                <div
                  className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                    item.done
                      ? "bg-signal-healthy text-white"
                      : "bg-slate-100 text-slate-400"
                  }`}
                >
                  {item.done ? (
                    <Icon name="fa-check" size={11} />
                  ) : (
                    <span className="text-[11px] font-black">
                      {items.indexOf(item) + 1}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-sm font-bold ${
                      item.done ? "text-slate-400 line-through" : "text-slate-900"
                    }`}
                  >
                    {item.title}
                  </p>
                  {!item.done && (
                    <>
                      <p className="text-slate-500 text-[12px] mt-0.5 leading-relaxed">
                        {item.body}
                      </p>
                      <button
                        onClick={item.action}
                        className="mt-2 text-accent hover:text-accent/80 text-[13px] font-black inline-flex items-center gap-1"
                      >
                        {item.cta}
                        <Icon name="fa-arrow-right" size={11} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}

            {reviewUnlockUntil &&
              new Date(reviewUnlockUntil).getTime() > Date.now() && (
                <div className="rounded-control bg-accent/5 border border-accent/20 px-4 py-3 text-[12px] font-semibold text-accent">
                  Full review access unlocked until{" "}
                  {new Date(reviewUnlockUntil).toLocaleDateString()}.
                </div>
              )}

            <div className="flex items-center justify-between pt-1">
              <button
                onClick={onDismiss}
                className="text-slate-400 hover:text-slate-600 text-[12px] font-bold"
              >
                Don't show again
              </button>
              <button
                onClick={onClose}
                className="px-5 py-2.5 rounded-control bg-navy text-white text-[13px] font-black hover:bg-navy/90"
              >
                {allDone ? "Done" : "Later"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface LauncherProps {
  steps: OnboardingSteps;
  onOpen: () => void;
}

export const OnboardingLauncher: React.FC<LauncherProps> = ({
  steps,
  onOpen,
}) => {
  const done = completedCount(steps);
  return (
    <button
      onClick={onOpen}
      className="fixed bottom-5 right-5 z-[1500] flex items-center gap-2 rounded-full bg-navy text-white px-4 py-3 shadow-2xl hover:bg-navy/90 transition-all"
    >
      <Icon name="fa-check-circle" size={13} />
      <span className="text-[13px] font-black">
        Getting started {done}/{STEP_TOTAL}
      </span>
    </button>
  );
};

/** Persist permanent dismissal server-side (best-effort). */
export function dismissOnboarding(): void {
  void saveMarketingProfile({ onboardingDismissed: true });
  track("onboarding_dismissed");
}
