import { describe, it, expect } from "vitest";
import {
  Recipient,
  isMarketable,
  selectSignupNudgeTargets,
  selectMonthlyPromptTargets,
  selectReengagementTargets,
  monthKey,
  pickMonthlyVariant,
  firstName,
} from "./lifecycle";

const NOW = new Date("2026-09-25T00:00:00.000Z");
const daysAgo = (n: number) =>
  new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000).toISOString();

function user(overrides: Partial<Recipient> = {}): Recipient {
  return {
    uid: "u1",
    email: "rep@acme.com",
    name: "Dana Reyes",
    createdAt: daysAgo(3),
    lastActiveAt: "",
    suspended: false,
    optedOutOfMarketing: false,
    signupNudgeSentAt: "",
    monthlyPromptSentAt: "",
    lastNudgedAt: "",
    ...overrides,
  };
}

describe("isMarketable", () => {
  it("rejects suspended, opted-out and email-less accounts", () => {
    expect(isMarketable(user())).toBe(true);
    expect(isMarketable(user({ suspended: true }))).toBe(false);
    expect(isMarketable(user({ optedOutOfMarketing: true }))).toBe(false);
    expect(isMarketable(user({ email: "" }))).toBe(false);
    expect(isMarketable(user({ email: "not-an-address" }))).toBe(false);
  });
});

describe("selectSignupNudgeTargets", () => {
  it("nudges a dormant account inside the 2 to 7 day window", () => {
    const out = selectSignupNudgeTargets([user({ createdAt: daysAgo(3) })], NOW);
    expect(out.map((r) => r.uid)).toEqual(["u1"]);
  });

  it("skips accounts younger than two days", () => {
    expect(
      selectSignupNudgeTargets([user({ createdAt: daysAgo(1) })], NOW),
    ).toEqual([]);
  });

  it("skips accounts older than the window so a first run cannot blast everyone", () => {
    expect(
      selectSignupNudgeTargets([user({ createdAt: daysAgo(40) })], NOW),
    ).toEqual([]);
  });

  it("skips an account that has been active since signup", () => {
    const r = user({ createdAt: daysAgo(3), lastActiveAt: daysAgo(1) });
    expect(selectSignupNudgeTargets([r], NOW)).toEqual([]);
  });

  it("still nudges when the only activity stamp predates signup", () => {
    const r = user({ createdAt: daysAgo(3), lastActiveAt: daysAgo(5) });
    expect(selectSignupNudgeTargets([r], NOW)).toHaveLength(1);
  });

  it("treats an unparseable activity stamp as no activity", () => {
    const r = user({ lastActiveAt: "whenever" });
    expect(selectSignupNudgeTargets([r], NOW)).toHaveLength(1);
  });

  it("never sends twice", () => {
    const r = user({ signupNudgeSentAt: daysAgo(1) });
    expect(selectSignupNudgeTargets([r], NOW)).toEqual([]);
  });
});

describe("monthly prompt", () => {
  it("keys the month in UTC", () => {
    expect(monthKey(NOW)).toBe("2026-09");
  });

  it("cycles through three variants and wraps", () => {
    const v = (iso: string) => pickMonthlyVariant(new Date(iso));
    const seq = [
      "2026-09-25T00:00:00Z",
      "2026-10-25T00:00:00Z",
      "2026-11-25T00:00:00Z",
      "2026-12-25T00:00:00Z",
    ].map(v);
    expect(new Set(seq.slice(0, 3)).size).toBe(3);
    expect(seq[3]).toBe(seq[0]);
  });

  it("includes every marketable user regardless of tier or activity", () => {
    const out = selectMonthlyPromptTargets(
      [
        user({ uid: "a", createdAt: daysAgo(90), lastActiveAt: daysAgo(1) }),
        user({ uid: "b", createdAt: daysAgo(90), lastActiveAt: "" }),
        user({ uid: "c", createdAt: daysAgo(90), suspended: true }),
        user({ uid: "d", createdAt: daysAgo(90), optedOutOfMarketing: true }),
      ],
      "2026-09",
      NOW,
    );
    expect(out.map((r) => r.uid)).toEqual(["a", "b"]);
  });

  it("skips anyone already sent this month but not last month's recipients", () => {
    const out = selectMonthlyPromptTargets(
      [
        user({ uid: "a", createdAt: daysAgo(90), monthlyPromptSentAt: "2026-09" }),
        user({ uid: "b", createdAt: daysAgo(90), monthlyPromptSentAt: "2026-08" }),
      ],
      "2026-09",
      NOW,
    );
    expect(out.map((r) => r.uid)).toEqual(["b"]);
  });

  it("leaves brand new accounts out so they cannot get two prompts in one morning", () => {
    const out = selectMonthlyPromptTargets(
      [
        user({ uid: "new", createdAt: daysAgo(2) }),
        user({ uid: "old", createdAt: daysAgo(20) }),
      ],
      "2026-09",
      NOW,
    );
    expect(out.map((r) => r.uid)).toEqual(["old"]);
  });
});

describe("selectReengagementTargets", () => {
  it("picks up an account dormant for 30 days", () => {
    const r = user({ createdAt: daysAgo(90), lastActiveAt: daysAgo(31) });
    expect(selectReengagementTargets([r], NOW)).toHaveLength(1);
  });

  it("falls back to signup date when the account was never active", () => {
    const r = user({ createdAt: daysAgo(60), lastActiveAt: "" });
    expect(selectReengagementTargets([r], NOW)).toHaveLength(1);
  });

  it("leaves recently active accounts alone", () => {
    const r = user({ createdAt: daysAgo(90), lastActiveAt: daysAgo(3) });
    expect(selectReengagementTargets([r], NOW)).toEqual([]);
  });

  it("honours the 30 day cooldown between nudges", () => {
    const r = user({
      createdAt: daysAgo(90),
      lastActiveAt: daysAgo(60),
      lastNudgedAt: daysAgo(5),
    });
    expect(selectReengagementTargets([r], NOW)).toEqual([]);
  });
});

describe("firstName", () => {
  it("takes the first word and falls back safely", () => {
    expect(firstName("Dana Reyes")).toBe("Dana");
    expect(firstName("")).toBe("there");
    expect(firstName("   ")).toBe("there");
  });
});
