import { describe, it, expect } from "vitest";
import {
  TCV_BRACKETS,
  DURATION_BRACKETS,
  OUTCOMES,
  DEAL_TYPES,
  DEAL_REGIONS,
  FRICTION_EVENTS,
  recentDealPeriods,
} from "./dealData";

describe("dealData v2 constants", () => {
  it("TCV brackets extend past $1M and no longer contain the legacy catch-all", () => {
    expect(TCV_BRACKETS).toContain("$1M - $2.5M");
    expect(TCV_BRACKETS).toContain("$10M+");
    expect(TCV_BRACKETS).not.toContain("$1M+");
  });

  it("duration brackets extend past 12 months", () => {
    expect(DURATION_BRACKETS).toContain("18-24 Months");
    expect(DURATION_BRACKETS).not.toContain("12+ Months");
  });

  it("outcomes include No Decision and Withdrew", () => {
    expect(OUTCOMES).toEqual(["Won", "Lost", "No Decision", "Withdrew", "Ongoing"]);
  });

  it("deal types and regions are non-empty", () => {
    expect(DEAL_TYPES.length).toBeGreaterThan(2);
    expect(DEAL_REGIONS.length).toBeGreaterThan(4);
    expect(FRICTION_EVENTS.length).toBe(7);
  });
});

describe("recentDealPeriods", () => {
  it("returns 8 quarters newest-first plus Older, from a fixed date", () => {
    const periods = recentDealPeriods(new Date(2026, 6, 22));
    expect(periods[0]).toBe("Q3 2026");
    expect(periods[1]).toBe("Q2 2026");
    expect(periods[7]).toBe("Q4 2024");
    expect(periods[8]).toBe("Older");
    expect(periods).toHaveLength(9);
  });
});
