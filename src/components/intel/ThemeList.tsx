import React from "react";
import { Sparkles } from "lucide-react";
import { AccountTheme } from "../../../services/accountThemes";

const ThemeList: React.FC<{ themes: AccountTheme[] }> = ({ themes }) => {
  if (themes.length === 0) return null;
  return (
    <section
      aria-labelledby="themes-heading"
      className="bg-white border border-slate-200 rounded-card p-4 space-y-3"
    >
      <h2 id="themes-heading" className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        <Sparkles size={15} className="text-accent" aria-hidden="true" />
        What sellers keep reporting
      </h2>
      <ul className="space-y-2">
        {themes.map((t) => (
          <li key={t.theme} className="flex items-start justify-between gap-3">
            <span className="text-sm text-slate-700">{t.theme}</span>
            <span className="shrink-0 text-2xs font-semibold text-slate-500 tabular-nums">
              {t.reviewIds.length} report{t.reviewIds.length !== 1 ? "s" : ""}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
};

export default ThemeList;
