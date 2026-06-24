import React from "react";
import { MetricTrend } from "../../../services/accountSignal";
import TrendArrow from "./TrendArrow";

const LABELS: Record<MetricTrend["metric"], string> = {
  responsiveness: "Responsiveness",
  negotiation: "Negotiation Ease",
  intent: "Buyer Intent",
  scope: "Scope Maturity",
};

const VALUE_COLOR: Record<MetricTrend["direction"], string> = {
  up: "text-signal-healthy",
  down: "text-signal-risk",
  flat: "text-slate-900",
};

const TrendStrip: React.FC<{ trend: MetricTrend[] }> = ({ trend }) => (
  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
    {trend.map((t) => (
      <div
        key={t.metric}
        className="bg-white border border-slate-200 rounded-card p-4 shadow-sm"
      >
        <div className="text-2xs font-semibold uppercase tracking-wide text-slate-500 flex items-center gap-1">
          {LABELS[t.metric]} <TrendArrow direction={t.direction} />
        </div>
        <div className={`text-2xl font-bold font-mono mt-1 ${VALUE_COLOR[t.direction]}`}>
          {t.current.toFixed(1)}
        </div>
      </div>
    ))}
  </div>
);

export default TrendStrip;
