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
