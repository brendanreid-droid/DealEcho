import React, { useEffect, useRef, useState } from "react";

interface CountUpProps {
  end: number;
  className?: string;
  suffix?: string;
}

/** Animated count-up. Respects reduced motion by jumping to the final value. */
const CountUp: React.FC<CountUpProps> = ({ end, className, suffix = "" }) => {
  const [val, setVal] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if (reduce) {
      setVal(end);
      return;
    }
    const t0 = performance.now();
    const dur = 1400;
    const step = (t: number) => {
      const p = Math.min((t - t0) / dur, 1);
      setVal(Math.round(end * (1 - Math.pow(1 - p, 3))));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [end]);

  return (
    <span className={className}>
      {val.toLocaleString()}
      {suffix}
    </span>
  );
};

export default CountUp;
