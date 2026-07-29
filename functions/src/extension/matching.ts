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

/** First label of a registrable domain: "crownresorts.com.au" → "crownresorts". */
export function domainLabel(domain: string): string {
  return (domain || "").split(".")[0].trim().toLowerCase();
}

/**
 * Shortest label that may claim an account. Below this, a prefix match is a
 * coincidence rather than a signal - "crow" prefixes "crownresorts", and a
 * three-letter label prefixes half the register.
 */
const MIN_DOMAIN_LABEL = 5;

/** Normalized, despaced: "Genesis Energy Limited" → "genesisenergy". */
function despace(name: string): string {
  return normalizeName(name).replace(/\s+/g, "");
}

/**
 * Match a domain label to a company by comparing despaced names.
 *
 * `bestNameMatch` cannot do this: it scores by token overlap, and a domain label
 * is a single concatenated token ("crownresorts") while the company name is
 * several ("Crown Resorts"), so overlap is zero and the score is zero. That gap
 * left `canonicalizeViaAI` as the only route to an answer for an uncached
 * domain - a Gemini call whose miss returned "no reviews" for a company that
 * plainly has them, with a retry usually succeeding.
 *
 * Deterministic, so the same domain resolves the same way every time.
 */
export function matchByDomainLabel(label: string, candidates: CompanyRef[]): CompanyRef | null {
  const l = despace(label);
  if (l.length < MIN_DOMAIN_LABEL) return null;

  let best: CompanyRef | null = null;
  let bestDelta = Infinity;

  for (const cand of candidates) {
    const c = despace(cand.companyName);
    if (!c) continue;
    // A candidate SHORTER than the label may only match on its own merits: it
    // has to clear the same length bar the label does.
    const prefixMatch = c.startsWith(l) || (c.length >= MIN_DOMAIN_LABEL && l.startsWith(c));
    if (!prefixMatch) continue;
    // Closest length wins, so "crownresorts" prefers "Crown Resorts" over both
    // "Crown" and "Crown Resorts Entertainment Group".
    const delta = Math.abs(c.length - l.length);
    if (delta < bestDelta) {
      bestDelta = delta;
      best = cand;
    }
  }

  return best;
}
