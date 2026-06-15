/**
 * companyLogo — one place to derive a logo URL for a company.
 *
 * Replaces the scattered `https://logo.clearbit.com/${name}.com` guesses.
 * Problems with the old approach:
 *   - Clearbit's free Logo API has been sunset, so it's living on borrowed time.
 *   - `name + ".com"` is wrong for anything with a non-obvious domain
 *     (e.g. "REA Group" → reagroup.com is wrong; it's rea-group.com / realestate.com.au).
 *
 * Strategy:
 *   1. If the record has a real `domain` field, use Google's favicon service
 *      (free, stable, no sunset) at a reasonable size.
 *   2. Otherwise return undefined — CompanyLogo already renders a clean
 *      initials avatar when no URL is given, which is better than a broken image.
 *
 * MIGRATION NOTE: to get real logos, start storing a `domain` on review/company
 * records (collected in CreateReview). Until then this returns undefined and you
 * get the initials avatar everywhere — intentional, and better than wrong logos.
 */

export interface LogoSource {
  domain?: string; // e.g. "atlassian.com" — the real thing, when known
  name: string;
}

/** Returns a logo URL when a real domain is known, else undefined. */
export function companyLogoUrl({ domain }: LogoSource): string | undefined {
  if (domain && isPlausibleDomain(domain)) {
    // Google's favicon service: free, stable, decent quality at sz=128.
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(
      domain,
    )}&sz=128`;
  }
  return undefined;
}

/** Basic sanity check so we never request obviously-broken domains. */
function isPlausibleDomain(d: string): boolean {
  const trimmed = d.trim().toLowerCase();
  // must contain a dot and only domain-legal characters
  return /^[a-z0-9.-]+\.[a-z]{2,}$/.test(trimmed);
}

/**
 * Legacy bridge: derive a guess from a company name, but ONLY for records that
 * still have no stored domain. Kept conservative; returns undefined for
 * multi-word names where a guess would likely be wrong.
 */
export function guessDomainFromName(name: string): string | undefined {
  const cleaned = name.trim().toLowerCase();
  // Single token, alphanumeric → reasonable guess (e.g. "Atlassian" → atlassian.com)
  if (/^[a-z0-9]+$/.test(cleaned)) {
    return `${cleaned}.com`;
  }
  // Multi-word or punctuated names: too risky to guess, use initials avatar.
  return undefined;
}
