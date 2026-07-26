import React from "react";
import { BarChart3 } from "lucide-react";
import { DealMechanics, ModalStat, RateStat } from "../../../services/dealMechanics";

const pct = (s: RateStat): string => (s.total === 0 ? "0%" : `${Math.round((s.count / s.total) * 100)}%`);

const Stat: React.FC<{ label: string; value: string; note?: string }> = ({ label, value, note }) => (
  <div>
    <dt className="text-2xs font-semibold text-slate-400 uppercase tracking-wider">{label}</dt>
    <dd className="text-sm font-semibold text-slate-900">{value}</dd>
    {note && <dd className="text-2xs text-slate-500">{note}</dd>}
  </div>
);

const DealMechanicsPanel: React.FC<{ mechanics: DealMechanics }> = ({ mechanics }) => {
  const m = mechanics;
  const modal = (label: string, s: ModalStat | null) =>
    s ? <Stat key={label} label={label} value={s.value} note={`${s.count} of ${s.total} reports`} /> : null;

  return (
    <section
      aria-labelledby="mechanics-heading"
      className="bg-white border border-slate-200 rounded-card p-4 space-y-4"
    >
      <h2 id="mechanics-heading" className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        <BarChart3 size={15} className="text-accent" aria-hidden="true" />
        How this buyer buys
        <span className="ml-auto text-2xs font-normal text-slate-400">
          {m.sampleSize} report{m.sampleSize !== 1 ? "s" : ""}
        </span>
      </h2>

      <dl className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {m.medianCycle && <Stat label="Typical cycle" value={m.medianCycle} />}
        {modal("Procurement enters", m.procurementEntry)}
        {modal("Verbal to signature", m.verbalToSignature)}
        {modal("Payment terms", m.paymentTerms)}
        {modal("Stakeholders", m.stakeholderCount)}
        {m.ghostRate.total > 0 && (
          <Stat
            label="Went dark"
            value={`${pct(m.ghostRate)} of deals`}
            note={`${m.ghostRate.count} of ${m.ghostRate.total} reports`}
          />
        )}
        {m.slippageRate.total > 0 && (
          <Stat
            label="Close date pushed 2x+"
            value={`${pct(m.slippageRate)} of deals`}
            note={`${m.slippageRate.count} of ${m.slippageRate.total} reports`}
          />
        )}
      </dl>

      {m.friction.length > 0 && (
        <div className="border-t border-slate-100 pt-3">
          <h3 className="text-2xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Procurement gauntlet
          </h3>
          <ul className="space-y-1">
            {m.friction.map((f) => (
              <li key={f.event} className="flex items-center justify-between text-sm">
                <span className="text-slate-700">{f.event}</span>
                <span className="text-2xs font-semibold text-slate-500 tabular-nums">
                  {f.count} of {f.total}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
};

export default DealMechanicsPanel;
