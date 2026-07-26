/** One recurring theme across review free text, with the reviews that support it. */
export interface AccountTheme {
  theme: string;
  reviewIds: string[];
}

/** Sellers scan. More than this and the themes stop being read. */
export const MAX_THEMES = 5;

/**
 * Strip anything the model invented. A theme survives only if it has a
 * non-empty label and at least one review ID that actually exists in the input
 * corpus. This is the difference between "3 sellers reported X [R2, R5, R7]"
 * and an unfalsifiable claim.
 */
export function validateThemes(raw: unknown, knownIds: string[]): AccountTheme[] {
  if (!Array.isArray(raw)) return [];
  const known = new Set(knownIds);
  const out: AccountTheme[] = [];

  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const theme = (entry as any).theme;
    const ids = (entry as any).reviewIds;
    if (typeof theme !== "string" || theme.trim().length === 0) continue;
    if (!Array.isArray(ids)) continue;

    const valid = Array.from(new Set(ids.filter((id: unknown) => typeof id === "string" && known.has(id))));
    if (valid.length === 0) continue;

    out.push({ theme: theme.trim(), reviewIds: valid });
    if (out.length === MAX_THEMES) break;
  }
  return out;
}
