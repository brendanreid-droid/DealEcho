import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import * as Accordion from "@radix-ui/react-accordion";
import * as Tooltip from "@radix-ui/react-tooltip";
import { Info } from "lucide-react";
import { AccountFlag, GroupedFlags, pointId } from "../../../services/accountFlags";
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
  grouped: GroupedFlags;
  isPro: boolean;
  /** Filter the evidence list below to the reviews backing a flag. */
  onShowEvidence: (reviewIds: string[]) => void;
}

/** One group of flags under a heading. Omitted entirely when the group is empty. */
const FlagGroup: React.FC<{
  heading: string;
  flags: AccountFlag[];
  checked: string[];
  onToggle: (id: string) => void;
  isPro: boolean;
  onShowEvidence: (reviewIds: string[]) => void;
}> = ({ heading, flags, checked, onToggle, isPro, onShowEvidence }) => {
  if (flags.length === 0) return null;

  const cards = flags.map((f) => (
    <FlagCard
      key={f.id}
      flag={f}
      checked={checked}
      onToggle={onToggle}
      showDetail={isPro}
      onShowEvidence={onShowEvidence}
    />
  ));

  return (
    <div className="space-y-2">
      <h3 className="text-2xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{heading}</h3>
      {/*
        Multiple, so opening one flag does not close another - a rep working
        through a call wants several open at once. Free users get plain cards
        with nothing to expand.
      */}
      {isPro ? (
        <Accordion.Root type="multiple" className="space-y-2">
          {cards}
        </Accordion.Root>
      ) : (
        cards
      )}
    </div>
  );
};

const FlagList: React.FC<Props> = ({ companyId, grouped, isPro, onShowEvidence }) => {
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

  const { risks, strengths } = grouped;

  if (risks.length === 0 && strengths.length === 0) {
    return <p className="text-sm text-slate-400">No red flags detected across recent reports.</p>;
  }

  const allFlags = [...risks, ...strengths];
  const points = allFlags.flatMap((f) => f.qualify.map((p) => pointId(f.id, p)));
  const done = points.filter((p) => checked.includes(p)).length;

  return (
    <div className="space-y-4">
      {isPro && (
        <div className="flex items-center justify-end gap-1.5">
          <p className="text-2xs text-slate-400" aria-live="polite">
            {done} of {points.length} qualified
          </p>
          {/*
            A tooltip suits this - it is incidental detail, not the purpose of
            the control. Users could reasonably assume ticks sync or are shared
            with their team, and be annoyed later when they are not.
          */}
          <Tooltip.Provider delayDuration={150}>
            <Tooltip.Root>
              <Tooltip.Trigger
                type="button"
                aria-label="Ticks are saved in this browser only"
                className="text-slate-300 hover:text-slate-500 transition-colors"
              >
                <Info size={12} aria-hidden="true" />
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content
                  className="bg-navy text-white rounded-card p-3 text-2xs max-w-xs z-50"
                  sideOffset={6}
                >
                  Ticks are saved in this browser only - they do not sync across devices or to your team.
                  <Tooltip.Arrow className="fill-navy" />
                </Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>
          </Tooltip.Provider>
        </div>
      )}
      <FlagGroup
        heading="Watch for"
        flags={risks}
        checked={checked}
        onToggle={toggle}
        isPro={isPro}
        onShowEvidence={onShowEvidence}
      />
      <FlagGroup
        heading="In your favour"
        flags={strengths}
        checked={checked}
        onToggle={toggle}
        isPro={isPro}
        onShowEvidence={onShowEvidence}
      />
      {!isPro && (
        <Link
          to="/pricing"
          className="block text-center bg-navy text-white rounded-control px-4 py-3 text-2xs font-semibold uppercase tracking-widest hover:bg-navy-800 transition-colors"
        >
          Unlock {risks.length + strengths.length} flags with Sales Pro
        </Link>
      )}
    </div>
  );
};

export default FlagList;
