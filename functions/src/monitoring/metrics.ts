/**
 * Daily product metrics, computed from raw user and review records.
 *
 * Pure on purpose: every number here is an aggregate over the whole account
 * base, which is exactly the kind of thing that is painful to verify once it is
 * tangled up in Firestore reads. The scheduled job does the reading; this does
 * the counting.
 *
 * Scoped deliberately to questions GA4 and Vercel cannot answer, because they
 * cannot join to Dealecho accounts. No pageview counts live here - those exist
 * twice over already.
 */

export interface MetricsUser {
  uid: string;
  tier?: string;
  role?: string;
  subscriptionStatus?: string | null;
  behavior?: { lastActiveAt?: string };
}

export interface MetricsReview {
  id: string;
  userId?: string;
  companyId?: string;
  createdAt?: string;
  moderationStatus?: string;
}

export interface MetricsSnapshot {
  date: string;
  users: { total: number; byTier: Record<string, number> };
  /** Accounts with recorded activity in the trailing window. */
  active: { last7: number; last30: number };
  reviews: { total: number; submitted7: number; approved7: number; rejected7: number };
  /** Give-to-get conversion: how many accounts have ever written a review. */
  reviewers: { everWritten: number; sharePct: number };
  companies: { withReviews: number };
  subscriptions: Record<string, number>;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Parse an ISO date defensively - legacy rows carry all sorts. */
function time(iso: string | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : null;
}

/** Count occurrences of a key, skipping blanks so "unknown" never becomes a tier. */
function tally(values: (string | null | undefined)[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const v of values) {
    if (typeof v !== "string" || !v.trim()) continue;
    out[v] = (out[v] ?? 0) + 1;
  }
  return out;
}

export function buildMetrics(
  users: MetricsUser[],
  reviews: MetricsReview[],
  now: number = Date.now(),
): MetricsSnapshot {
  const since = (days: number) => now - days * DAY_MS;

  const activeSince = (days: number) =>
    users.filter((u) => {
      const t = time(u.behavior?.lastActiveAt);
      return t !== null && t >= since(days);
    }).length;

  const inWindow = (r: MetricsReview, days: number) => {
    const t = time(r.createdAt);
    return t !== null && t >= since(days);
  };

  // A review with no moderationStatus predates moderation and is published,
  // so it counts as approved rather than being dropped.
  const isApproved = (r: MetricsReview) =>
    !r.moderationStatus || r.moderationStatus === "approved";

  const authors = new Set(reviews.map((r) => r.userId).filter(Boolean));
  const total = users.length;

  return {
    date: new Date(now).toISOString().slice(0, 10),
    users: { total, byTier: tally(users.map((u) => u.tier)) },
    active: { last7: activeSince(7), last30: activeSince(30) },
    reviews: {
      total: reviews.length,
      submitted7: reviews.filter((r) => inWindow(r, 7)).length,
      approved7: reviews.filter((r) => inWindow(r, 7) && isApproved(r)).length,
      rejected7: reviews.filter((r) => inWindow(r, 7) && r.moderationStatus === "rejected").length,
    },
    reviewers: {
      everWritten: authors.size,
      // Rounded to a whole percent: the precision beyond that is noise at any
      // account count where the number is interesting.
      sharePct: total ? Math.round((authors.size / total) * 100) : 0,
    },
    companies: {
      withReviews: new Set(reviews.filter(isApproved).map((r) => r.companyId).filter(Boolean)).size,
    },
    subscriptions: tally(users.map((u) => u.subscriptionStatus)),
  };
}

/**
 * Change between two snapshots, for the numbers worth watching week to week.
 * Returns null for a metric the older snapshot did not carry, so a field added
 * later shows "new" rather than a fabricated +100%.
 */
export function deltas(current: MetricsSnapshot, previous?: MetricsSnapshot | null) {
  const diff = (a: number, b: number | undefined) => (typeof b === "number" ? a - b : null);
  return {
    users: diff(current.users.total, previous?.users.total),
    active7: diff(current.active.last7, previous?.active.last7),
    reviews: diff(current.reviews.total, previous?.reviews.total),
    reviewers: diff(current.reviewers.everWritten, previous?.reviewers.everWritten),
    companies: diff(current.companies.withReviews, previous?.companies.withReviews),
  };
}
