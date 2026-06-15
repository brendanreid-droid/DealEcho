import React from "react";

interface ScoreRingProps {
  score: number; // 0–100
  size?: number; // px
  showLabel?: boolean;
}

/** Returns the signal color for a health score band. */
export const scoreColor = (score: number): string => {
  if (score >= 70) return "#059669"; // signal-healthy
  if (score >= 55) return "#d97706"; // signal-caution
  return "#e11d48"; // signal-risk
};

export const scoreBand = (score: number): string => {
  if (score >= 70) return "Healthy";
  if (score >= 55) return "Mixed";
  return "Caution";
};

const ScoreRing: React.FC<ScoreRingProps> = ({
  score,
  size = 58,
  showLabel = false,
}) => {
  const stroke = 5;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - Math.max(0, Math.min(100, score)) / 100);
  const color = scoreColor(score);
  const center = size / 2;

  return (
    <div
      className="relative flex-shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Buyer health score ${score} of 100 — ${scoreBand(score)}`}
    >
      <svg
        width={size}
        height={size}
        style={{ transform: "rotate(-90deg)" }}
      >
        <circle
          className="de-ring-track"
          cx={center}
          cy={center}
          r={r}
          fill="none"
          strokeWidth={stroke}
        />
        <circle
          cx={center}
          cy={center}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            transition: "stroke-dashoffset 1.2s cubic-bezier(.22,1,.36,1)",
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="font-mono font-semibold"
          style={{ color, fontSize: size * 0.26 }}
        >
          {score}
        </span>
        {showLabel && (
          <span className="text-[9px] font-semibold text-slate-400 mt-0.5">
            {scoreBand(score)}
          </span>
        )}
      </div>
    </div>
  );
};

export default ScoreRing;
