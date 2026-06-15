import React, { useMemo } from "react";
import { ReviewSummary } from "../hooks/useReviewSummaries";
import { scoreColor } from "./ScoreRing";

interface IntelTickerProps {
  summaries: ReviewSummary[];
}

/** Anonymised scrolling feed of recent deal intelligence — the signature
 *  element. Shows industry · region · status · score, no company names,
 *  derived from real review summaries. Pauses on hover; respects
 *  prefers-reduced-motion via the global CSS rule. */
const IntelTicker: React.FC<IntelTickerProps> = ({ summaries }) => {
  const ticks = useMemo(() => {
    const items = summaries.slice(0, 12).map((s) => {
      const score = Math.round(
        ((s.communicationRating +
          s.negotiationLevel +
          s.timeWasterLevel +
          (s.clarityOfScope || 3)) /
          20) *
          100,
      );
      return {
        industry: s.industry || "B2B",
        region: s.country || s.location || "Global",
        status: s.status || "Ongoing",
        score,
      };
    });
    // Duplicate for a seamless loop
    return [...items, ...items];
  }, [summaries]);

  if (ticks.length === 0) return null;

  return (
    <div className="bg-navy-950 border-t border-white/10 overflow-hidden">
      <div
        className="flex w-max py-3 hover:[animation-play-state:paused]"
        style={{
          animation: "ticker-scroll 42s linear infinite",
        }}
      >
        {ticks.map((t, i) => {
          const color = scoreColor(t.score);
          return (
            <span
              key={i}
              className="flex items-center gap-2.5 px-6 border-r border-white/5 font-mono text-xs text-slate-400 whitespace-nowrap"
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: color }}
              />
              {t.industry} · {t.region} · <b className="text-slate-200 font-semibold">{t.status}</b> · score{" "}
              <b className="font-semibold" style={{ color }}>
                {t.score}
              </b>
            </span>
          );
        })}
      </div>
      {/* Keyframes injected once; component-scoped name avoids collisions */}
      <style>{`
        @keyframes ticker-scroll { to { transform: translateX(-50%); } }
      `}</style>
    </div>
  );
};

export default IntelTicker;
