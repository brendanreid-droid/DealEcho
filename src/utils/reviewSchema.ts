import {
  TCV_BRACKETS,
  DURATION_BRACKETS,
  LEGACY_TCV_BRACKET,
  LEGACY_DURATION_BRACKET,
  DEAL_REGIONS,
  TcvBracket,
  DurationBracket,
} from "../constants/dealData";
import { Review } from "../../types";

/**
 * Read-time normalization for bracket values. Schema v1 reviews stored the
 * catch-all "$1M+" / "12+ Months"; v2 split those into finer brackets. Legacy
 * values are bucketed CONSERVATIVELY into the lowest matching new bracket so
 * aggregates never overstate deal size or cycle length. No Firestore migration.
 */
export function normalizeTcvBracket(b: string): TcvBracket | null {
  if ((TCV_BRACKETS as readonly string[]).includes(b)) return b as TcvBracket;
  if (b === LEGACY_TCV_BRACKET) return "$1M - $2.5M";
  return null;
}

export function normalizeDurationBracket(b: string): DurationBracket | null {
  if ((DURATION_BRACKETS as readonly string[]).includes(b)) return b as DurationBracket;
  if (b === LEGACY_DURATION_BRACKET) return "12-18 Months";
  return null;
}

/**
 * Best-effort default for the "Region Sold Into" select from the verified
 * company's country. Editable by the reviewer; unknown countries fall back to
 * "Global / Multi-region" (an honest "unspecified", never a wrong guess).
 */
const COUNTRY_REGION_MAP: Record<string, (typeof DEAL_REGIONS)[number]> = {
  usa: "North America",
  "united states": "North America",
  us: "North America",
  canada: "North America",
  mexico: "Latin America",
  brazil: "Latin America",
  argentina: "Latin America",
  chile: "Latin America",
  colombia: "Latin America",
  uk: "UK & Ireland",
  "united kingdom": "UK & Ireland",
  ireland: "UK & Ireland",
  germany: "Europe",
  france: "Europe",
  netherlands: "Europe",
  spain: "Europe",
  italy: "Europe",
  sweden: "Europe",
  switzerland: "Europe",
  poland: "Europe",
  israel: "Middle East & Africa",
  uae: "Middle East & Africa",
  "united arab emirates": "Middle East & Africa",
  "saudi arabia": "Middle East & Africa",
  "south africa": "Middle East & Africa",
  india: "Asia",
  singapore: "Asia",
  japan: "Asia",
  china: "Asia",
  "south korea": "Asia",
  "hong kong": "Asia",
  australia: "Australia & NZ",
  "new zealand": "Australia & NZ",
};

export function countryToRegion(country: string): (typeof DEAL_REGIONS)[number] {
  return COUNTRY_REGION_MAP[country.trim().toLowerCase()] ?? "Global / Multi-region";
}

const SLIPPAGE_POINTS: Record<string, number> = {
  "Never pushed": 0,
  "Pushed once": 1,
  "Pushed twice": 2,
  "Pushed 3+ times": 3,
};

const V2S_POINTS: Record<string, number> = {
  "< 1 Week": 0,
  "1-4 Weeks": 1,
  "1-3 Months": 2,
  "3+ Months": 3,
};

const MAX_FRICTION_POINTS = 15; // 7 events + 3 slippage + 2 ghosting + 3 verbal lag

/**
 * 0–100 composite of objective friction signals. Null for schema v1 reviews
 * (fields absent → score would be meaningless, not zero). "Unknown" answers
 * contribute 0 rather than excluding the review, so partial answers still count.
 */
export function frictionScore(r: Review): number | null {
  if ((r.schemaVersion ?? 1) < 2) return null;
  let pts = Math.min(r.frictionEvents?.length ?? 0, 7);
  pts += SLIPPAGE_POINTS[r.closeSlippage ?? ""] ?? 0;
  if (r.wentDark) pts += 2;
  pts += V2S_POINTS[r.verbalToSignature ?? ""] ?? 0;
  return Math.round((pts / MAX_FRICTION_POINTS) * 100);
}
