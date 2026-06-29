import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";

export interface MetricScores {
  communicationRating: number;
  negotiationLevel: number;
  timeWasterLevel: number;
  clarityOfScope: number;
}

export interface LookupSummary {
  companyId: string;
  companyName: string;
  reviewCount: number;
  rating: number;
  healthIndex: number;
  // Per-element aggregate averages (1–5). Optional: absent until the backend redeploys.
  metrics?: MetricScores;
}

export interface LookupReview {
  id: string;
  companyName: string;
  status: string;
  content: string;
  createdAt: string;
  communicationRating: number;
  negotiationLevel: number;
  timeWasterLevel: number;
  clarityOfScope: number;
}

export interface LookupResult {
  matched: boolean;
  isPro: boolean;
  companyId?: string;
  companyName?: string;
  summary?: LookupSummary;
  persona?: { summary?: string } | null;
  recentReviews?: LookupReview[];
}

export interface LookupInput {
  domain?: string;
  name?: string;
}

const callable = httpsCallable<LookupInput, LookupResult>(functions, "lookupCompanyReviews");

export async function lookupCompany(input: LookupInput): Promise<LookupResult> {
  const res = await callable(input);
  return res.data;
}
