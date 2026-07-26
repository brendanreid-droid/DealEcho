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

describe("rule bank coverage", () => {
  it("fires the legal rule when MSA redlines are common", () => {
    const qs = getQualificationQuestions({
      ...empty,
      friction: [{ event: "Legal redlines on MSA", count: 6, total: 9, reviewIds: ["a"] }],
    });
    const q = qs.find((x) => x.id === "legal-redlines")!;
    expect(q.askOf).toBe("Legal / Compliance");
    expect(q.why).toContain("6 of 9");
  });

  it("fires the POC rule with an exit-criteria question", () => {
    const qs = getQualificationQuestions({
      ...empty,
      friction: [{ event: "Pilot / POC required", count: 5, total: 9, reviewIds: ["a"] }],
    });
    expect(qs.find((x) => x.id === "poc-exit-criteria")).toBeDefined();
  });

  it("fires the early-procurement rule from the modal stat", () => {
    const qs = getQualificationQuestions({
      ...empty,
      procurementEntry: { value: "Early (before shortlist)", count: 6, total: 8 },
    });
    const q = qs.find((x) => x.id === "procurement-early")!;
    expect(q.why).toContain("6 of 8");
    expect(q.stage).toBe("Discovery");
  });

  it("does not fire the procurement rule when procurement is never involved", () => {
    const qs = getQualificationQuestions({
      ...empty,
      procurementEntry: { value: "Never involved", count: 6, total: 8 },
    });
    expect(qs.find((x) => x.id === "procurement-early")).toBeUndefined();
  });

  it("fires the slippage rule above a one-third rate", () => {
    const qs = getQualificationQuestions({
      ...empty,
      slippageRate: { count: 5, total: 9, reviewIds: ["a"] },
    });
    expect(qs.find((x) => x.id === "close-slippage")).toBeDefined();
  });

  it("fires the payment-terms rule only on Net 60 or worse", () => {
    const net30 = getQualificationQuestions({
      ...empty,
      paymentTerms: { value: "Net 30", count: 5, total: 7 },
    });
    expect(net30.find((x) => x.id === "payment-terms")).toBeUndefined();

    const net90 = getQualificationQuestions({
      ...empty,
      paymentTerms: { value: "Net 90", count: 5, total: 7 },
    });
    expect(net90.find((x) => x.id === "payment-terms")).toBeDefined();
  });

  it("fires the verbal-drift rule on slow verbal-to-signature", () => {
    const qs = getQualificationQuestions({
      ...empty,
      verbalToSignature: { value: "3+ Months", count: 5, total: 8 },
    });
    expect(qs.find((x) => x.id === "verbal-drift")).toBeDefined();
  });

  it("fires the stakeholder rule on large buying committees", () => {
    const qs = getQualificationQuestions({
      ...empty,
      stakeholderCount: { value: "10+", count: 4, total: 8 },
    });
    const q = qs.find((x) => x.id === "stakeholder-sprawl")!;
    expect(q.why).toContain("10+");
  });

  it("fires the vendor-portal and reference rules", () => {
    const qs = getQualificationQuestions({
      ...empty,
      friction: [
        { event: "Vendor onboarding portal", count: 4, total: 9, reviewIds: ["a"] },
        { event: "Reference calls required", count: 4, total: 9, reviewIds: ["a"] },
      ],
    });
    expect(qs.find((x) => x.id === "vendor-portal")).toBeDefined();
    expect(qs.find((x) => x.id === "reference-calls")).toBeDefined();
  });

  it("fires the SOC 2 rule", () => {
    const qs = getQualificationQuestions({
      ...empty,
      friction: [{ event: "SOC 2 / pen test required", count: 3, total: 9, reviewIds: ["a"] }],
    });
    expect(qs.find((x) => x.id === "soc2-evidence")).toBeDefined();
  });

  it("caps the list and returns highest priority first", () => {
    const qs = getQualificationQuestions({
      ...empty,
      friction: [
        { event: "Security questionnaire", count: 7, total: 9, reviewIds: ["a"] },
        { event: "Legal redlines on MSA", count: 6, total: 9, reviewIds: ["a"] },
        { event: "Pilot / POC required", count: 5, total: 9, reviewIds: ["a"] },
        { event: "Reference calls required", count: 5, total: 9, reviewIds: ["a"] },
        { event: "Vendor onboarding portal", count: 4, total: 9, reviewIds: ["a"] },
        { event: "Reverse auction / e-procurement", count: 3, total: 9, reviewIds: ["a"] },
      ],
      procurementEntry: { value: "Early (before shortlist)", count: 6, total: 8 },
      verbalToSignature: { value: "3+ Months", count: 5, total: 8 },
      paymentTerms: { value: "Net 90", count: 5, total: 7 },
      stakeholderCount: { value: "10+", count: 4, total: 8 },
      ghostRate: { count: 4, total: 9, reviewIds: ["a"] },
      slippageRate: { count: 5, total: 9, reviewIds: ["a"] },
    });
    expect(qs).toHaveLength(MAX_QUESTIONS);
    for (let i = 1; i < qs.length; i++) {
      expect(qs[i - 1].priority).toBeGreaterThanOrEqual(qs[i].priority);
    }
  });
});
