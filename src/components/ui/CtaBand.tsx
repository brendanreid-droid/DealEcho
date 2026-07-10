import React from "react";
import Button from "./Button";

interface CtaBandProps {
  headline: string;
  subtext?: string;
  ctaLabel: string;
  to?: string;
  onClick?: () => void;
}

const CtaBand: React.FC<CtaBandProps> = ({ headline, subtext, ctaLabel, to, onClick }) => (
  <section className="bg-navy text-center px-6 py-14">
    <h2 className="text-white font-extrabold text-2xl md:text-3xl tracking-tight">{headline}</h2>
    {subtext && <p className="text-slate-400 text-sm mt-3 max-w-md mx-auto">{subtext}</p>}
    <div className="mt-7 flex justify-center">
      <Button variant="primary" to={to} onClick={onClick}>
        {ctaLabel} →
      </Button>
    </div>
  </section>
);

export default CtaBand;
