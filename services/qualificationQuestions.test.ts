import { describe, it, expect } from "vitest";
import { getQualificationQuestions, MAX_QUESTIONS } from "./qualificationQuestions";
import { DealMechanics } from "./dealMechanics";

const empty: DealMechanics = {
  sampleSize: 9,
  friction: [],
  procurementEntry: null,
  verbalToSignature: null,
  paymentTerms: null,
  stakeholderCount: null,
  ghostRate: { count: 0, total: 0, reviewIds: [] },
  slippageRate: { count: 0, total: 0, reviewIds: [] },
  medianCycle: null,
  outcomeMix: [],
};

describe("getQualificationQuestions", () => {
  it("returns nothing when no trigger fires", () => {
    expect(getQualificationQuestions(empty)).toEqual([]);
  });

  it("fires the security rule and embeds the real count in the rationale", () => {
    const qs = getQualificationQuestions({
      ...empty,
      friction: [{ event: "Security questionnaire", count: 7, total: 9, reviewIds: ["a", "b"] }],
    });
    const q = qs.find((x) => x.id === "security-review");
    expect(q).toBeDefined();
    expect(q!.why).toContain("7 of 9");
    expect(q!.askOf).toBe("Security / InfoSec");
    expect(q!.stage).toBe("Discovery");
    expect(q!.reviewIds).toEqual(["a", "b"]);
  });

  it("does not fire a friction rule on a single report", () => {
    const qs = getQualificationQuestions({
      ...empty,
      friction: [{ event: "Security questionnaire", count: 1, total: 9, reviewIds: ["a"] }],
    });
    expect(qs.find((x) => x.id === "security-review")).toBeUndefined();
  });

  it("fires the reverse-auction rule on a single report because it is critical", () => {
    const qs = getQualificationQuestions({
      ...empty,
      friction: [{ event: "Reverse auction / e-procurement", count: 1, total: 9, reviewIds: ["a"] }],
    });
    expect(qs.find((x) => x.id === "reverse-auction")).toBeDefined();
  });

  it("fires the ghosting rule only above a one-third rate", () => {
    const below = getQualificationQuestions({
      ...empty,
      ghostRate: { count: 1, total: 9, reviewIds: ["a"] },
    });
    expect(below.find((x) => x.id === "ghosting")).toBeUndefined();

    const above = getQualificationQuestions({
      ...empty,
      ghostRate: { count: 4, total: 9, reviewIds: ["a", "b", "c", "d"] },
    });
    expect(above.find((x) => x.id === "ghosting")).toBeDefined();
  });

  it("every question contains an account-specific number in its rationale", () => {
    const qs = getQualificationQuestions({
      ...empty,
      friction: [
        { event: "Security questionnaire", count: 7, total: 9, reviewIds: ["a"] },
        { event: "Legal redlines on MSA", count: 6, total: 9, reviewIds: ["b"] },
      ],
      procurementEntry: { value: "Early (before shortlist)", count: 6, total: 8 },
      paymentTerms: { value: "Net 60", count: 5, total: 7 },
      ghostRate: { count: 4, total: 9, reviewIds: ["a"] },
      slippageRate: { count: 5, total: 9, reviewIds: ["a"] },
    });
    expect(qs.length).toBeGreaterThan(0);
    for (const q of qs) expect(q.why).toMatch(/\d/);
  });
});
