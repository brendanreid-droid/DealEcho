import { Review } from "../types";

export type FlagType =
  | "ghosting" | "tire_kicker" | "ip_risk" | "brutal_procurement"
  | "champion_loss" | "scope_creep" | "legal_friction" | "budget_freeze";

export interface Flag {
  type: FlagType;
  severity: "critical" | "caution";
  evidence: string;
  reviewIds: string[];
}

export interface MetricTrend {
  metric: "responsiveness" | "negotiation" | "intent" | "scope";
  current: number;
  direction: "up" | "down" | "flat";
  points: number[];
}

export interface AccountSignal {
  headline: string;
  sentiment: "positive" | "neutral" | "negative";
  flags: Flag[];
  trend: MetricTrend[];
}

const CRITICAL_TYPES: FlagType[] = ["champion_loss", "ip_risk", "budget_freeze"];

interface FlagRule {
  type: FlagType;
  keywords: string[];
  rating?: (r: Review) => boolean;
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

function healthIndex(reviews: Review[]): number {
  if (reviews.length === 0) return 0;
  const total = reviews.reduce(
    (a, r) => a + r.communicationRating + r.negotiationLevel + r.timeWasterLevel + (r.clarityOfScope || 3),
    0,
  );
  return Math.round((total / (reviews.length * 20)) * 100);
}

function buildFlags(reviews: Review[]): Flag[] {
  const byType = new Map<FlagType, Flag>();
  for (const r of reviews) {
    const text = r.content.toLowerCase();
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

function quarter(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}-Q${Math.floor(d.getUTCMonth() / 3) + 1}`;
}

function buildTrend(reviews: Review[]): MetricTrend[] {
  const metrics: { metric: MetricTrend["metric"]; pick: (r: Review) => number }[] = [
    { metric: "responsiveness", pick: (r) => r.communicationRating },
    { metric: "negotiation", pick: (r) => r.negotiationLevel },
    { metric: "intent", pick: (r) => r.timeWasterLevel },
    { metric: "scope", pick: (r) => r.clarityOfScope || 3 },
  ];
  const quarters = Array.from(new Set(reviews.map((r) => quarter(r.createdAt)))).sort();
  return metrics.map(({ metric, pick }) => {
    const points = quarters.map((q) => {
      const inQ = reviews.filter((r) => quarter(r.createdAt) === q);
      return inQ.length ? inQ.reduce((a, r) => a + pick(r), 0) / inQ.length : 0;
    });
    const current = points.length ? points[points.length - 1] : 0;
    const prev = points.length > 1 ? points[points.length - 2] : current;
    const diff = current - prev;
    const direction: MetricTrend["direction"] = diff > 0.2 ? "up" : diff < -0.2 ? "down" : "flat";
    return { metric, current: Number(current.toFixed(1)), direction, points };
  });
}

function headlineFor(sentiment: AccountSignal["sentiment"]): string {
  switch (sentiment) {
    case "positive": return "Receptive account with healthy momentum — lead with value and move quickly.";
    case "neutral": return "Mixed signals — qualify hard and secure a strong champion before investing.";
    case "negative": return "High-friction account — expect procurement and stakeholder risk; protect your terms.";
  }
}

// Frontend-first derived stub. Replace body with Gemini extraction in a later spec; contract stays fixed.
export const getAccountSignal = async (
  _companyName: string,
  reviews: Review[],
): Promise<AccountSignal> => {
  const health = healthIndex(reviews);
  const sentiment: AccountSignal["sentiment"] =
    health >= 67 ? "positive" : health >= 45 ? "neutral" : "negative";
  return {
    headline: headlineFor(sentiment),
    sentiment,
    flags: buildFlags(reviews),
    trend: buildTrend(reviews),
  };
};
