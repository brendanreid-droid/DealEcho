import { describe, it, expect } from "vitest";
import { normalizeTcvBracket, normalizeDurationBracket, frictionScore, countryToRegion } from "./reviewSchema";
import { Review } from "../../types";

const baseReview: Review = {
  id: "r1",
  companyId: "c1",
  companyName: "Acme",
  userId: "u1",
  userName: "A",
  currency: "USD",
  tcvBracket: "$50k - $100k",
  cycleDuration: "3-6 Months",
  status: "Won",
  isTender: false,
  buyingTeam: ["Procurement"],
  location: "USA",
  communicationRating: 4,
  negotiationLevel: 4,
  timeWasterLevel: 4,
  clarityOfScope: 4,
  industry: "Software",
  country: "USA",
  content: "words",
  createdAt: "2026-07-01T00:00:00.000Z",
};

describe("normalizeTcvBracket", () => {
  it("passes through current brackets", () => {
    expect(normalizeTcvBracket("$2.5M - $5M")).toBe("$2.5M - $5M");
  });
  it("maps legacy $1M+ to the lowest new $1M bracket", () => {
    expect(normalizeTcvBracket("$1M+")).toBe("$1M - $2.5M");
  });
  it("returns null for unknown values", () => {
    expect(normalizeTcvBracket("garbage")).toBeNull();
  });
});

describe("normalizeDurationBracket", () => {
  it("passes through current brackets", () => {
    expect(normalizeDurationBracket("24+ Months")).toBe("24+ Months");
  });
  it("maps legacy 12+ Months to 12-18 Months", () => {
    expect(normalizeDurationBracket("12+ Months")).toBe("12-18 Months");
  });
  it("returns null for unknown values", () => {
    expect(normalizeDurationBracket("garbage")).toBeNull();
  });
});

describe("countryToRegion", () => {
  it("maps common countries", () => {
    expect(countryToRegion("USA")).toBe("North America");
    expect(countryToRegion("United States")).toBe("North America");
    expect(countryToRegion("Australia")).toBe("Australia & NZ");
    expect(countryToRegion("United Kingdom")).toBe("UK & Ireland");
    expect(countryToRegion("Germany")).toBe("Europe");
  });
  it("falls back to Global / Multi-region for unknown countries", () => {
    expect(countryToRegion("Atlantis")).toBe("Global / Multi-region");
  });
});

describe("frictionScore", () => {
  it("returns null for v1 reviews (no schemaVersion)", () => {
    expect(frictionScore(baseReview)).toBeNull();
  });

  it("returns 0 for a v2 review with a frictionless deal", () => {
    expect(
      frictionScore({
        ...baseReview,
        schemaVersion: 2,
        frictionEvents: [],
        closeSlippage: "Never pushed",
        wentDark: false,
        verbalToSignature: "< 1 Week",
      }),
    ).toBe(0);
  });

  it("returns 100 for maximum friction", () => {
    expect(
      frictionScore({
        ...baseReview,
        schemaVersion: 2,
        frictionEvents: [
          "Security questionnaire",
          "SOC 2 / pen test required",
          "Legal redlines on MSA",
          "Pilot / POC required",
          "Reference calls required",
          "Vendor onboarding portal",
          "Reverse auction / e-procurement",
        ],
        closeSlippage: "Pushed 3+ times",
        wentDark: true,
        verbalToSignature: "3+ Months",
      }),
    ).toBe(100);
  });

  it("treats Unknown answers as zero friction contribution", () => {
    expect(
      frictionScore({
        ...baseReview,
        schemaVersion: 2,
        frictionEvents: ["Security questionnaire"],
        closeSlippage: "Unknown",
        wentDark: false,
        verbalToSignature: "Unknown",
      }),
    ).toBe(7);
  });

  it("scores intermediate weights correctly", () => {
    expect(
      frictionScore({
        ...baseReview,
        schemaVersion: 2,
        frictionEvents: ["Security questionnaire", "Legal redlines on MSA"],
        closeSlippage: "Pushed twice",
        wentDark: false,
        verbalToSignature: "1-4 Weeks",
      }),
    ).toBe(Math.round((5 / 15) * 100)); // 2 events + 2 slippage + 1 lag = 5 → 33
  });

  it("caps friction events at 7 and gives No verbal commit zero lag", () => {
    expect(
      frictionScore({
        ...baseReview,
        schemaVersion: 2,
        frictionEvents: Array(10).fill("Security questionnaire"),
        closeSlippage: "Never pushed",
        wentDark: false,
        verbalToSignature: "No verbal commit",
      }),
    ).toBe(Math.round((7 / 15) * 100));
  });
});
