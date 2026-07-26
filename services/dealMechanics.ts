import { Review } from "../types";
import { DURATION_BRACKETS, FRICTION_EVENTS } from "../src/constants/dealData";
import { normalizeDurationBracket } from "../src/utils/reviewSchema";

/**
 * Deterministic aggregation of schema v2 review fields into "how this buyer
 * actually buys". No AI, no network — the same reviews always produce the same
 * brief, and every number is traceable to review IDs.
 *
 * Schema v2 fields are optional (legacy v1 reviews lack them), so every stat
 * carries its OWN denominator. Never divide by reviews.length.
 */

/** Below this many reviews a pattern is one person's bad week, not a finding. */
export const MIN_MECHANICS_REVIEWS = 3;

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
 * mean "no answer" (e.g. "Unknown") — they are excluded from both the winner
 * and the denominator. Returns null when nobody answered.
 */
export function modalOf(
  reviews: Review[],
  pick: (r: Review) => string | undefined,
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
  reviews: Review[],
  match: (r: Review) => boolean,
  answered: (r: Review) => boolean,
): RateStat {
  const pool = reviews.filter(answered);
  const hits = pool.filter(match);
  return { count: hits.length, total: pool.length, reviewIds: hits.map((r) => r.id) };
}
