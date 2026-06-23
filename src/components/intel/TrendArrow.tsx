import React from "react";
import { ArrowUp, ArrowRight, ArrowDown } from "lucide-react";

type Direction = "up" | "down" | "flat";

const CONFIG: Record<Direction, { Icon: typeof ArrowUp; className: string; label: string }> = {
  up: { Icon: ArrowUp, className: "text-signal-healthy", label: "improving" },
  flat: { Icon: ArrowRight, className: "text-slate-400", label: "steady" },
  down: { Icon: ArrowDown, className: "text-signal-risk", label: "declining" },
};

const TrendArrow: React.FC<{ direction: Direction; size?: number }> = ({ direction, size = 14 }) => {
  const { Icon, className, label } = CONFIG[direction];
  return (
    <span className={`inline-flex items-center ${className}`} role="img" aria-label={label}>
      <Icon size={size} aria-hidden="true" />
    </span>
  );
};

export default TrendArrow;
