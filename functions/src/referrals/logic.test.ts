import { describe, it, expect } from "vitest";
import {
  REWARD_CAP_PER_YEAR,
  DAILY_INVITE_LIMIT,
  LIFETIME_INVITE_LIMIT,
  MAX_EMAILS_PER_CALL,
  INVITE_EXPIRY_DAYS,
  generateInviteToken,
  normaliseEmail,
  isValidEmail,
  isInviteExpired,
  expiryFor,
  qualifiesForReward,
  isCapReached,
  dayKeyFor,
  nextQuotaState,
} from "./logic";

describe("generateInviteToken", () => {
  it("produces a 32-character URL-safe token", () => {
    const token = generateInviteToken();
    expect(token).toHaveLength(32);
    expect(token).toMatch(/^[A-Za-z0-9_-]{32}$/);
  });

  it("does not repeat across many calls", () => {
    const tokens = new Set(Array.from({ length: 500 }, () => generateInviteToken()));
    expect(tokens.size).toBe(500);
  });
});

describe("normaliseEmail", () => {
  it("trims and lowercases", () => {
    expect(normaliseEmail("  Bob@Acme.COM ")).toBe("bob@acme.com");
  });

  it("returns an empty string for non-string input", () => {
    expect(normaliseEmail(undefined as unknown as string)).toBe("");
    expect(normaliseEmail(42 as unknown as string)).toBe("");
  });
});

describe("isValidEmail", () => {
  it("accepts ordinary work addresses", () => {
    expect(isValidEmail("bob@acme.com")).toBe(true);
    expect(isValidEmail("bob.smith+tag@sub.acme.co.uk")).toBe(true);
  });

  it("rejects malformed addresses", () => {
    expect(isValidEmail("bob")).toBe(false);
    expect(isValidEmail("bob@")).toBe(false);
    expect(isValidEmail("@acme.com")).toBe(false);
    expect(isValidEmail("bob@acme")).toBe(false);
    expect(isValidEmail("bob acme@test.com")).toBe(false);
    expect(isValidEmail("")).toBe(false);
  });

  it("rejects absurdly long addresses", () => {
    expect(isValidEmail(`${"a".repeat(250)}@acme.com`)).toBe(false);
  });
});

describe("expiryFor / isInviteExpired", () => {
  const sentAt = "2026-01-01T00:00:00.000Z";

  it("sets expiry INVITE_EXPIRY_DAYS after sending", () => {
    const expiresAt = expiryFor(sentAt);
    const days = (Date.parse(expiresAt) - Date.parse(sentAt)) / 86_400_000;
    expect(days).toBe(INVITE_EXPIRY_DAYS);
  });

  it("is not expired one day before the deadline", () => {
    expect(isInviteExpired({ expiresAt: expiryFor(sentAt) }, new Date("2026-02-28T00:00:00.000Z"))).toBe(false);
  });

  it("is expired one day after the deadline", () => {
    expect(isInviteExpired({ expiresAt: expiryFor(sentAt) }, new Date("2026-03-05T00:00:00.000Z"))).toBe(true);
  });

  it("treats a missing or unparseable expiry as expired", () => {
    expect(isInviteExpired({ expiresAt: undefined }, new Date())).toBe(true);
    expect(isInviteExpired({ expiresAt: "not-a-date" }, new Date())).toBe(true);
  });
});

describe("qualifiesForReward", () => {
  const invoice = (over: Record<string, unknown> = {}) => ({
    subscription: "sub_123",
    amount_paid: 2900,
    billing_reason: "subscription_cycle",
    ...over,
  });

  it("qualifies a paid renewal invoice", () => {
    expect(qualifiesForReward(invoice())).toBe(true);
  });

  it("qualifies a paid first invoice when the trial was skipped", () => {
    expect(qualifiesForReward(invoice({ billing_reason: "subscription_create" }))).toBe(true);
  });

  it("rejects a zero-amount trial invoice", () => {
    expect(qualifiesForReward(invoice({ amount_paid: 0 }))).toBe(false);
  });

  it("rejects an invoice with no subscription", () => {
    expect(qualifiesForReward(invoice({ subscription: null }))).toBe(false);
  });

  it("rejects mid-cycle updates and manual invoices", () => {
    expect(qualifiesForReward(invoice({ billing_reason: "subscription_update" }))).toBe(false);
    expect(qualifiesForReward(invoice({ billing_reason: "manual" }))).toBe(false);
  });

  it("rejects an invoice with no amount_paid field at all", () => {
    expect(qualifiesForReward(invoice({ amount_paid: undefined }))).toBe(false);
  });

  it("rejects a negative amount_paid", () => {
    expect(qualifiesForReward(invoice({ amount_paid: -2900 }))).toBe(false);
  });

  it("rejects an invoice with no billing_reason", () => {
    expect(qualifiesForReward(invoice({ billing_reason: undefined }))).toBe(false);
    expect(qualifiesForReward(invoice({ billing_reason: null }))).toBe(false);
  });

  it("reads the subscription from invoice.parent when the API moves it", () => {
    expect(
      qualifiesForReward({
        amount_paid: 2900,
        billing_reason: "subscription_cycle",
        parent: { subscription_details: { subscription: "sub_456" } },
      }),
    ).toBe(true);
  });
});

