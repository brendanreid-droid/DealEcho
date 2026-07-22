
export interface Company {
  id: string;
  name: string;
  industry: string;
  domain?: string;
  country: string;
  description?: string;
  logoUrl?: string;
  rating?: number;
  healthIndex?: number;
  reports?: number;
}

export interface Review {
  id: string;
  companyId: string;
  companyName: string;
  userId: string;
  userName: string;
  currency: string;
  tcvBracket: string;
  cycleDuration: string;
  status: 'Won' | 'Lost' | 'No Decision' | 'Withdrew' | 'Ongoing';
  isTender: boolean;
  buyingTeam: string[];
  location: string;
  communicationRating: number; // Responsiveness: 1 (Ghosting) → 5 (Instant). Higher = better.
  negotiationLevel: number; // Negotiation Ease: 1 (Brutal) → 5 (Instant). Higher = better.
  timeWasterLevel: number; // Buyer Intent: 1 (Tire Kicker) → 5 (Critical). Higher = better.
  // NOTE: negotiationLevel / timeWasterLevel are legacy field names whose stored
  // semantics are HIGH-IS-GOOD (see CreateReview star tooltips). Do NOT invert
  // them when aggregating into health scores.
  clarityOfScope: number; // Scope Maturity: 1 (Vague) → 5 (Crystal Clear). Higher = better.
  industry: string;
  country: string;
  content: string;
  logoUrl?: string;
  createdAt: string;

  // --- Schema v2 (2026-07). Absent on legacy reviews; set server-side. ---
  schemaVersion?: number;
  dealType?: string; // DEAL_TYPES
  dealRegion?: string; // DEAL_REGIONS — region sold INTO (buying entity), not company HQ
  dealPeriod?: string; // e.g. "Q3 2026" or "Older" — when the deal concluded/stalled
  sellerCategory?: string; // SELLER_CATEGORIES — what the reviewer sells
  sellerSize?: string; // SELLER_SIZES — reviewer's company headcount
  frictionEvents?: string[]; // FRICTION_EVENTS subset; empty array = none observed
  verbalToSignature?: string; // VERBAL_TO_SIGNATURE
  closeSlippage?: string; // CLOSE_SLIPPAGE
  wentDark?: boolean; // buyer went silent >2 weeks mid-cycle
  paymentTerms?: string; // PAYMENT_TERMS
  procurementEntry?: string; // PROCUREMENT_ENTRY
  stakeholderCount?: string; // STAKEHOLDER_COUNTS
}

export interface AIModerationResult {
  isSafe: boolean;
  reason?: string;
  flaggedSegments?: string[];
}
