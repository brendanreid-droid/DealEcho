import React, { useState } from "react";
import Icon from "./Icon";
import { track } from "../utils/analytics";

/**
 * Three-step cancellation / retention flow:
 *   1. confirm  - "are you sure?"
 *   2. offer    - a save-offer discount (tailored to monthly vs annual)
 *   3. reason   - why they're leaving (options + free text), then cancel
 *
 * The parent owns the async actions; this component drives the steps and
 * collects input. onApplyOffer keeps the user Pro; onConfirmCancel downgrades.
 */

export type RetentionOffer = "monthly_discount" | "annual_discount";

export const CANCEL_REASONS = [
  "Too expensive",
  "Not using it enough",
  "Missing features I need",
  "Found an alternative",
  "Only needed it temporarily",
  "Other",
] as const;

interface Props {
  isOpen: boolean;
  /** "paid_annual" hides the switch-to-annual offer. */
  tier: string;
  onClose: () => void;
  onApplyOffer: (offer: RetentionOffer) => Promise<void>;
  onConfirmCancel: (reason: string, reasonText: string) => Promise<void>;
}

type Step = "confirm" | "offer" | "reason";

const RetentionModal: React.FC<Props> = ({
  isOpen,
  tier,
  onClose,
  onApplyOffer,
  onConfirmCancel,
}) => {
  const [step, setStep] = useState<Step>("confirm");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState<string>("");
  const [reasonText, setReasonText] = useState<string>("");

  if (!isOpen) return null;

  const isAnnual = tier === "paid_annual";

  const reset = () => {
    setStep("confirm");
    setBusy(null);
    setError(null);
    setReason("");
    setReasonText("");
  };
  const close = () => {
    reset();
    onClose();
  };

  const applyOffer = async (offer: RetentionOffer) => {
    setBusy(offer);
    setError(null);
    try {
      await onApplyOffer(offer);
      track("retention_offer_accepted", { offer });
      close();
    } catch (err: any) {
      setError(err?.message || "Could not apply the offer. Please try again.");
      setBusy(null);
    }
  };

  const confirmCancel = async () => {
    setBusy("cancel");
    setError(null);
    try {
      await onConfirmCancel(reason, reasonText);
      track("subscription_cancelled", { reason });
      close();
    } catch (err: any) {
      setError(err?.message || "Could not cancel. Please try again.");
      setBusy(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[2000] overflow-y-auto">
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
        onClick={close}
      ></div>
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="bg-white w-full max-w-md rounded-card shadow-2xl relative z-10 overflow-hidden my-8">
          <div className="bg-navy px-8 pt-8 pb-6 text-white relative">
            <div className="absolute top-0 right-0 w-1/2 h-full bg-accent/25 blur-[80px] rounded-full -mr-10 -mt-10"></div>
            <button
              onClick={close}
              aria-label="Close"
              className="absolute top-5 right-5 text-white/50 hover:text-white text-lg font-black z-10"
            >
              &times;
            </button>
            <h2 className="text-2xl font-bold tracking-tight relative z-10">
              {step === "confirm" && "Cancel your subscription?"}
              {step === "offer" && "Before you go"}
              {step === "reason" && "Help us improve"}
            </h2>
            <p className="text-slate-300 text-xs font-semibold relative z-10 mt-2">
              {step === "confirm" &&
                "You'll lose Sales Pro access - full reviews, AI playbooks and unlimited tracking."}
              {step === "offer" && "Here's an exclusive offer to stay."}
              {step === "reason" && "One last thing - why are you leaving?"}
            </p>
          </div>

          <div className="p-6 space-y-4">
            {error && (
              <div className="rounded-control bg-signal-risk/10 border border-signal-risk/30 px-4 py-3 text-[12px] font-semibold text-signal-risk">
                {error}
              </div>
            )}

            {step === "confirm" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between pt-1">
                  <button
                    onClick={() => setStep("offer")}
                    className="text-slate-400 hover:text-slate-600 text-[13px] font-bold"
                  >
                    Continue to cancel
                  </button>
                  <button
                    onClick={close}
                    className="px-6 py-3 rounded-control bg-navy text-white text-[13px] font-black hover:bg-navy/90"
                  >
                    Keep my plan
                  </button>
                </div>
              </div>
            )}

            {step === "offer" && (
              <div className="space-y-3">
                <button
                  onClick={() => applyOffer("monthly_discount")}
                  disabled={busy !== null}
                  className="w-full text-left rounded-control border-2 border-accent/40 bg-accent/5 p-4 hover:border-accent transition-colors disabled:opacity-50"
                >
                  <div className="flex items-center gap-2 text-accent font-black text-sm">
                    <Icon name="fa-star" size={13} />
                    50% off for 2 months
                  </div>
                  <p className="text-slate-500 text-[12px] mt-1">
                    Stay on Sales Pro at half price for your next two payments.
                  </p>
                  {busy === "monthly_discount" && (
                    <span className="text-[11px] text-accent font-bold">
                      Applying…
                    </span>
                  )}
                </button>

                {!isAnnual && (
                  <button
                    onClick={() => applyOffer("annual_discount")}
                    disabled={busy !== null}
                    className="w-full text-left rounded-control border-2 border-slate-100 p-4 hover:border-slate-300 transition-colors disabled:opacity-50"
                  >
                    <div className="flex items-center gap-2 text-slate-900 font-black text-sm">
                      <Icon name="fa-crown" size={13} />
                      Switch to annual, save 20%
                    </div>
                    <p className="text-slate-500 text-[12px] mt-1">
                      Move to yearly billing and lock in 20% off.
                    </p>
                    {busy === "annual_discount" && (
                      <span className="text-[11px] text-accent font-bold">
                        Applying…
                      </span>
                    )}
                  </button>
                )}

                {isAnnual && (
                  <button
                    onClick={() => applyOffer("annual_discount")}
                    disabled={busy !== null}
                    className="w-full text-left rounded-control border-2 border-slate-100 p-4 hover:border-slate-300 transition-colors disabled:opacity-50"
                  >
                    <div className="flex items-center gap-2 text-slate-900 font-black text-sm">
                      <Icon name="fa-crown" size={13} />
                      20% off your next renewal
                    </div>
                    <p className="text-slate-500 text-[12px] mt-1">
                      Stay on annual billing with 20% off.
                    </p>
                    {busy === "annual_discount" && (
                      <span className="text-[11px] text-accent font-bold">
                        Applying…
                      </span>
                    )}
                  </button>
                )}

                <div className="flex items-center justify-between pt-1">
                  <button
                    onClick={() => setStep("reason")}
                    disabled={busy !== null}
                    className="text-slate-400 hover:text-slate-600 text-[13px] font-bold disabled:opacity-50"
                  >
                    No thanks, cancel
                  </button>
                  <button
                    onClick={close}
                    disabled={busy !== null}
                    className="px-6 py-3 rounded-control bg-navy text-white text-[13px] font-black hover:bg-navy/90 disabled:opacity-50"
                  >
                    Keep my plan
                  </button>
                </div>
              </div>
            )}

            {step === "reason" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  {CANCEL_REASONS.map((r) => (
                    <label
                      key={r}
                      className={`flex items-center gap-3 rounded-control border-2 px-4 py-2.5 cursor-pointer transition-colors ${
                        reason === r
                          ? "border-accent bg-accent/5"
                          : "border-slate-100 hover:border-slate-300"
                      }`}
                    >
                      <input
                        type="radio"
                        name="cancel-reason"
                        value={r}
                        checked={reason === r}
                        onChange={() => setReason(r)}
                        className="accent-accent"
                      />
                      <span className="text-[13px] font-semibold text-slate-700">
                        {r}
                      </span>
                    </label>
                  ))}
                </div>
                <textarea
                  value={reasonText}
                  onChange={(e) => setReasonText(e.target.value)}
                  placeholder="Anything else you'd like us to know? (optional)"
                  rows={3}
                  className="w-full px-4 py-3 rounded-control border-2 border-slate-100 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-accent resize-none"
                />
                <div className="flex items-center justify-between pt-1">
                  <button
                    onClick={close}
                    disabled={busy !== null}
                    className="text-slate-400 hover:text-slate-600 text-[13px] font-bold disabled:opacity-50"
                  >
                    Never mind
                  </button>
                  <button
                    onClick={confirmCancel}
                    disabled={busy !== null || !reason}
                    className="px-6 py-3 rounded-control bg-signal-risk text-white text-[13px] font-black hover:bg-signal-risk/90 disabled:opacity-40"
                  >
                    {busy === "cancel" ? "Cancelling…" : "Cancel subscription"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RetentionModal;
