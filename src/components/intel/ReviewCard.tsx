import React from "react";
import * as Tooltip from "@radix-ui/react-tooltip";
import { Star } from "lucide-react";
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

const ReviewCard: React.FC<{ review: Review }> = ({ review: r }) => (
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
  </div>
);

export default ReviewCard;
