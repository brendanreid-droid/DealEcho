import { describe, it, expect } from "vitest";
import { modalOf, rateOf, frictionRanking, medianCycle } from "./dealMechanics";
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
