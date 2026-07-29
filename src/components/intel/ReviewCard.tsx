import React from "react";
import * as Tooltip from "@radix-ui/react-tooltip";
import { Star, ThumbsUp } from "lucide-react";
import { Review } from "../../../types";

const RATING_DEFINITIONS: Record<string, string[]> = {
  Responsiveness: ["Ghosting", "Poor", "Average", "Good", "Elite"],
  "Negotiation Ease": ["Brutal", "Difficult", "Fair", "Smooth", "Instant"],
  "Buyer Intent": ["Tire Kicker", "Exploratory", "Validated", "Strategic", "Critical"],
  "Scope Maturity": ["Volatile", "Vague", "Consistent", "Structured", "Crystal"],
};

const Rating: React.FC<{ label: string; value: number; color: string }> = ({ label, value, color }) => (
  <Tooltip.Root>
    <Tooltip.Trigger asChild>
      <button type="button" className="flex flex-col items-start text-left focus:outline-none focus:ring-2 focus:ring-accent rounded-control">
        <span className="text-2xs font-semibold uppercase tracking-wider text-slate-400 border-b border-dashed border-slate-300">
          {label}
        </span>
        <span className="flex items-center gap-0.5 mt-1">
          {[1, 2, 3, 4, 5].map((s) => (
            <Star key={s} size={14} className={s <= value ? color : "text-slate-200"} aria-hidden="true" />
          ))}
          <span className="text-2xs font-bold text-slate-900 ml-1">{value}/5</span>
        </span>
      </button>
    </Tooltip.Trigger>
    <Tooltip.Portal>
      <Tooltip.Content className="bg-navy text-white rounded-card p-3 text-2xs max-w-xs z-50" sideOffset={6}>
        <span className="font-semibold">{label}:</span> {RATING_DEFINITIONS[label]?.[value - 1]}
        <Tooltip.Arrow className="fill-navy" />
      </Tooltip.Content>
    </Tooltip.Portal>
  </Tooltip.Root>
);

interface HelpfulProps {
  count: number;
  /** Whether the current user's vote stands. */
  mine: boolean;
  pending: boolean;
  onToggle: () => void;
  /** Author cannot vote for themselves; signed-out users cannot vote at all. */
  disabled: boolean;
  /** Why it is disabled, as the button's accessible label and tooltip. */
  disabledReason?: string;
}

/**
 * "Helpful" control. Reads as a count first and a button second - most readers
 * are here for the signal, not to leave one.
 */
const Helpful: React.FC<HelpfulProps> = ({ count, mine, pending, onToggle, disabled, disabledReason }) => {
  const label = disabled
    ? disabledReason ?? "Marking helpful is unavailable"
    : mine
      ? "Undo helpful"
      : "Mark this review helpful";
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <button
          type="button"
          onClick={onToggle}
          disabled={disabled || pending}
          aria-pressed={mine}
          aria-label={label}
          className={`flex items-center gap-1.5 rounded-control border px-2.5 py-1 text-2xs font-semibold transition-colors ${
            mine
              ? "border-accent bg-navy-50 text-accent"
              : "border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700"
          } ${disabled ? "cursor-not-allowed opacity-60 hover:border-slate-200 hover:text-slate-500" : ""}`}
        >
          <ThumbsUp size={13} aria-hidden="true" className={mine ? "fill-current" : undefined} />
          {/* tabular-nums so the row does not shift as the count changes. */}
          <span className="tabular-nums">{count}</span>
          <span className="sr-only"> found this helpful</span>
        </button>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content className="bg-navy text-white rounded-card p-3 text-2xs max-w-xs z-50" sideOffset={6}>
          {label}
          <Tooltip.Arrow className="fill-navy" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
};

const ReviewCard: React.FC<{ review: Review; helpful?: HelpfulProps }> = ({ review: r, helpful }) => (
  <div className="bg-white border border-slate-200 rounded-card p-6 space-y-4">
    <div className="flex justify-between items-center">
      <span className="text-2xs font-bold text-slate-400 uppercase tracking-wider">
        {new Date(r.createdAt).toLocaleDateString()}
      </span>
      <span
        className={`text-2xs font-semibold rounded-control px-3 py-1 ${
          r.status === "Won"
            ? "bg-emerald-50 text-signal-healthy"
            : r.status === "Lost" || r.status === "No Decision"
              ? "bg-rose-50 text-signal-risk"
              : r.status === "Withdrew"
                ? "bg-amber-50 text-signal-caution"
                : "bg-navy-50 text-accent"
        }`}
      >
        {r.status}
      </span>
    </div>
    <p className="text-slate-600 text-base italic leading-relaxed">"{r.content}"</p>
    <div className="grid grid-cols-2 gap-x-8 gap-y-4">
      <Rating label="Responsiveness" value={r.communicationRating} color="text-signal-healthy" />
      <Rating label="Negotiation Ease" value={r.negotiationLevel} color="text-signal-caution" />
      <Rating label="Buyer Intent" value={r.timeWasterLevel} color="text-signal-risk" />
      <Rating label="Scope Maturity" value={r.clarityOfScope || 3} color="text-accent" />
    </div>
    <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100 text-2xs font-semibold text-slate-500">
      <span>{r.tcvBracket}</span>
      <span>· {r.cycleDuration}</span>
      <span>· {r.isTender ? "Tender" : "Direct"}</span>
      {r.dealType && <span>· {r.dealType}</span>}
      {r.dealRegion && <span>· {r.dealRegion}</span>}
      {r.dealPeriod && <span>· {r.dealPeriod}</span>}
      {r.buyingTeam.map((t) => (
        <span key={t} className="text-accent bg-navy-50 rounded px-1.5">{t}</span>
      ))}
    </div>
    {helpful && (
      <div className="flex items-center justify-between pt-1">
        <span className="text-2xs text-slate-400">
          {helpful.count === 0
            ? "No one has marked this helpful yet"
            : `${helpful.count} ${helpful.count === 1 ? "person" : "people"} found this helpful`}
        </span>
        <Helpful {...helpful} />
      </div>
    )}
  </div>
);

export default ReviewCard;
