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
  {
    id: "legal-redlines",
    build: (m) => {
      const f = friction(m, "Legal redlines on MSA", 2);
      if (!f) return null;
      return {
        id: "legal-redlines",
        question:
          "Can we see your standard MSA and the clauses you will not move on before we invest in a proposal?",
        askOf: "Legal / Compliance",
        stage: "Evaluation",
        why: `${f.count} of ${f.total} sellers went through MSA redlines here.`,
        reviewIds: f.reviewIds,
        priority: 80,
      };
    },
  },
  {
    id: "soc2-evidence",
    build: (m) => {
      const f = friction(m, "SOC 2 / pen test required", 2);
      if (!f) return null;
      return {
        id: "soc2-evidence",
        question:
          "Does our current SOC 2 report satisfy your requirement, or do you require an independent pen test against our environment?",
        askOf: "Security / InfoSec",
        stage: "Discovery",
        why: `${f.count} of ${f.total} sellers were asked for SOC 2 or pen test evidence.`,
        reviewIds: f.reviewIds,
        priority: 75,
      };
    },
  },
  {
    id: "poc-exit-criteria",
    build: (m) => {
      const f = friction(m, "Pilot / POC required", 2);
      if (!f) return null;
      return {
        id: "poc-exit-criteria",
        question:
          "What are the written success criteria for the pilot, who signs off that they were met, and does a pass commit budget?",
        askOf: "IT / Engineering",
        stage: "Evaluation",
        why: `${f.count} of ${f.total} sellers were required to run a pilot or POC.`,
        reviewIds: f.reviewIds,
        priority: 78,
      };
    },
  },
  {
    id: "reference-calls",
    build: (m) => {
      const f = friction(m, "Reference calls required", 2);
      if (!f) return null;
      return {
        id: "reference-calls",
        question:
          "How many customer references do you need, in which industries, and at what point do they become a gate?",
        askOf: "Procurement",
        stage: "Evaluation",
        why: `${f.count} of ${f.total} sellers had to supply reference calls.`,
        reviewIds: f.reviewIds,
        priority: 55,
      };
    },
  },
  {
    id: "vendor-portal",
    build: (m) => {
      const f = friction(m, "Vendor onboarding portal", 2);
      if (!f) return null;
      return {
        id: "vendor-portal",
        question:
          "Which vendor onboarding portal do we need to register in, how long does approval take, and can we start it now rather than at PO stage?",
        askOf: "Procurement",
        stage: "Close",
        why: `${f.count} of ${f.total} sellers had to clear a vendor onboarding portal.`,
        reviewIds: f.reviewIds,
        priority: 60,
      };
    },
  },
  {
    id: "procurement-early",
    build: (m) => {
      const s = m.procurementEntry;
      if (!s || s.value !== "Early (before shortlist)") return null;
      return {
        id: "procurement-early",
        question:
          "Procurement is already involved — who owns the commercial evaluation, and what do they need from us to keep us on the shortlist?",
        askOf: "Procurement",
        stage: "Discovery",
        why: `Procurement engaged before shortlist in ${s.count} of ${s.total} reported deals.`,
        reviewIds: [],
        priority: 88,
      };
    },
  },
  {
    id: "close-slippage",
    build: (m) => {
      if (!rateOver(m.slippageRate, 1 / 3)) return null;
      return {
        id: "close-slippage",
        question:
          "What has to be true on your side for this to sign in the quarter, and which of those steps has slipped for you before?",
        askOf: "Executive Leadership (C-Suite)",
        stage: "Negotiation",
        why: `The close date was pushed twice or more in ${m.slippageRate.count} of ${m.slippageRate.total} reported deals.`,
        reviewIds: m.slippageRate.reviewIds,
        priority: 82,
      };
    },
  },
  {
    id: "verbal-drift",
    build: (m) => {
      const s = m.verbalToSignature;
      if (!s || (s.value !== "1-3 Months" && s.value !== "3+ Months")) return null;
      return {
        id: "verbal-drift",
        question:
          "Once we have a verbal yes, what is the signature path and how many approvals sit between the verbal and the signed contract?",
        askOf: "Finance / Treasury",
        stage: "Negotiation",
        why: `Verbal to signature typically took ${s.value} here (${s.count} of ${s.total} reports).`,
        reviewIds: [],
        priority: 70,
      };
    },
  },
  {
    id: "payment-terms",
    build: (m) => {
      const s = m.paymentTerms;
      if (!s || !["Net 60", "Net 90", "Net 120+"].includes(s.value)) return null;
      return {
        id: "payment-terms",
        question:
          `Your standard terms appear to be ${s.value} — what would justify an exception, and who approves it?`,
        askOf: "Finance / Treasury",
        stage: "Negotiation",
        why: `${s.count} of ${s.total} sellers reported ${s.value} payment terms.`,
        reviewIds: [],
        priority: 50,
      };
    },
  },
  {
    id: "stakeholder-sprawl",
    build: (m) => {
      const s = m.stakeholderCount;
      if (!s || (s.value !== "6-10" && s.value !== "10+")) return null;
      return {
        id: "stakeholder-sprawl",
        question:
          "Who else needs to say yes that we have not met yet, and which of them can say no on their own?",
        askOf: "Executive Leadership (C-Suite)",
        stage: "Discovery",
        why: `Buying committees here typically run ${s.value} people (${s.count} of ${s.total} reports).`,
        reviewIds: [],
        priority: 65,
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
