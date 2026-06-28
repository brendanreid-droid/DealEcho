export interface CompanyRef {
  companyId: string;
  companyName: string;
}

// NOTE: "technologies", "group", and "co" intentionally omitted from SUFFIXES.
// The spec test asserts normalizeName("Palantir Technologies") === "palantir technologies",
// which means "technologies" must NOT be stripped (it's a meaningful name token).
// Similarly "group" and "co" can be real name parts (e.g. "HubSpot Co"). Removing all three
// is the minimal correct fix to satisfy the spec while keeping other suffix-stripping intact.
const SUFFIXES = ["inc", "incorporated", "llc", "ltd", "limited", "corp", "corporation", "plc"];

/** Lowercase, strip punctuation and common corporate suffixes, collapse whitespace. */
export function normalizeName(name: string): string {
  const cleaned = (name || "")
    .toLowerCase()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const tokens = cleaned.split(" ").filter((t) => t && !SUFFIXES.includes(t));
  // If stripping suffixes removed everything (e.g. "LLC"), fall back to cleaned.
  return (tokens.length ? tokens.join(" ") : cleaned).trim();
}

/**
 * Pick the best candidate for a free-text company query.
 * Strategy: normalize both sides; score by token overlap, with a containment bonus.
 * Returns null if the best score is below threshold.
 */
export function bestNameMatch(query: string, candidates: CompanyRef[]): CompanyRef | null {
  const q = normalizeName(query);
  if (!q) return null;
  const qTokens = new Set(q.split(" "));

  let best: CompanyRef | null = null;
  let bestScore = 0;

  for (const cand of candidates) {
    const c = normalizeName(cand.companyName);
    if (!c) continue;
    const cTokens = c.split(" ");
    const overlap = cTokens.filter((t) => qTokens.has(t)).length;
    if (overlap === 0) continue;
    // Fraction of the shorter token set that overlaps — rewards "Datadog" ⊂ "Datadog Inc".
    const denom = Math.min(qTokens.size, cTokens.length);
    let score = overlap / denom;
    if (c === q || c.includes(q) || q.includes(c)) score += 0.5;
    if (score > bestScore) {
      bestScore = score;
      best = cand;
    }
  }

  return bestScore >= 0.75 ? best : null;
}
