import { describe, it, expect } from "vitest";
import { pointId, getStructuredFlags, MAX_FLAGS, mergeFlags, rank, AccountFlag } from "./accountFlags";
import { DealMechanics } from "./dealMechanics";

describe("pointId", () => {
  it("is stable for the same flag and point text", () => {
    expect(pointId("security-review", "who signs off")).toBe(
      pointId("security-review", "who signs off"),
    );
  });

  it("differs when the point text differs", () => {
    expect(pointId("security-review", "who signs off")).not.toBe(
      pointId("security-review", "which tier applies"),
    );
  });

  it("differs when the flag differs, so identical wording under two flags is tracked apart", () => {
    expect(pointId("security-review", "who signs off")).not.toBe(
      pointId("legal-redlines", "who signs off"),
    );
  });

  it("ignores surrounding whitespace and case so trivial rewording keeps the tick", () => {
    expect(pointId("security-review", "  Who Signs Off  ")).toBe(
      pointId("security-review", "who signs off"),
    );
  });

  it("produces a short printable id", () => {
    expect(pointId("security-review", "who signs off")).toMatch(/^[a-z0-9-]+:[0-9a-f]{8}$/);
  });
});

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

describe("getStructuredFlags", () => {
  it("returns nothing when no trigger fires", () => {
    expect(getStructuredFlags(empty)).toEqual([]);
  });

  it("builds a security flag with a numeric stat and qualification points", () => {
    const flags = getStructuredFlags({
      ...empty,
      friction: [{ event: "Security questionnaire", count: 7, total: 9, reviewIds: ["a", "b"] }],
    });
    const f = flags.find((x) => x.id === "security-review")!;
    expect(f.label).toBe("Security review is a gate");
    expect(f.stat).toBe("7 of 9 deals");
    expect(f.qualify.length).toBeGreaterThan(0);
    expect(f.reviewIds).toEqual(["a", "b"]);
    expect(f.source).toBe("mechanics");
  });

  it("every flag carries a number in its stat", () => {
    const flags = getStructuredFlags({
      ...empty,
      friction: [
        { event: "Security questionnaire", count: 7, total: 9, reviewIds: ["a"] },
        { event: "Legal redlines on MSA", count: 6, total: 9, reviewIds: ["b"] },
        { event: "Reverse auction / e-procurement", count: 2, total: 9, reviewIds: ["c"] },
      ],
      procurementEntry: { value: "Early (before shortlist)", count: 6, total: 8 },
      paymentTerms: { value: "Net 90", count: 5, total: 7 },
      stakeholderCount: { value: "10+", count: 4, total: 8 },
      verbalToSignature: { value: "3+ Months", count: 5, total: 8 },
      ghostRate: { count: 4, total: 9, reviewIds: ["a"] },
      slippageRate: { count: 5, total: 9, reviewIds: ["a"] },
    });
    expect(flags.length).toBeGreaterThan(0);
    for (const f of flags) expect(f.stat).toMatch(/\d/);
  });

  it("does not fire a friction flag on a single report", () => {
    const flags = getStructuredFlags({
      ...empty,
      friction: [{ event: "Security questionnaire", count: 1, total: 9, reviewIds: ["a"] }],
    });
    expect(flags.find((x) => x.id === "security-review")).toBeUndefined();
  });

  it("fires the reverse auction flag on a single report because it is critical", () => {
    const flags = getStructuredFlags({
      ...empty,
      friction: [{ event: "Reverse auction / e-procurement", count: 1, total: 9, reviewIds: ["a"] }],
    });
    expect(flags.find((x) => x.id === "reverse-auction")!.severity).toBe("critical");
  });

  it("does not fire a rate flag when only one review answered the field", () => {
    const flags = getStructuredFlags({
      ...empty,
      ghostRate: { count: 1, total: 1, reviewIds: ["a"] },
    });
    expect(flags.find((x) => x.id === "ghosting")).toBeUndefined();
  });

  it("does not fire a modal flag when only one review answered the field", () => {
    const flags = getStructuredFlags({
      ...empty,
      procurementEntry: { value: "Early (before shortlist)", count: 1, total: 1 },
    });
    expect(flags.find((x) => x.id === "procurement-early")).toBeUndefined();
  });

  it("does not fire a rate flag at exactly one third", () => {
    const flags = getStructuredFlags({
      ...empty,
      ghostRate: { count: 3, total: 9, reviewIds: ["a"] },
    });
    expect(flags.find((x) => x.id === "ghosting")).toBeUndefined();
  });

  it("does not flag procurement when procurement is never involved", () => {
    const flags = getStructuredFlags({
      ...empty,
      procurementEntry: { value: "Never involved", count: 6, total: 8 },
    });
    expect(flags.find((x) => x.id === "procurement-early")).toBeUndefined();
  });

  it("flags payment terms only at Net 60 or worse", () => {
    expect(
      getStructuredFlags({ ...empty, paymentTerms: { value: "Net 30", count: 5, total: 7 } }),
    ).toEqual([]);
    expect(
      getStructuredFlags({ ...empty, paymentTerms: { value: "Net 90", count: 5, total: 7 } }).length,
    ).toBe(1);
  });
});

const flag = (over: Partial<AccountFlag>): AccountFlag => ({
  id: "x", label: "X", severity: "caution", stat: "2 of 9 deals",
  qualify: ["something"], reviewIds: ["a"], strength: 0.2,
  priority: 50, source: "mechanics", ...over,
});

describe("mergeFlags", () => {
  it("ranks a strongly observed lower-priority flag above a weakly observed higher-priority one", () => {
    const out = mergeFlags(
      [
        flag({ id: "security-review", priority: 90, strength: 2 / 9 }),
        flag({ id: "close-slippage", priority: 82, strength: 8 / 9 }),
      ],
      [],
    );
    expect(out[0].id).toBe("close-slippage");
    expect(out[1].id).toBe("security-review");
  });

  it("caps the list", () => {
    const many = Array.from({ length: 12 }, (_, i) => flag({ id: `f${i}`, priority: 100 - i }));
    expect(mergeFlags(many, [])).toHaveLength(MAX_FLAGS);
  });

  it("includes AI flags alongside structured ones", () => {
    const out = mergeFlags([flag({ id: "ghosting" })], [flag({ id: "ai-1", source: "reports" })]);
    expect(out.map((f) => f.id).sort()).toEqual(["ai-1", "ghosting"]);
  });

  it("drops an AI flag whose id collides with a structured flag", () => {
    const out = mergeFlags(
      [flag({ id: "ghosting", stat: "4 of 9 deals" })],
      [flag({ id: "ghosting", stat: "made up", source: "reports" })],
    );
    expect(out).toHaveLength(1);
    expect(out[0].source).toBe("mechanics");
  });

  it("drops any flag whose stat carries no number", () => {
    const out = mergeFlags([], [flag({ id: "ai-2", stat: "several deals", source: "reports" })]);
    expect(out).toEqual([]);
  });

  it("drops any flag with no qualification points", () => {
    const out = mergeFlags([], [flag({ id: "ai-3", qualify: [], source: "reports" })]);
    expect(out).toEqual([]);
  });

  it("sorts critical flags above caution at equal rank", () => {
    const out = mergeFlags(
      [
        flag({ id: "a", severity: "caution", priority: 50, strength: 0.5 }),
        flag({ id: "b", severity: "critical", priority: 50, strength: 0.5 }),
      ],
      [],
    );
    expect(out[0].id).toBe("b");
  });
});
