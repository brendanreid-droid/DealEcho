/**
 * One flag engine for the company profile: a finding, the number that proves
 * it, and the points a seller should qualify on their next call.
 *
 * Two sources produce the same shape. Structured flags are derived
 * deterministically from schema v2 fields (see services/dealMechanics.ts).
 * Free-text flags come from Gemini and are citation-validated server-side.
 *
 * Design rule inherited from the questions engine this replaces: a flag only
 * renders if its data slot is filled, and `stat` must carry a real number. A
 * finding that would apply to any account is worthless.
 */

export type FlagSeverity = "critical" | "caution" | "watch";

/** Where a flag came from. The UI marks free-text flags so sellers can weigh them. */
export type FlagSource = "mechanics" | "reports";

export interface AccountFlag {
  /** Stable kebab-case identifier. Structured flags use a fixed id; AI flags hash their label. */
  id: string;
  /** Short finding, e.g. "Security review is a gate". */
  label: string;
  severity: FlagSeverity;
  /** The evidence line. MUST contain a number. */
  stat: string;
  /** One to three fragments a seller should nail down. Not full sentences. */
  qualify: string[];
  /** Reviews backing this flag, for the evidence link. */
  reviewIds: string[];
  /** Observed rate, 0-1. Blended into ranking. */
  strength: number;
  /** Category weight. Higher sorts first. */
  priority: number;
  source: FlagSource;
}

/**
 * FNV-1a. Not cryptographic - this only needs to be stable and cheap so a
 * ticked qualification point keeps its identity when flags regenerate.
 */
