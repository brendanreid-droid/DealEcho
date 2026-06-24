import React from "react";
import { Link } from "react-router-dom";

type Variant = "primary" | "dark" | "outline";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-white hover:bg-accent-700",
  dark: "bg-navy text-white hover:bg-black",
  outline: "bg-transparent text-slate-900 border border-slate-300 hover:border-slate-400",
};

interface BaseProps {
  variant: Variant;
  children: React.ReactNode;
  className?: string;
  to?: string;
  onClick?: () => void;
}

const Button: React.FC<BaseProps> = ({ variant, children, className = "", to, onClick }) => {
  const cls = `inline-flex items-center justify-center gap-2 font-semibold rounded-control px-6 py-3 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${VARIANTS[variant]} ${className}`;
  if (to) {
    return (
      <Link to={to} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={cls}>
      {children}
    </button>
  );
};

export default Button;
