import React from "react";
import { Flag, FlagType } from "../../../services/accountSignal";

const LABELS: Record<FlagType, string> = {
  ghosting: "Ghosting",
  tire_kicker: "Tire kicker",
  ip_risk: "IP risk",
  brutal_procurement: "Brutal procurement",
  champion_loss: "Champion loss",
  scope_creep: "Scope creep",
  legal_friction: "Legal friction",
  budget_freeze: "Budget freeze",
};

const FlagCard: React.FC<{ flag: Flag; showEvidence: boolean }> = ({ flag, showEvidence }) => {
  const critical = flag.severity === "critical";
  const accent = critical ? "border-l-signal-risk" : "border-l-signal-caution";
  const text = critical ? "text-signal-risk" : "text-signal-caution";
  return (
    <div className={`bg-white border border-slate-200 border-l-[3px] ${accent} rounded-none p-4`}>
      <div className={`text-sm font-semibold ${text}`}>
        {LABELS[flag.type]} · {flag.severity} · {flag.reviewIds.length} report
        {flag.reviewIds.length !== 1 ? "s" : ""}
      </div>
      {showEvidence ? (
        flag.evidence && (
          <p className="text-2xs text-slate-500 italic mt-1">"{flag.evidence}"</p>
        )
      ) : (
        <p className="text-2xs text-slate-300 italic mt-1 select-none" aria-hidden="true">
          ░░░░░░░ ░░░░░ ░░░░░░░░░ ░░░░ ░░░░░░░
        </p>
      )}
    </div>
  );
};

export default FlagCard;
