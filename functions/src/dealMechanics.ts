import { FRICTION_EVENTS } from "./lib/reviewSchema";

/**
 * Mirrors services/dealMechanics.ts. The two workspaces cannot import each
 * other, same as the AI flag half in accountFlags.ts. Keep the two in step -
 * the tests below are ported verbatim for exactly that reason.
 *
 * Deterministic aggregation of schema v2 review fields into "how this buyer
 * actually buys". No AI, no network - the same reviews always produce the same
 * brief, and every number is traceable to review IDs.
 *
 * Schema v2 fields are optional (legacy v1 reviews lack them), so every stat
 * carries its OWN denominator. Never divide by reviews.length.
 */

/** Only the fields the mechanics read. The full shape lives in types.ts. */
export interface MechanicsReview {
  id: string;
  status: string;
  cycleDuration?: string;
  communicationRating?: number;
  negotiationLevel?: number;
  timeWasterLevel?: number;
  clarityOfScope?: number;
  frictionEvents?: string[];
  verbalToSignature?: string;
  closeSlippage?: string;
  wentDark?: boolean;
  paymentTerms?: string;
  procurementEntry?: string;
  stakeholderCount?: string;
}

/**
 * A brief needs at least one review. The per-flag evidence bar in accountFlags.ts
 * is what scales confidence with sample size - this gate only stops an empty
 * account rendering an empty panel.
 */
export const MIN_MECHANICS_REVIEWS = 1;

/**
 * Duration brackets in CHRONOLOGICAL order.
 *
 * Deliberately NOT lib/reviewSchema's DURATION_BRACKETS: that list is a
 * validation allowlist with the legacy "12+ Months" appended at the end, so
 * ranking by its index would sort a legacy v1 answer as the LONGEST cycle on
 * record. Legacy is normalized down instead - conservative, matching
 * src/utils/reviewSchema.ts, so aggregates never overstate cycle length.
 */
const CHRONOLOGICAL_DURATIONS = [
  "< 1 Month",
  "1-3 Months",
  "3-6 Months",
  "6-12 Months",
  "12-18 Months",
  "18-24 Months",
  "24+ Months",
] as const;

const LEGACY_DURATION_BRACKET = "12+ Months";

function normalizeDurationBracket(b: string): string | null {
  if ((CHRONOLOGICAL_DURATIONS as readonly string[]).includes(b)) return b;
  if (b === LEGACY_DURATION_BRACKET) return "12-18 Months";
  return null;
}

/** Most common known value for a field, with the count of reviews that answered it. */
export interface ModalStat {
  value: string;
  count: number;
  total: number;
}

/** "N of M reviews matched", with the matching review IDs for citation. */
export interface RateStat {
  count: number;
  total: number;
  reviewIds: string[];
}

/**
 * Most common non-sentinel value of `pick`. `sentinels` are enum members that
 * mean "no answer" (e.g. "Unknown") - they are excluded from both the winner
 * and the denominator. Returns null when nobody answered.
 */
export function modalOf(
  reviews: MechanicsReview[],
  pick: (r: MechanicsReview) => string | undefined,
  sentinels: string[] = [],
): ModalStat | null {
  const values = reviews
    .map(pick)
    .filter((v): v is string => typeof v === "string" && v.length > 0 && !sentinels.includes(v));
  if (values.length === 0) return null;

  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);

  let best = values[0];
  for (const [value, count] of counts) {
    if (count > (counts.get(best) ?? 0)) best = value;
  }
  return { value: best, count: counts.get(best) ?? 0, total: values.length };
}

/**
 * How many reviews satisfy `match`, out of those that answered at all
 * (`answered`). Collects matching review IDs so the UI can cite them.
 */
export function rateOf(
  reviews: MechanicsReview[],
  match: (r: MechanicsReview) => boolean,
  answered: (r: MechanicsReview) => boolean,
): RateStat {
  const pool = reviews.filter(answered);
  const hits = pool.filter(match);
  return { count: hits.length, total: pool.length, reviewIds: hits.map((r) => r.id) };
}

/** One procurement-gauntlet event, with how often this account triggered it. */
export interface FrictionStat {
  event: string;
  count: number;
  total: number;
  reviewIds: string[];
}

/**
 * Friction events ranked most-common first. Denominator is the number of
 * reviews that answered the friction question at all (`frictionEvents` present,
 * empty array included - that is a real "no friction observed" answer).
 * Events nobody reported are omitted entirely.
 */
