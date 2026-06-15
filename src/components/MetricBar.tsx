import React from "react";
import { scoreColor } from "./ScoreRing";

interface MetricBarProps {
  label: string;
  value: number; // 0–100 (already scaled)
}

/** A labelled micro-bar showing one metric on a company card. */
const MetricBar: React.FC<MetricBarProps> = ({ label, value }) => {
  const color = scoreColor(value);
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div>
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-2xs font-semibold text-slate-600">{label}</span>
        <span className="font-mono text-2xs font-semibold" style={{ color }}>
          {Math.round(clamped)}
        </span>
      </div>
      <div className="h-1 rounded-full bg-slate-100 overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{
            width: `${clamped}%`,
            background: color,
            transition: "width 1s cubic-bezier(.22,1,.36,1)",
          }}
        />
      </div>
    </div>
  );
};

export default MetricBar;
