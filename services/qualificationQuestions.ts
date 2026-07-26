import { DealMechanics, FrictionStat } from "./dealMechanics";

/**
 * Account-specific discovery questions derived from Layer A stats.
 *
 * Design rule: a question only renders if its data slot is filled. Every `why`
 * string must contain a real number from real reviews — a question that would
 * apply to any account is worthless, which is exactly how the old MEDDPICC
 * blueprint failed.
 */

export type Stage = "Discovery" | "Evaluation" | "Negotiation" | "Close";

export interface QualificationQuestion {
  id: string;
  question: string;
  /** Department to put the question to. Values come from DEPARTMENTS. */
  askOf: string;
  stage: Stage;
  /** Rationale containing the account-specific number. */
  why: string;
  /** Reviews backing the rationale, for citation in the UI. */
  reviewIds: string[];
  /** Higher sorts first. */
  priority: number;
}

/** Sellers scan, they do not read. More than this and the list is ignored. */
export const MAX_QUESTIONS = 6;

interface Rule {
  id: string;
  build: (m: DealMechanics) => QualificationQuestion | null;
}

/** Find a friction event that hit at least `min` reports. */
export function friction(m: DealMechanics, event: string, min: number): FrictionStat | null {
  const f = m.friction.find((x) => x.event === event);
  return f && f.count >= min ? f : null;
}

/** True when a rate cleared `threshold` (0-1) on a non-empty sample. */
export function rateOver(s: { count: number; total: number }, threshold: number): boolean {
  return s.total > 0 && s.count / s.total > threshold;
}

export const RULES: Rule[] = [
  {
    id: "security-review",
    build: (m) => {
      const f = friction(m, "Security questionnaire", 2);
      if (!f) return null;
      return {
        id: "security-review",
        question:
          "Which security review tier applies at our contract size, and can it run in parallel with the commercial evaluation rather than after it?",
        askOf: "Security / InfoSec",
        stage: "Discovery",
        why: `${f.count} of ${f.total} sellers hit a security questionnaire at this account.`,
        reviewIds: f.reviewIds,
        priority: 90,
      };
    },
  },
  {
    id: "reverse-auction",
    build: (m) => {
      const f = friction(m, "Reverse auction / e-procurement", 1);
      if (!f) return null;
      return {
        id: "reverse-auction",
        question:
          "Will this go to a reverse auction or e-procurement event, and what are the qualification criteria to be exempted from it?",
        askOf: "Procurement",
        stage: "Evaluation",
        why: `${f.count} of ${f.total} sellers were pulled into a reverse auction or e-procurement event.`,
        reviewIds: f.reviewIds,
        priority: 100,
      };
    },
  },
  {
    id: "ghosting",
    build: (m) => {
      if (!rateOver(m.ghostRate, 1 / 3)) return null;
      return {
        id: "ghosting",
        question:
          "If we do not hear from you for two weeks, who should we contact and what usually causes the pause on your side?",
        askOf: "Procurement",
        stage: "Evaluation",
        why: `The buyer went silent mid-cycle in ${m.ghostRate.count} of ${m.ghostRate.total} reported deals.`,
        reviewIds: m.ghostRate.reviewIds,
        priority: 85,
      };
    },
  },
];

export function getQualificationQuestions(m: DealMechanics): QualificationQuestion[] {
  return RULES.map((rule) => rule.build(m))
    .filter((q): q is QualificationQuestion => q !== null)
    .sort((a, b) => b.priority - a.priority)
    .slice(0, MAX_QUESTIONS);
}
