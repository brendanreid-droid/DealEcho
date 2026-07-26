import React, { useCallback, useEffect, useState } from "react";
import { HelpCircle } from "lucide-react";
import { QualificationQuestion } from "../../../services/qualificationQuestions";

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
    // Fail silently if storage is blocked or full — the list still works in-session.
  }
};

interface Props {
  companyId: string;
  questions: QualificationQuestion[];
}

const QuestionList: React.FC<Props> = ({ companyId, questions }) => {
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

  if (questions.length === 0) return null;

  const answered = questions.filter((q) => checked.includes(q.id)).length;

  return (
    <section
      aria-labelledby="questions-heading"
      className="bg-white border border-slate-200 rounded-card p-4 space-y-3"
    >
      <h2 id="questions-heading" className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        <HelpCircle size={15} className="text-accent" aria-hidden="true" />
        Ask this account
        <span className="ml-auto text-2xs font-normal text-slate-400" aria-live="polite">
          {answered} of {questions.length} answered
        </span>
      </h2>

      <ul className="space-y-3">
        {questions.map((q) => (
          <li key={q.id} className="flex gap-3">
            <input
              type="checkbox"
              id={`qq-${q.id}`}
              checked={checked.includes(q.id)}
              onChange={() => toggle(q.id)}
              className="mt-1 h-4 w-4 shrink-0 accent-accent"
            />
            <div className="min-w-0">
              <label
                htmlFor={`qq-${q.id}`}
                className={`block text-sm ${checked.includes(q.id) ? "text-slate-400 line-through" : "text-slate-900"}`}
              >
                {q.question}
              </label>
              <div className="mt-1 flex flex-wrap gap-2 text-2xs">
                <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-control">{q.askOf}</span>
                <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-control">{q.stage}</span>
              </div>
              <p className="mt-1 text-2xs text-slate-500">{q.why}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
};

export default QuestionList;
