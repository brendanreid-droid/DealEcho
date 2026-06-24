import React from "react";

interface SectionHeadingProps {
  title: string;
  live?: boolean;
  className?: string;
}

const SectionHeading: React.FC<SectionHeadingProps> = ({ title, live, className = "" }) => (
  <h2 className={`font-bold text-2xl md:text-[26px] tracking-tight text-slate-900 flex items-center gap-3 ${className}`}>
    {title}
    {live && (
      <span className="font-mono text-2xs text-signal-healthy border border-emerald-200 bg-emerald-50 rounded-md px-2 py-0.5 tracking-[0.1em] inline-flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-signal-healthy animate-pulse-soft" />
        LIVE
      </span>
    )}
  </h2>
);

export default SectionHeading;