function hash8(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/**
 * Identity for one qualification point, stable across regenerations.
 * Normalised so that whitespace or capitalisation changes do not orphan a tick.
 */
export function pointId(flagId: string, point: string): string {
  return `${flagId}:${hash8(point.trim().toLowerCase())}`;
}

import { DealMechanics, FrictionStat } from "./dealMechanics";

/** Sellers scan. More than this and the list stops being read. */
export const MAX_FLAGS = 7;

/**
 * A rate or modal rule needs at least this many reviews to have ANSWERED the
 * underlying field. Per-field denominators are independent of the review count,
 * so a 9-review account can still have a 1-of-1 modal.
 */
export const MIN_RULE_SAMPLE = 2;

/** Find a friction event that hit at least `min` reports. */
export function friction(m: DealMechanics, event: string, min: number): FrictionStat | null {
  const f = m.friction.find((x) => x.event === event);
  return f && f.count >= min ? f : null;
}

/** True when a rate cleared `threshold` (0-1) on a sample of at least MIN_RULE_SAMPLE. */
export function rateOver(s: { count: number; total: number }, threshold: number): boolean {
  return s.total >= MIN_RULE_SAMPLE && s.count / s.total > threshold;
}

type Rule = (m: DealMechanics) => AccountFlag | null;

/** Shorthand for a friction-driven flag, which is most of the bank. */
function frictionFlag(
  m: DealMechanics,
  opts: {
    id: string;
    event: string;
    min: number;
    label: string;
    severity: FlagSeverity;
    priority: number;
    qualify: string[];
  },
): AccountFlag | null {
  const f = friction(m, opts.event, opts.min);
  if (!f) return null;
  return {
    id: opts.id,
    label: opts.label,
    severity: opts.severity,
    stat: `${f.count} of ${f.total} deals`,
    qualify: opts.qualify,
    reviewIds: f.reviewIds,
    strength: f.count / f.total,
    priority: opts.priority,
    source: "mechanics",
  };
}

const RULES: Rule[] = [
  (m) =>
    frictionFlag(m, {
      id: "reverse-auction",
      event: "Reverse auction / e-procurement",
      min: 1,
      label: "Deals go to reverse auction",
      severity: "critical",
      priority: 100,
      qualify: [
        "whether this deal is headed for an auction or e-procurement event",
        "what qualifies a vendor to be exempted",
        "who decides that, and when",
      ],
    }),
  (m) =>
    frictionFlag(m, {
      id: "security-review",
      event: "Security questionnaire",
      min: 2,
      label: "Security review is a gate",
      severity: "caution",
      priority: 90,
      qualify: [
        "which review tier applies at your contract size",
        "whether it can run parallel to the commercial evaluation",
        "who signs it off",
      ],
    }),
  (m) =>
    frictionFlag(m, {
      id: "legal-redlines",
      event: "Legal redlines on MSA",
      min: 2,
      label: "MSA redlines are routine",
      severity: "caution",
      priority: 80,
      qualify: [
        "whether they will share their standard MSA up front",
        "which clauses they will not move on",
        "how long legal review has taken before",
      ],
    }),
  (m) =>
    frictionFlag(m, {
      id: "poc-required",
      event: "Pilot / POC required",
      min: 2,
      label: "A pilot is expected before signature",
      severity: "caution",
      priority: 78,
      qualify: [
        "the written success criteria",
        "who signs off that they were met",
        "what happens commercially once they are",
      ],
    }),
  (m) =>
    frictionFlag(m, {
      id: "soc2-evidence",
      event: "SOC 2 / pen test required",
      min: 2,
      label: "Third-party security evidence required",
      severity: "caution",
      priority: 75,
      qualify: [
        "whether your current SOC 2 satisfies them",
        "whether they require an independent pen test",
        "how long their review of it takes",
      ],
    }),
  (m) =>
    frictionFlag(m, {
      id: "vendor-portal",
      event: "Vendor onboarding portal",
      min: 2,
      label: "Vendor onboarding adds time at PO stage",
      severity: "watch",
      priority: 60,
      qualify: [
        "which portal you need to register in",
        "how long approval usually takes",
        "whether you can start before the PO",
      ],
    }),
  (m) =>
    frictionFlag(m, {
      id: "reference-calls",
      event: "Reference calls required",
      min: 2,
      label: "Customer references become a gate",
      severity: "watch",
      priority: 55,
      qualify: [
        "how many references they need and in which industries",
        "at what stage they become blocking",
      ],
    }),
  (m) => {
    const s = m.procurementEntry;
    if (!s || s.total < MIN_RULE_SAMPLE || s.value !== "Early (before shortlist)") return null;
    return {
      id: "procurement-early",
      label: "Procurement engages before shortlist",
      severity: "caution",
      stat: `${s.count} of ${s.total} deals`,
      qualify: [
        "who owns the commercial evaluation",
        "what they need from you to stay on the shortlist",
        "whether a preferred vendor is already in place",
      ],
      reviewIds: [],
      strength: s.count / s.total,
      priority: 88,
      source: "mechanics",
    };
  },
  (m) => {
    if (!rateOver(m.ghostRate, 1 / 3)) return null;
    return {
      id: "ghosting",
      label: "Buyer goes quiet mid-cycle",
      severity: "critical",
      stat: `${m.ghostRate.count} of ${m.ghostRate.total} deals`,
      qualify: [
        "who to contact when the thread goes cold",
        "what normally causes the pause on their side",
        "whether an internal approval cycle explains it",
      ],
      reviewIds: m.ghostRate.reviewIds,
      strength: m.ghostRate.count / m.ghostRate.total,
      priority: 85,
      source: "mechanics",
    };
  },
  (m) => {
    if (!rateOver(m.slippageRate, 1 / 3)) return null;
    return {
      id: "close-slippage",
      label: "Close dates slip repeatedly",
      severity: "critical",
      stat: `${m.slippageRate.count} of ${m.slippageRate.total} deals pushed twice or more`,
      qualify: [
        "what has to be true for this to sign in the quarter",
        "which of those steps has slipped for them before",
        "whether budget is committed or still being approved",
      ],
      reviewIds: m.slippageRate.reviewIds,
      strength: m.slippageRate.count / m.slippageRate.total,
      priority: 82,
      source: "mechanics",
    };
  },
  (m) => {
    const s = m.verbalToSignature;
    if (!s || s.total < MIN_RULE_SAMPLE || (s.value !== "1-3 Months" && s.value !== "3+ Months")) {
      return null;
    }
    return {
      id: "verbal-drift",
      label: "Long gap between verbal yes and signature",
      severity: "caution",
      stat: `${s.value} typical, across ${s.total} reports`,
      qualify: [
        "the signature path after a verbal commit",
        "how many approvals sit in between",
        "who can escalate if it stalls",
      ],
      reviewIds: [],
      strength: s.count / s.total,
      priority: 70,
      source: "mechanics",
    };
  },
  (m) => {
    const s = m.stakeholderCount;
    if (!s || s.total < MIN_RULE_SAMPLE || (s.value !== "6-10" && s.value !== "10+")) return null;
    return {
      id: "stakeholder-sprawl",
      label: "Large buying committee",
      severity: "watch",
      stat: `${s.value} stakeholders typical, across ${s.total} reports`,
      qualify: [
        "who else needs to say yes that you have not met",
        "which of them can say no on their own",
      ],
      reviewIds: [],
      strength: s.count / s.total,
      priority: 65,
      source: "mechanics",
    };
  },
  (m) => {
    const s = m.paymentTerms;
    if (!s || s.total < MIN_RULE_SAMPLE || !["Net 60", "Net 90", "Net 120+"].includes(s.value)) {
      return null;
    }
    return {
      id: "payment-terms",
      label: `Standard terms are ${s.value}`,
      severity: "watch",
      stat: `${s.count} of ${s.total} reports`,
      qualify: ["what would justify an exception", "who approves it"],
      reviewIds: [],
      strength: s.count / s.total,
      priority: 50,
      source: "mechanics",
    };
  },
];

/** Deterministic flags from structured v2 fields. Unranked and uncapped - see mergeFlags. */
export function getStructuredFlags(m: DealMechanics): AccountFlag[] {
  return RULES.map((rule) => rule(m)).filter((f): f is AccountFlag => f !== null);
}
