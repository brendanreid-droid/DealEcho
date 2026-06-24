import React from "react";
import ScoreRing from "../ScoreRing";

interface VerdictCardProps {
  name: string;
  meta: string;
  health: number;
  healthDelta: number;
  headline: string;
  reportCount: number;
}

const VerdictCard: React.FC<VerdictCardProps> = ({
  name, meta, health, healthDelta, headline, reportCount,
}) => {
  const declining = healthDelta < 0;
  return (
    <div className="bg-white border border-slate-200 rounded-card p-6 flex items-center gap-6">
      <ScoreRing score={health} size={72} showLabel />
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">{name}</h1>
          {healthDelta !== 0 && (
            <span
              className={`text-2xs font-semibold rounded-control px-2 py-1 ${
                declining
                  ? "bg-rose-50 text-signal-risk"
                  : "bg-emerald-50 text-signal-healthy"
              }`}
            >
              health {declining ? "↓" : "↑"} {Math.abs(healthDelta)} this quarter
            </span>
          )}
        </div>
        <p className="text-2xs text-slate-500 uppercase tracking-wider mt-1">
          {meta} · {reportCount} reports
        </p>
        <p className="text-slate-600 text-base leading-relaxed mt-2 max-w-2xl">{headline}</p>
      </div>
    </div>
  );
};

export default VerdictCard;
