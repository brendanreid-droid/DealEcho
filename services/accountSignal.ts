import { Review } from "../types";

export interface MetricTrend {
  metric: "responsiveness" | "negotiation" | "intent" | "scope";
  current: number;
  direction: "up" | "down" | "flat";
  points: number[];
}

export interface AccountSignal {
  headline: string;
  sentiment: "positive" | "neutral" | "negative";
  trend: MetricTrend[];
}

function healthIndex(reviews: Review[]): number {
  if (reviews.length === 0) return 0;
  const total = reviews.reduce(
    (a, r) => a + r.communicationRating + r.negotiationLevel + r.timeWasterLevel + (r.clarityOfScope || 3),
    0,
  );
  return Math.round((total / (reviews.length * 20)) * 100);
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
    trend: buildTrend(reviews),
  };
};
