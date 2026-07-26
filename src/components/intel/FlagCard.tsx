import React from "react";
import { AccountFlag, pointId } from "../../../services/accountFlags";

const ACCENT: Record<AccountFlag["severity"], string> = {
  critical: "border-l-signal-risk",
  caution: "border-l-signal-caution",
  watch: "border-l-slate-300",
};

const TEXT: Record<AccountFlag["severity"], string> = {
  critical: "text-signal-risk",
  caution: "text-signal-caution",
  watch: "text-slate-500",
};

interface Props {
  flag: AccountFlag;
  /** Point ids already ticked for this company. */
  checked: string[];
  onToggle: (id: string) => void;
  /** Pro users see the stat and the qualification points. */
  showDetail: boolean;
}

const FlagCard: React.FC<Props> = ({ flag, checked, onToggle, showDetail }) => (
  <div className={`bg-white border border-slate-200 border-l-[3px] ${ACCENT[flag.severity]} p-4`}>
    <div className="flex items-baseline justify-between gap-3">
      <span className={`text-sm font-semibold ${TEXT[flag.severity]}`}>{flag.label}</span>
      {showDetail && (
        <span className="shrink-0 text-2xs font-semibold text-slate-500 tabular-nums">
          {flag.stat}
        </span>
      )}
    </div>

    {showDetail ? (
      <>
        <div className="mt-1 flex flex-wrap gap-2 text-2xs text-slate-400">
          <span>
            {flag.reviewIds.length} report{flag.reviewIds.length !== 1 ? "s" : ""}
          </span>
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
