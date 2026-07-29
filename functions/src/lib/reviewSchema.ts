/**
 * Server-side copy of the review schema v2 enums.
 * SOURCE OF TRUTH for the frontend is src/constants/dealData.ts — the functions
 * workspace cannot import across workspaces, so keep this file in sync by hand.
 */

export const TCV_BRACKETS = [
  "< $10k",
  "$10k - $25k",
  "$25k - $50k",
  "$50k - $100k",
  "$100k - $250k",
  "$250k - $500k",
  "$500k - $750k",
  "$750k - $1M",
  "$1M - $2.5M",
  "$2.5M - $5M",
  "$5M - $10M",
  "$10M+",
  // Legacy v1 value — accepted on resubmit of old rejected reviews so we never
  // silently rewrite a legacy bracket into a wrong one.
  "$1M+",
] as const;

export const DURATION_BRACKETS = [
  "< 1 Month",
  "1-3 Months",
  "3-6 Months",
  "6-12 Months",
  "12-18 Months",
  "18-24 Months",
  "24+ Months",
  "12+ Months", // legacy v1, accepted on resubmit
] as const;

export const OUTCOMES = ["Won", "Lost", "No Decision", "Withdrew", "Ongoing"] as const;

export const DEAL_TYPES = [
  "New Business",
  "Renewal",
  "Expansion / Upsell",
  "Channel / Partner-led",
] as const;

export const DEAL_REGIONS = [
  "North America",
  "Latin America",
  "UK & Ireland",
  "Europe",
  "Middle East & Africa",
  "Asia",
  "Australia & NZ",
  "Global / Multi-region",
] as const;

export const CURRENCIES = ["USD", "AUD", "EUR", "GBP", "Other"] as const;

export const SELLER_CATEGORIES = [
  "Software / SaaS",
  "IT Services / Consulting",
  "Professional Services (Legal / Accounting / Advisory)",
  "Hardware / Equipment",
  "Industrial / Manufacturing",
  "Construction / Facilities",
  "Logistics / Supply Chain",
  "Marketing / Media / Agency",
  "Financial Services",
  "Insurance",
  "Telco / Infrastructure",
  "Energy / Utilities",
  "Healthcare / Life Sciences",
  "HR / Recruitment / Training",
  "Travel / Events / Corporate Services",
  "Other",
] as const;

export const SELLER_SIZES = ["1-10", "11-50", "51-200", "201-1000", "1000+"] as const;

export const FRICTION_EVENTS = [
  "Security questionnaire",
  "SOC 2 / pen test required",
  "Legal redlines on MSA",
  "Pilot / POC required",
  "Reference calls required",
  "Vendor onboarding portal",
  "Reverse auction / e-procurement",
] as const;

export const VERBAL_TO_SIGNATURE = [
  "< 1 Week",
  "1-4 Weeks",
  "1-3 Months",
  "3+ Months",
  "No verbal commit",
  "Unknown",
] as const;

export const CLOSE_SLIPPAGE = [
  "Never pushed",
  "Pushed once",
  "Pushed twice",
  "Pushed 3+ times",
  "Unknown",
] as const;

export const PAYMENT_TERMS = ["Net 30", "Net 60", "Net 90", "Net 120+", "Unknown / N/A"] as const;

export const PROCUREMENT_ENTRY = [
  "Early (before shortlist)",
  "Mid-cycle",
  "After verbal commit",
  "Never involved",
  "Unknown",
] as const;

export const STAKEHOLDER_COUNTS = ["1-2", "3-5", "6-10", "10+"] as const;

/** Coerce `v` to a member of `list`, else `fallback`. */
export function enumOr(list: readonly string[], v: unknown, fallback: string): string {
  return typeof v === "string" && list.includes(v) ? v : fallback;
}

/**
 * Normalize a client-supplied company domain, or "" if it is not usable.
 *
 * Stored on the review so logos can be derived later. Every consumer currently
 * falls back to guessing a domain from the company name, which by design
 * returns nothing for any multi-word name - so "Crown Resorts" and "Australia
 * Post" could never show a logo no matter how the UI was written.
 *
 * Strict on the way in: this value ends up inside an outbound image URL, so a
 * hostname is the only acceptable shape. Anything carrying a path, a port,
 * credentials, or a scheme other than http(s) is rejected outright rather than
 * salvaged - a wrong logo is worse than the initials avatar.
 */
export function normalizeDomain(v: unknown): string {
  if (typeof v !== "string") return "";
  let host = v.trim().toLowerCase();
  if (!host || host.length > 253) return "";

  // Accept a full URL, but only over http(s), and only when nothing is smuggled
  // in the userinfo section.
  if (host.includes("://")) {
    const m = /^https?:\/\/([^/?#]+)/.exec(host);
    if (!m) return "";
    host = m[1];
  }
  if (host.includes("@")) return "";
  host = host.split("/")[0].split("?")[0].split("#")[0].split(":")[0];
  host = host.replace(/^www\./, "");

  // Letters, digits, dots and hyphens only, at least one dot, a real TLD, and
  // no empty or hyphen-edged label.
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(host)) return "";
  if (host.split(".").some((label) => !label || label.startsWith("-") || label.endsWith("-"))) {
    return "";
  }
  return host;
}