describe("isCapReached", () => {
  it("allows rewards below the cap", () => {
    expect(isCapReached(0)).toBe(false);
    expect(isCapReached(REWARD_CAP_PER_YEAR - 1)).toBe(false);
  });

  it("blocks at and beyond the cap", () => {
    expect(isCapReached(REWARD_CAP_PER_YEAR)).toBe(true);
    expect(isCapReached(REWARD_CAP_PER_YEAR + 5)).toBe(true);
  });
});

describe("dayKeyFor", () => {
  it("returns a UTC calendar day key", () => {
    expect(dayKeyFor(new Date("2026-07-28T23:59:59.000Z"))).toBe("2026-07-28");
    expect(dayKeyFor(new Date("2026-07-29T00:00:01.000Z"))).toBe("2026-07-29");
  });
});

describe("nextQuotaState", () => {
  const now = new Date("2026-07-28T10:00:00.000Z");

  it("starts a fresh counter when there is no prior state", () => {
    const out = nextQuotaState(undefined, 3, now);
    expect(out.allowed).toBe(3);
    expect(out.state).toEqual({ dayKey: "2026-07-28", sentToday: 3, sentLifetime: 3 });
  });

  it("accumulates within the same day", () => {
    const prior = { dayKey: "2026-07-28", sentToday: 5, sentLifetime: 40 };
    const out = nextQuotaState(prior, 2, now);
    expect(out.allowed).toBe(2);
    expect(out.state.sentToday).toBe(7);
    expect(out.state.sentLifetime).toBe(42);
  });

  it("resets the daily counter on a new day", () => {
    const prior = { dayKey: "2026-07-27", sentToday: DAILY_INVITE_LIMIT, sentLifetime: 40 };
    const out = nextQuotaState(prior, 2, now);
    expect(out.allowed).toBe(2);
    expect(out.state.sentToday).toBe(2);
    expect(out.state.sentLifetime).toBe(42);
  });

  it("clamps a request that would exceed the daily limit", () => {
    const prior = { dayKey: "2026-07-28", sentToday: DAILY_INVITE_LIMIT - 2, sentLifetime: 40 };
    const out = nextQuotaState(prior, 5, now);
    expect(out.allowed).toBe(2);
    expect(out.state.sentToday).toBe(DAILY_INVITE_LIMIT);
    expect(out.limitedBy).toBe("daily");
  });

  it("reports no limit when the whole request fits", () => {
    expect(nextQuotaState(undefined, 3, now).limitedBy).toBe("none");
  });

  it("distinguishes the lifetime ceiling from the daily one", () => {
    const prior = { dayKey: "2026-07-28", sentToday: 0, sentLifetime: LIFETIME_INVITE_LIMIT - 1 };
    expect(nextQuotaState(prior, 5, now).limitedBy).toBe("lifetime");
  });

  it("reports lifetime when both ceilings are exhausted", () => {
    const prior = {
      dayKey: "2026-07-28",
      sentToday: DAILY_INVITE_LIMIT,
      sentLifetime: LIFETIME_INVITE_LIMIT,
    };
    const out = nextQuotaState(prior, 3, now);
    expect(out.allowed).toBe(0);
    expect(out.limitedBy).toBe("lifetime");
  });

  it("allows nothing once the daily limit is spent", () => {
    const prior = { dayKey: "2026-07-28", sentToday: DAILY_INVITE_LIMIT, sentLifetime: 40 };
    expect(nextQuotaState(prior, 3, now).allowed).toBe(0);
  });

  it("clamps against the lifetime limit", () => {
    const prior = { dayKey: "2026-07-28", sentToday: 0, sentLifetime: LIFETIME_INVITE_LIMIT - 1 };
    const out = nextQuotaState(prior, 5, now);
    expect(out.allowed).toBe(1);
    expect(out.state.sentLifetime).toBe(LIFETIME_INVITE_LIMIT);
  });

  it("never returns a negative allowance", () => {
    const prior = { dayKey: "2026-07-28", sentToday: 999, sentLifetime: 9999 };
    expect(nextQuotaState(prior, 3, now).allowed).toBe(0);
  });
});

describe("limits", () => {
  // Only the two limits with contractual meaning are pinned: the cap is the
  // stated liability control, and the expiry is duplicated in the frontend's
  // src/utils/referral.ts, so the two must not drift apart.
  it("caps rewards at 12 per year and expires invites after 60 days", () => {
    expect(REWARD_CAP_PER_YEAR).toBe(12);
    expect(INVITE_EXPIRY_DAYS).toBe(60);
  });
});
