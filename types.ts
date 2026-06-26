
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
  status: 'Won' | 'Lost' | 'Ongoing';
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
  createdAt: string;
}

export interface AIModerationResult {
  isSafe: boolean;
  reason?: string;
  flaggedSegments?: string[];
}
