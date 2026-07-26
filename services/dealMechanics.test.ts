import { describe, it, expect } from "vitest";
import { modalOf, rateOf } from "./dealMechanics";
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
