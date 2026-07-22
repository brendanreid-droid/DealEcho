// Chrome Web Store listing for the DealEcho browser extension.
// TODO: replace PLACEHOLDER_EXTENSION_ID with the real listing URL once published (phase 2D).
export const CHROME_EXTENSION_URL =
  "https://chrome.google.com/webstore/detail/dealecho-sales-intelligence/PLACEHOLDER_EXTENSION_ID";

const DEPARTMENT_VALUES = [
  "IT / Engineering",
  "Security / InfoSec",
  "Data Privacy / DPO",
  "Procurement",
  "Finance / Treasury",
  "Legal / Compliance",
  "Executive Leadership (C-Suite)",
  "Marketing",
  "Sales / Business Development",
  "Operations / Enablement",
  "HR / People Ops",
  "Product Management",
  "Customer Success / Support",
  "Supply Chain / Logistics",
  "Facilities / Real Estate",
  "R&D / Innovation",
  "Strategy / Corporate Dev",
  "Quality Assurance / QA",
  "Regulatory / Gov Affairs",
  "External Consultants / Advisors",
  "Board of Directors",
] as const;

export const DEPARTMENTS = [...DEPARTMENT_VALUES].sort();

export type Department = (typeof DEPARTMENTS)[number];

/** Ordered smallest → largest. USD-denominated. Used in forms and analytics matrix. */
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
] as const;

export type TcvBracket = (typeof TCV_BRACKETS)[number];

/** Stored by schema v1 reviews; normalized at read time (see src/utils/reviewSchema.ts). */
export const LEGACY_TCV_BRACKET = "$1M+";

/** Ordered shortest → longest. Used in forms and analytics matrix. */
export const DURATION_BRACKETS = [
  "< 1 Month",
  "1-3 Months",
  "3-6 Months",
  "6-12 Months",
  "12-18 Months",
  "18-24 Months",
  "24+ Months",
] as const;

export type DurationBracket = (typeof DURATION_BRACKETS)[number];

/** Stored by schema v1 reviews; normalized at read time (see src/utils/reviewSchema.ts). */
export const LEGACY_DURATION_BRACKET = "12+ Months";

// ---------------------------------------------------------------------------
// Schema v2 enums. Server-side copy lives in functions/src/lib/reviewSchema.ts
// — keep the two files in sync when editing.
// ---------------------------------------------------------------------------

export const OUTCOMES = ["Won", "Lost", "No Decision", "Withdrew", "Ongoing"] as const;
export type Outcome = (typeof OUTCOMES)[number];

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
  "Hardware / Equipment",
  "Financial Services",
  "Telco / Infrastructure",
  "Other",
] as const;

export const SELLER_SIZES = ["1-10", "11-50", "51-200", "201-1000", "1000+"] as const;

/** Objective procurement-gauntlet events observed during the deal. */
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

/** Last 8 quarters, newest first, plus "Older". `now` injectable for tests. */
export function recentDealPeriods(now: Date = new Date()): string[] {
  const out: string[] = [];
  let q = Math.floor(now.getMonth() / 3) + 1;
  let y = now.getFullYear();
  for (let i = 0; i < 8; i++) {
    out.push(`Q${q} ${y}`);
    q--;
    if (q === 0) {
      q = 4;
      y--;
    }
  }
  out.push("Older");
  return out;
}
