/**
 * text.ts - copy hygiene helpers for anything shown to a user.
 *
 * House style is plain hyphens, never em/en dashes. Prompts ask Gemini for
 * that, but a model will ignore it eventually, and older cached output (e.g.
 * personas written before the rule existed) still holds em dashes. Strip on
 * the way out so both cases are covered.
 */

const DASHES = /[—–―‒]/g;

/** Replace em/en dashes with a plain hyphen. */
export function stripEmDashes(text: string): string {
  return text.replace(DASHES, "-");
}

/** stripEmDashes over every string in an arbitrary JSON-ish value. */
export function stripEmDashesDeep<T>(value: T): T {
  if (typeof value === "string") return stripEmDashes(value) as unknown as T;
  if (Array.isArray(value)) return value.map(stripEmDashesDeep) as unknown as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = stripEmDashesDeep(v);
    }
    return out as unknown as T;
  }
  return value;
}
