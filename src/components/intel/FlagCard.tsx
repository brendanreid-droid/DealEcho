import React from "react";
import { AccountFlag, pointId } from "../../../services/accountFlags";

const RISK_ACCENT: Record<AccountFlag["severity"], string> = {
  critical: "border-l-signal-risk",
  caution: "border-l-signal-caution",
  watch: "border-l-slate-300",
};

const RISK_TEXT: Record<AccountFlag["severity"], string> = {
  critical: "text-signal-risk",
  caution: "text-signal-caution",
  watch: "text-slate-500",
};

/** Polarity wins over severity - a strength always renders green regardless of its severity. */
const accentFor = (flag: AccountFlag): string =>
  flag.polarity === "strength" ? "border-l-signal-healthy" : RISK_ACCENT[flag.severity];

const textFor = (flag: AccountFlag): string =>
  flag.polarity === "strength" ? "text-signal-healthy" : RISK_TEXT[flag.severity];

interface Props {
  flag: AccountFlag;
  /** Point ids already ticked for this company. */
  checked: string[];
  onToggle: (id: string) => void;
  /** Pro users see the stat and the qualification points. */
  showDetail: boolean;
  /** Filter the evidence list below to the reviews backing this flag. */
  onShowEvidence: (reviewIds: string[]) => void;
}

const FlagCard: React.FC<Props> = ({ flag, checked, onToggle, showDetail, onShowEvidence }) => (
  <div className={`bg-white border border-slate-200 border-l-[3px] ${accentFor(flag)} p-4`}>
    <div className="flex items-baseline justify-between gap-3">
      <span className={`text-sm font-semibold ${textFor(flag)}`}>{flag.label}</span>
      {showDetail && (
        <span className="shrink-0 text-2xs font-semibold text-slate-500 tabular-nums">
          {flag.stat}
        </span>
      )}
    </div>

    {showDetail ? (
      <>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-2xs text-slate-400">
          {/*
            Modal-driven flags (payment terms, committee size) aggregate a field
            across reviews and carry no per-review provenance, so there is
            nothing to link to. Rendering "0 reports" next to a flag whose stat
            reads "6 of 8 deals" just looks broken.
          */}
          {flag.reviewIds.length > 0 && (
            <button
              type="button"
              onClick={() => onShowEvidence(flag.reviewIds)}
              className="underline underline-offset-2 hover:text-accent transition-colors"
            >
              {flag.reviewIds.length} report{flag.reviewIds.length !== 1 ? "s" : ""}
            </button>
          )}
          {flag.source === "reports" && <span>From written reports</span>}
        </div>
        <ul className="mt-2 space-y-1">
          {flag.qualify.map((point) => {
            const id = pointId(flag.id, point);
            return (
              <li key={id} className="flex gap-2">
                <input
                  type="checkbox"
                  id={id}
                  checked={checked.includes(id)}
                  onChange={() => onToggle(id)}
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-accent"
                />
                <label
                  htmlFor={id}
                  className={`text-2xs ${checked.includes(id) ? "text-slate-400 line-through" : "text-slate-600"}`}
                >
                  {point}
                </label>
              </li>
            );
          })}
        </ul>
      </>
    ) : (
      <p className="text-2xs text-slate-300 italic mt-1 select-none" aria-hidden="true">
        ░░░░░░░ ░░░░░ ░░░░░░░░░ ░░░░ ░░░░░░░
      </p>
    )}
  </div>
);

export default FlagCard;
