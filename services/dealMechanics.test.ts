import { describe, it, expect } from "vitest";
import { modalOf, rateOf, frictionRanking, medianCycle, getDealMechanics, MIN_MECHANICS_REVIEWS } from "./dealMechanics";
import { Review } from "../types";

export const base: Review = {
  id: "r1", companyId: "c1", companyName: "Acme", userId: "u1",
  userName: "Verified", currency: "USD", tcvBracket: "$50k - $100k",
  cycleDuration: "3-6 Months", status: "Won", isTender: false,
  buyingTeam: ["Procurement"], location: "US",
  communicationRating: 5, negotiationLevel: 5, timeWasterLevel: 5,
  clarityOfScope: 5, industry: "SaaS", country: "US",
  content: "Smooth deal.", createdAt: "2026-03-01T00:00:00.000Z",
};

export const r = (over: Partial<Review>): Review => ({ ...base, ...over });

describe("modalOf", () => {
  it("returns the most common known value with its own denominator", () => {
    const stat = modalOf(
      [
        r({ id: "a", paymentTerms: "Net 60" }),
        r({ id: "b", paymentTerms: "Net 60" }),
        r({ id: "c", paymentTerms: "Net 30" }),
        r({ id: "d" }), // legacy review, field absent
      ],
      (x) => x.paymentTerms,
      ["Unknown / N/A"],
    );
    expect(stat).toEqual({ value: "Net 60", count: 2, total: 3 });
  });

  it("excludes unknown sentinels from the modal and the denominator", () => {
    const stat = modalOf(
      [
        r({ id: "a", closeSlippage: "Unknown" }),
        r({ id: "b", closeSlippage: "Unknown" }),
        r({ id: "c", closeSlippage: "Pushed once" }),
      ],
      (x) => x.closeSlippage,
      ["Unknown"],
    );
    expect(stat).toEqual({ value: "Pushed once", count: 1, total: 1 });
  });

  it("returns null when no review has a known value", () => {
    expect(modalOf([r({ id: "a" })], (x) => x.paymentTerms, ["Unknown / N/A"])).toBeNull();
  });
});

describe("rateOf", () => {
  it("counts matching reviews and collects their ids", () => {
    const stat = rateOf(
      [r({ id: "a", wentDark: true }), r({ id: "b", wentDark: false }), r({ id: "c", wentDark: true })],
      (x) => x.wentDark === true,
      (x) => x.wentDark !== undefined,
    );
    expect(stat).toEqual({ count: 2, total: 3, reviewIds: ["a", "c"] });
  });

  it("excludes reviews where the field is absent from the denominator", () => {
    const stat = rateOf(
      [r({ id: "a", wentDark: true }), r({ id: "b" })],
      (x) => x.wentDark === true,
      (x) => x.wentDark !== undefined,
    );
    expect(stat).toEqual({ count: 1, total: 1, reviewIds: ["a"] });
  });
});

describe("frictionRanking", () => {
  it("ranks events by frequency and cites the reviews that reported them", () => {
    const ranking = frictionRanking([
      r({ id: "a", frictionEvents: ["Security questionnaire", "Legal redlines on MSA"] }),
      r({ id: "b", frictionEvents: ["Security questionnaire"] }),
      r({ id: "c", frictionEvents: [] }),
    ]);
    expect(ranking[0]).toEqual({
      event: "Security questionnaire",
      count: 2,
      total: 3,
      reviewIds: ["a", "b"],
    });
    expect(ranking[1]).toEqual({
      event: "Legal redlines on MSA",
      count: 1,
      total: 3,
      reviewIds: ["a"],
    });
    expect(ranking).toHaveLength(2);
  });

  it("excludes reviews with no frictionEvents field from the denominator", () => {
    const ranking = frictionRanking([
      r({ id: "a", frictionEvents: ["Pilot / POC required"] }),
      r({ id: "b" }), // legacy review
    ]);
    expect(ranking[0].total).toBe(1);
  });

  it("returns an empty array when nobody reported friction", () => {
    expect(frictionRanking([r({ id: "a", frictionEvents: [] })])).toEqual([]);
  });
});

