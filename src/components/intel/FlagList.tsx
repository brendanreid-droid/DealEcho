import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AccountFlag, pointId } from "../../../services/accountFlags";
import FlagCard from "./FlagCard";

const storageKey = (companyId: string) => `dealecho_qq:${companyId}`;

const loadChecked = (companyId: string): string[] => {
  try {
    const raw = localStorage.getItem(storageKey(companyId));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
};

const saveChecked = (companyId: string, ids: string[]): void => {
  try {
    localStorage.setItem(storageKey(companyId), JSON.stringify(ids));
  } catch {
    // Fail silently if storage is blocked or full - the list still works in-session.
  }
};

interface Props {
  companyId: string;
  flags: AccountFlag[];
  isPro: boolean;
}

const FlagList: React.FC<Props> = ({ companyId, flags, isPro }) => {
  const [checked, setChecked] = useState<string[]>(() => loadChecked(companyId));

  // The route updates :companyId without remounting the profile page, so the
  // ticked set has to follow the prop or one account's answers leak onto another.
  useEffect(() => {
    setChecked(loadChecked(companyId));
  }, [companyId]);

  const toggle = useCallback(
    (id: string) => {
      const next = checked.includes(id) ? checked.filter((x) => x !== id) : [...checked, id];
      setChecked(next);
      saveChecked(companyId, next);
    },
    [checked, companyId],
  );

  if (flags.length === 0) {
    return <p className="text-sm text-slate-400">No red flags detected across recent reports.</p>;
  }

  const points = flags.flatMap((f) => f.qualify.map((p) => pointId(f.id, p)));
  const done = points.filter((p) => checked.includes(p)).length;

  return (
    <div className="space-y-2">
      {isPro && (
        <p className="text-2xs text-slate-400 text-right" aria-live="polite">
          {done} of {points.length} qualified
        </p>
      )}
      {flags.map((f) => (
        <FlagCard key={f.id} flag={f} checked={checked} onToggle={toggle} showDetail={isPro} />
      ))}
      {!isPro && (
        <Link
          to="/pricing"
          className="block text-center bg-navy text-white rounded-control px-4 py-3 text-2xs font-semibold uppercase tracking-widest hover:bg-navy-800 transition-colors"
        >
          Unlock {flags.length} flags with Sales Pro
        </Link>
      )}
    </div>
  );
};

export default FlagList;
