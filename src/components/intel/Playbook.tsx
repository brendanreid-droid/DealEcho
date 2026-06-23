import React from "react";
import * as Accordion from "@radix-ui/react-accordion";
import { ChevronDown, Sparkles } from "lucide-react";
import { CompanyPersona } from "../../../services/geminiService";

const FIELDS: { key: keyof CompanyPersona["meddpicc"]; label: string }[] = [
  { key: "metrics", label: "Metrics" },
  { key: "economicBuyer", label: "Economic Buyer" },
  { key: "decisionCriteria", label: "Decision Criteria" },
  { key: "decisionProcess", label: "Decision Process" },
  { key: "paperProcess", label: "Paper Process" },
  { key: "identifyPain", label: "Identify Pain" },
  { key: "champion", label: "Champion" },
  { key: "competition", label: "Competition" },
];

const Playbook: React.FC<{ persona: CompanyPersona }> = ({ persona }) => (
  <Accordion.Root type="single" collapsible defaultValue="playbook">
    <Accordion.Item value="playbook" className="bg-white border border-slate-200 rounded-card">
      <Accordion.Header>
        <Accordion.Trigger className="group w-full flex items-center justify-between p-4 text-sm font-semibold text-slate-900">
          <span className="flex items-center gap-2">
            <Sparkles size={15} className="text-accent" aria-hidden="true" />
            AI playbook — MEDDPICC blueprint
          </span>
          <ChevronDown
            size={16}
            className="text-slate-400 transition-transform group-data-[state=open]:rotate-180"
            aria-hidden="true"
          />
        </Accordion.Trigger>
      </Accordion.Header>
      <Accordion.Content className="px-4 pb-4 border-t border-slate-100">
        <p className="text-sm text-slate-600 italic py-3">{persona.summary}</p>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {FIELDS.map(({ key, label }) => (
            <div key={key}>
              <dt className="text-2xs font-semibold text-slate-400 uppercase tracking-wider">{label}</dt>
              <dd className="text-sm text-slate-700">{persona.meddpicc[key]}</dd>
            </div>
          ))}
        </dl>
      </Accordion.Content>
    </Accordion.Item>
  </Accordion.Root>
);

export default Playbook;