describe("medianCycle", () => {
  it("returns the middle bracket by bracket order, not alphabetically", () => {
    expect(
      medianCycle([
        r({ id: "a", cycleDuration: "< 1 Month" }),
        r({ id: "b", cycleDuration: "6-12 Months" }),
        r({ id: "c", cycleDuration: "24+ Months" }),
      ]),
    ).toBe("6-12 Months");
  });

  it("normalizes the legacy 12+ Months bracket before ranking", () => {
    expect(medianCycle([r({ id: "a", cycleDuration: "12+ Months" })])).toBe("12-18 Months");
  });

  it("returns null when no review has a recognised bracket", () => {
    expect(medianCycle([r({ id: "a", cycleDuration: "garbage" })])).toBeNull();
  });
});

describe("getDealMechanics", () => {
  it("returns null below the minimum sample size", () => {
    const few = Array.from({ length: MIN_MECHANICS_REVIEWS - 1 }, (_, i) => r({ id: `x${i}` }));
    expect(getDealMechanics(few)).toBeNull();
  });

  it("assembles every stat from a mixed v1/v2 review set", () => {
    const m = getDealMechanics([
      r({
        id: "a", status: "Lost", cycleDuration: "6-12 Months",
        frictionEvents: ["Security questionnaire", "Legal redlines on MSA"],
        procurementEntry: "Early (before shortlist)", paymentTerms: "Net 60",
        verbalToSignature: "1-3 Months", closeSlippage: "Pushed 3+ times",
        stakeholderCount: "6-10", wentDark: true,
      }),
      r({
        id: "b", status: "Won", cycleDuration: "6-12 Months",
        frictionEvents: ["Security questionnaire"],
        procurementEntry: "Early (before shortlist)", paymentTerms: "Net 60",
        verbalToSignature: "1-4 Weeks", closeSlippage: "Never pushed",
        stakeholderCount: "6-10", wentDark: false,
      }),
      r({ id: "c", status: "Lost", cycleDuration: "3-6 Months" }), // legacy v1
    ]);

    expect(m).not.toBeNull();
    expect(m!.sampleSize).toBe(3);
    expect(m!.medianCycle).toBe("6-12 Months");
    expect(m!.friction[0].event).toBe("Security questionnaire");
    expect(m!.friction[0].count).toBe(2);
    expect(m!.friction[0].total).toBe(2); // review c never answered
    expect(m!.procurementEntry).toEqual({ value: "Early (before shortlist)", count: 2, total: 2 });
    expect(m!.paymentTerms).toEqual({ value: "Net 60", count: 2, total: 2 });
    expect(m!.stakeholderCount).toEqual({ value: "6-10", count: 2, total: 2 });
    expect(m!.ghostRate).toEqual({ count: 1, total: 2, reviewIds: ["a"] });
    expect(m!.slippageRate).toEqual({ count: 1, total: 2, reviewIds: ["a"] });
    expect(m!.outcomeMix).toContainEqual({ outcome: "Lost", count: 2 });
    expect(m!.outcomeMix).toContainEqual({ outcome: "Won", count: 1 });
  });

  it("treats only 'pushed twice or more' as slippage", () => {
    const m = getDealMechanics([
      r({ id: "a", closeSlippage: "Pushed once" }),
      r({ id: "b", closeSlippage: "Pushed twice" }),
      r({ id: "c", closeSlippage: "Never pushed" }),
    ]);
    expect(m!.slippageRate).toEqual({ count: 1, total: 3, reviewIds: ["b"] });
  });

  it("leaves modal stats null when every answer is an unknown sentinel", () => {
    const m = getDealMechanics([
      r({ id: "a", procurementEntry: "Unknown" }),
      r({ id: "b", procurementEntry: "Unknown" }),
      r({ id: "c", procurementEntry: "Unknown" }),
    ]);
    expect(m!.procurementEntry).toBeNull();
  });
});
