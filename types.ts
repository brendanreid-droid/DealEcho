
export interface Company {
  id: string;
  name: string;
  industry: string;
  domain?: string;
  country: string;
  description?: string;
  logoUrl?: string;
  rating?: number;
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
  communicationRating: number;
  negotiationLevel: number; // 1 (Easy) to 5 (Aggressive)
  timeWasterLevel: number; // 1 (Productive) to 5 (Tire Kicker)
  clarityOfScope: number; // 1 (Vague) to 5 (Crystal Clear)
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
