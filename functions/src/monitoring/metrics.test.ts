import { describe, it, expect } from "vitest";
import { buildMetrics, deltas, MetricsUser, MetricsReview } from "./metrics";

const NOW = new Date("2026-07-31T00:00:00.000Z").getTime();
const daysAgo = (n: number) => new Date(NOW - n * 86400000).toISOString();

const user = (over: Partial<MetricsUser> = {}): MetricsUser => ({
  uid: "u1",
  tier: "free",
  ...over,
});

const review = (over: Partial<MetricsReview> = {}): MetricsReview => ({
  id: "r1",
  userId: "u1",
  companyId: "c1",
  createdAt: daysAgo(1),
  moderationStatus: "approved",
  ...over,
});

describe("buildMetrics", () => {
  it("counts users by tier, ignoring blanks", () => {
    const m = buildMetrics(
      [
        user({ uid: "a", tier: "free" }),
        user({ uid: "b", tier: "paid_monthly" }),
        user({ uid: "c", tier: "paid_monthly" }),
        user({ uid: "d", tier: undefined }),
      ],
      [],
      NOW,
    );
    expect(m.users.total).toBe(4);
    expect(m.users.byTier).toEqual({ free: 1, paid_monthly: 2 });
  });

  it("counts active accounts in each trailing window", () => {
    const m = buildMetrics(
      [
        user({ uid: "a", behavior: { lastActiveAt: daysAgo(2) } }),
        user({ uid: "b", behavior: { lastActiveAt: daysAgo(20) } }),
        user({ uid: "c", behavior: { lastActiveAt: daysAgo(60) } }),
        user({ uid: "d" }), // never active
      ],
      [],
      NOW,
    );
    expect(m.active.last7).toBe(1);
    expect(m.active.last30).toBe(2);
  });

  it("ignores an unparseable lastActiveAt rather than counting it as active", () => {
    const m = buildMetrics([user({ behavior: { lastActiveAt: "whenever" } })], [], NOW);
    expect(m.active.last7).toBe(0);
  });

  it("splits recent reviews by moderation outcome", () => {
    const m = buildMetrics(
      [],
      [
        review({ id: "a", createdAt: daysAgo(1), moderationStatus: "approved" }),
        review({ id: "b", createdAt: daysAgo(2), moderationStatus: "rejected" }),
        review({ id: "c", createdAt: daysAgo(3), moderationStatus: "pending" }),
        review({ id: "d", createdAt: daysAgo(30) }), // outside the window
      ],
      NOW,
    );
    expect(m.reviews.total).toBe(4);
    expect(m.reviews.submitted7).toBe(3);
    expect(m.reviews.approved7).toBe(1);
    expect(m.reviews.rejected7).toBe(1);
  });

  it("treats a review with no moderationStatus as approved", () => {
    // Legacy rows predate moderation and are live on the site; dropping them
    // would understate the corpus.
    const m = buildMetrics([], [review({ moderationStatus: undefined })], NOW);
    expect(m.reviews.approved7).toBe(1);
    expect(m.companies.withReviews).toBe(1);
  });

  it("measures give-to-get conversion as a share of all accounts", () => {
    const m = buildMetrics(
      [user({ uid: "a" }), user({ uid: "b" }), user({ uid: "c" }), user({ uid: "d" })],
      [review({ id: "r1", userId: "a" }), review({ id: "r2", userId: "a" }), review({ id: "r3", userId: "b" })],
      NOW,
    );
    // Two distinct authors out of four accounts - not three reviews out of four.
    expect(m.reviewers.everWritten).toBe(2);
    expect(m.reviewers.sharePct).toBe(50);
  });

  it("does not divide by zero on an empty account base", () => {
    const m = buildMetrics([], [], NOW);
    expect(m.reviewers.sharePct).toBe(0);
    expect(m.users.total).toBe(0);
  });

  it("counts distinct companies, not reviews, and only published ones", () => {
    const m = buildMetrics(
      [],
      [
        review({ id: "a", companyId: "c1" }),
        review({ id: "b", companyId: "c1" }),
        review({ id: "c", companyId: "c2" }),
        review({ id: "d", companyId: "c3", moderationStatus: "rejected" }),
      ],
      NOW,
    );
    expect(m.companies.withReviews).toBe(2);
  });

  it("stamps the date the snapshot describes", () => {
    expect(buildMetrics([], [], NOW).date).toBe("2026-07-31");
  });
});

describe("deltas", () => {
  const snap = (over: Record<string, any> = {}) =>
    buildMetrics(
      [user({ uid: "a" }), user({ uid: "b" })],
      [review({ id: "r1", userId: "a" })],
      NOW,
    ) as any as ReturnType<typeof buildMetrics> & typeof over;

  it("reports movement against the previous snapshot", () => {
    const prev = buildMetrics([user({ uid: "a" })], [], NOW - 86400000);
    const d = deltas(snap(), prev);
    expect(d.users).toBe(1);
    expect(d.reviews).toBe(1);
  });

  it("returns null rather than inventing a change when there is no history", () => {
    // Day one must read "new", not "+100%".
    const d = deltas(snap(), null);
    expect(d.users).toBeNull();
    expect(d.active7).toBeNull();
  });
});
