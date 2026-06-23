import React from "react";
import { MetricTrend } from "../../../services/accountSignal";
import TrendArrow from "./TrendArrow";

const LABELS: Record<MetricTrend["metric"], string> = {
  responsiveness: "Responsiveness",
  negotiation: "Negotiation Ease",
  intent: "Buyer Intent",
  scope: "Scope Maturity",
};

const TrendStrip: React.FC<{ trend: MetricTrend[] }> = ({ trend }) => (
  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
    {trend.map((t) => (
      <div key={t.metric} className="bg-navy-50 rounded-card p-4">
        <div className="text-2xs text-slate-500 flex items-center gap-1">
          {LABELS[t.metric]} <TrendArrow direction={t.direction} />
        </div>
        <div className="text-xl font-bold font-mono text-slate-900 mt-1">
          {t.current.toFixed(1)}
        </div>
      </div>
    ))}
  </div>
);

export default TrendStrip;
