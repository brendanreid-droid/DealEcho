/**
 * text.ts - copy hygiene helpers for anything rendered to a user.
 *
 * House style is plain hyphens, never em/en dashes. New review text is
 * normalised server-side on submit (functions/src/lib/text.ts), but reviews
 * stored before that rule existed still hold em dashes, so strip at read time
 * too. Keep the two files in sync - the workspaces cannot import each other.
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
