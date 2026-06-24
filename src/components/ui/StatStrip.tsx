import React from "react";
import CountUp from "./CountUp";

export interface Stat {
  n: number;
  l: string;
  suffix?: string;
}

const StatStrip: React.FC<{ stats: Stat[]; dark?: boolean; className?: string }> = ({
  stats,
  dark,
  className = "",
}) => (
  <div className={`flex flex-wrap justify-center gap-x-12 gap-y-6 ${className}`}>
    {stats.map((s) => (
      <div key={s.l} className="text-center">
        <CountUp
          end={s.n}
          suffix={s.suffix}
          className={`font-bold text-3xl ${dark ? "text-white" : "text-slate-900"}`}
        />
        <div className={`text-xs mt-1 font-medium ${dark ? "text-slate-400" : "text-slate-500"}`}>
          {s.l}
        </div>
      </div>
    ))}
  </div>
);

export default StatStrip;