export function frictionRanking(reviews: MechanicsReview[]): FrictionStat[] {
  const answered = reviews.filter((r) => Array.isArray(r.frictionEvents));
  const total = answered.length;
  if (total === 0) return [];

  return FRICTION_EVENTS.map((event) => {
    const hits = answered.filter((r) => r.frictionEvents!.includes(event));
    return { event, count: hits.length, total, reviewIds: hits.map((r) => r.id) };
  })
    .filter((s) => s.count > 0)
    .sort((a, b) => b.count - a.count);
}

/**
 * Median cycle length as a bracket label. Ranks by position in
 * CHRONOLOGICAL_DURATIONS, not by string sort.
 */
export function medianCycle(reviews: MechanicsReview[]): string | null {
  const ranks = reviews
    .map((r) => normalizeDurationBracket(r.cycleDuration ?? ""))
    .filter((b): b is string => b !== null)
    .map((b) => (CHRONOLOGICAL_DURATIONS as readonly string[]).indexOf(b))
    .sort((a, b) => a - b);
  if (ranks.length === 0) return null;
  return CHRONOLOGICAL_DURATIONS[ranks[Math.floor((ranks.length - 1) / 2)]];
}

/** Average of one 1-5 rating, with the number of reviews that supplied it. */
export interface RatingStat {
  average: number;
  total: number;
}

/**
 * The four execution ratings. ALL ARE HIGH-IS-GOOD despite the legacy field
 * names on Review (see types.ts) - a 5 for `negotiation` means the negotiation
 * was easy, not brutal. Never invert these.
 */
export interface Ratings {
  communication: RatingStat;
  negotiation: RatingStat;
  intent: RatingStat;
  scope: RatingStat;
}

/** Average one rating across the reviews that actually supplied it. */
export function ratingStat(
  reviews: MechanicsReview[],
  pick: (r: MechanicsReview) => number | undefined,
): RatingStat {
  const values = reviews
    .map(pick)
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v) && v > 0);
  if (values.length === 0) return { average: 0, total: 0 };
  const sum = values.reduce((a, v) => a + v, 0);
  return { average: Number((sum / values.length).toFixed(1)), total: values.length };
}

/** How this buyer actually buys, derived entirely from structured v2 fields. */
export interface DealMechanics {
  sampleSize: number;
  friction: FrictionStat[];
  procurementEntry: ModalStat | null;
  verbalToSignature: ModalStat | null;
  paymentTerms: ModalStat | null;
  stakeholderCount: ModalStat | null;
  /** Buyer went silent >2 weeks mid-cycle. */
  ghostRate: RateStat;
  /** Close date pushed twice or more. "Pushed once" is normal, not a finding. */
  slippageRate: RateStat;
  medianCycle: string | null;
  outcomeMix: { outcome: string; count: number }[];
  ratings: Ratings;
  /** Reviews that answered the friction question at all. An empty array is a real answer. */
  frictionAnswered: number;
}

const SLIPPED = ["Pushed twice", "Pushed 3+ times"];

export function getDealMechanics(reviews: MechanicsReview[]): DealMechanics | null {
  if (reviews.length < MIN_MECHANICS_REVIEWS) return null;

  const outcomeCounts = new Map<string, number>();
  for (const r of reviews) outcomeCounts.set(r.status, (outcomeCounts.get(r.status) ?? 0) + 1);

  return {
    sampleSize: reviews.length,
    friction: frictionRanking(reviews),
    procurementEntry: modalOf(reviews, (r) => r.procurementEntry, ["Unknown"]),
    verbalToSignature: modalOf(reviews, (r) => r.verbalToSignature, ["Unknown"]),
    paymentTerms: modalOf(reviews, (r) => r.paymentTerms, ["Unknown / N/A"]),
    stakeholderCount: modalOf(reviews, (r) => r.stakeholderCount, []),
    ghostRate: rateOf(
      reviews,
      (r) => r.wentDark === true,
      (r) => r.wentDark !== undefined,
    ),
    slippageRate: rateOf(
      reviews,
      (r) => SLIPPED.includes(r.closeSlippage ?? ""),
      (r) => typeof r.closeSlippage === "string" && r.closeSlippage !== "Unknown",
    ),
    medianCycle: medianCycle(reviews),
    outcomeMix: Array.from(outcomeCounts, ([outcome, count]) => ({ outcome, count })).sort(
      (a, b) => b.count - a.count,
    ),
    ratings: {
      communication: ratingStat(reviews, (r) => r.communicationRating),
      negotiation: ratingStat(reviews, (r) => r.negotiationLevel),
      intent: ratingStat(reviews, (r) => r.timeWasterLevel),
      scope: ratingStat(reviews, (r) => r.clarityOfScope),
    },
    frictionAnswered: reviews.filter((r) => Array.isArray(r.frictionEvents)).length,
  };
}
