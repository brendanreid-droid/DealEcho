export const DEPARTMENTS = [
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
].sort() as const;

export type Department = (typeof DEPARTMENTS)[number];

/** Ordered smallest → largest. Used in forms and analytics matrix. */
export const TCV_BRACKETS = [
  "< $10k",
  "$10k - $25k",
  "$25k - $50k",
  "$50k - $100k",
  "$100k - $250k",
  "$250k - $500k",
  "$500k - $750k",
  "$750k - $1M",
  "$1M+",
] as const;

export type TcvBracket = (typeof TCV_BRACKETS)[number];

/** Ordered shortest → longest. Used in forms and analytics matrix. */
export const DURATION_BRACKETS = [
  "< 1 Month",
  "1-3 Months",
  "3-6 Months",
  "6-12 Months",
  "12+ Months",
] as const;

export type DurationBracket = (typeof DURATION_BRACKETS)[number];
