import { LookupReview } from "../lib/api";

// Ported verbatim from the web app's services/accountSignal.ts so the extension
// surfaces the same red flags with the same labels/severity.
export type FlagType =
  | "ghosting"
  | "tire_kicker"
  | "ip_risk"
  | "brutal_procurement"
  | "champion_loss"
  | "scope_creep"
  | "legal_friction"
  | "budget_freeze";

export interface Flag {
  type: FlagType;
  severity: "critical" | "caution";
  evidence: string;
  reviewIds: string[];
}

export const FLAG_LABELS: Record<FlagType, string> = {
  ghosting: "Ghosting",
  tire_kicker: "Tire kicker",
  ip_risk: "IP risk",
  brutal_procurement: "Brutal procurement",
  champion_loss: "Champion loss",
  scope_creep: "Scope creep",
  legal_friction: "Legal friction",
  budget_freeze: "Budget freeze",
};

const CRITICAL_TYPES: FlagType[] = ["champion_loss", "ip_risk", "budget_freeze"];

interface FlagRule {
  type: FlagType;
  keywords: string[];
  rating?: (r: LookupReview) => boolean;
}

const RULES: FlagRule[] = [
  { type: "ghosting", keywords: ["ghost"], rating: (r) => r.communicationRating <= 2 },
  { type: "tire_kicker", keywords: ["tire kicker", "tire-kicker", "benchmark"], rating: (r) => r.timeWasterLevel <= 2 },
  { type: "brutal_procurement", keywords: ["procurement", "discount", "reverse-auction"], rating: (r) => r.negotiationLevel <= 2 },
  { type: "scope_creep", keywords: ["scope creep", "scope"], rating: (r) => r.clarityOfScope <= 2 },
  { type: "champion_loss", keywords: ["champion left", "champion was", "lost the deal", "vetoed"] },
  { type: "ip_risk", keywords: ["build a basic version", "internally", "implementation logic"] },
  { type: "legal_friction", keywords: ["msa", "legal", "indemnity", "liability"] },
  { type: "budget_freeze", keywords: ["budget freeze", "freeze", "merger"] },
];

/** Derive red flags from a set of reviews (keyword + low-rating rules). */
export function buildFlags(reviews: LookupReview[]): Flag[] {
  const byType = new Map<FlagType, Flag>();
  for (const r of reviews) {
    const text = (r.content || "").toLowerCase();
    for (const rule of RULES) {
      const kw = rule.keywords.find((k) => text.includes(k));
      const ratingHit = rule.rating ? rule.rating(r) : false;
      if (!kw && !ratingHit) continue;
      const existing = byType.get(rule.type);
      if (existing) {
        existing.reviewIds.push(r.id);
        if (!existing.evidence && kw) existing.evidence = r.content;
      } else {
        byType.set(rule.type, {
          type: rule.type,
          severity: CRITICAL_TYPES.includes(rule.type) ? "critical" : "caution",
          evidence: kw ? r.content : "",
          reviewIds: [r.id],
        });
      }
    }
  }
  return Array.from(byType.values()).sort(
    (a, b) => Number(b.severity === "critical") - Number(a.severity === "critical"),
  );
}
