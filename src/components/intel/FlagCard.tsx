import React from "react";
import * as Accordion from "@radix-ui/react-accordion";
import { ChevronDown } from "lucide-react";
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

const FlagCard: React.FC<Props> = ({ flag, checked, onToggle, showDetail, onShowEvidence }) => {
  const shell = `bg-white border border-slate-200 border-l-[3px] ${accentFor(flag)}`;

  // Non-Pro users have no qualification points, so there is nothing to expand.
  // Rendering an empty accordion would be a control that does nothing.
  if (!showDetail) {
    return (
      <div className={`${shell} p-4`}>
        <span className={`text-sm font-semibold ${textFor(flag)}`}>{flag.label}</span>
        <p className="text-2xs text-slate-300 italic mt-1 select-none" aria-hidden="true">
          ░░░░░░░ ░░░░░ ░░░░░░░░░ ░░░░ ░░░░░░░
        </p>
      </div>
    );
  }

  const points = flag.qualify.map((point) => ({ point, id: pointId(flag.id, point) }));
  const done = points.filter((p) => checked.includes(p.id)).length;

  return (
    <Accordion.Item value={flag.id} className={shell}>
      <Accordion.Header>
        {/*
          The label and stat stay in the trigger, not the body - they ARE the
          finding, and the panel is meant to be scannable without opening
          anything. Only the detail collapses.
        */}
        <Accordion.Trigger className="group w-full flex items-center gap-3 p-4 text-left">
          <span className={`text-sm font-semibold ${textFor(flag)}`}>{flag.label}</span>
          <span className="ml-auto shrink-0 text-2xs font-semibold text-slate-500 tabular-nums">
            {flag.stat}
          </span>
          {/* Progress while collapsed, so a closed card still says whether work remains. */}
          <span className="shrink-0 text-2xs text-slate-400 tabular-nums">
            {done}/{points.length}
          </span>
          <ChevronDown
            size={14}
            className="shrink-0 text-slate-400 transition-transform group-data-[state=open]:rotate-180"
            aria-hidden="true"
          />
        </Accordion.Trigger>
      </Accordion.Header>

      <Accordion.Content className="px-4 pb-4">
        <div className="flex flex-wrap items-center gap-2 text-2xs text-slate-400">
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
          {points.map(({ point, id }) => (
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
          ))}
        </ul>
      </Accordion.Content>
    </Accordion.Item>
  );
};

export default FlagCard;
