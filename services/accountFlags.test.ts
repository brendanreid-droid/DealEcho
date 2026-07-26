import { describe, it, expect } from "vitest";
import {
  pointId,
  getStructuredFlags,
  MAX_FLAGS,
  mergeFlags,
  rank,
  AccountFlag,
  evidenceBar,
  capSeverity,
} from "./accountFlags";
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
  ratings: {
    communication: { average: 0, total: 0 },
    negotiation: { average: 0, total: 0 },
    intent: { average: 0, total: 0 },
    scope: { average: 0, total: 0 },
  },
  frictionAnswered: 0,
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

  it("does not fire a friction flag on a single report once the field has a larger sample", () => {
    const flags = getStructuredFlags({
      ...empty,
      friction: [{ event: "Security questionnaire", count: 1, total: 9, reviewIds: ["a"] }],
    });
    expect(flags.find((x) => x.id === "security-review")).toBeUndefined();
  });

  it("fires the reverse auction flag on a single report, but caps its severity to caution", () => {
    const flags = getStructuredFlags({
      ...empty,
      friction: [{ event: "Reverse auction / e-procurement", count: 1, total: 9, reviewIds: ["a"] }],
    });
    expect(flags.find((x) => x.id === "reverse-auction")!.severity).toBe("caution");
  });

  it("fires a rate flag from a single review when that is the field's whole sample", () => {
    const flags = getStructuredFlags({
      ...empty,
      ghostRate: { count: 1, total: 1, reviewIds: ["a"] },
    });
    expect(flags.find((x) => x.id === "ghosting")).toBeDefined();
  });

  it("fires a modal flag from a single review when that is the field's whole sample", () => {
    const flags = getStructuredFlags({
      ...empty,
      procurementEntry: { value: "Early (before shortlist)", count: 1, total: 1 },
    });
    expect(flags.find((x) => x.id === "procurement-early")).toBeDefined();
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

  it("flags payment terms as a risk only at Net 60 or worse", () => {
    // Net 30 is not a risk finding - it fires the "fair-terms" strength instead
    // (see the green flags describe block), not the "payment-terms" risk.
    expect(
      getStructuredFlags({
        ...empty,
        paymentTerms: { value: "Net 30", count: 5, total: 7 },
      }).find((x) => x.id === "payment-terms"),
    ).toBeUndefined();
    expect(
      getStructuredFlags({ ...empty, paymentTerms: { value: "Net 90", count: 5, total: 7 } }).find(
        (x) => x.id === "payment-terms",
      ),
    ).toBeDefined();
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

describe("evidenceBar", () => {
  it("needs a single report when that is all the evidence there is", () => {
    expect(evidenceBar(1)).toBe(1);
    expect(evidenceBar(2)).toBe(1);
  });

  it("needs two reports on a mid-sized sample", () => {
    expect(evidenceBar(3)).toBe(2);
    expect(evidenceBar(8)).toBe(2);
  });

  it("needs three reports once the sample is large", () => {
    expect(evidenceBar(9)).toBe(3);
    expect(evidenceBar(50)).toBe(3);
  });

  it("never returns less than one, even for an empty sample", () => {
    expect(evidenceBar(0)).toBe(1);
  });
});

describe("capSeverity", () => {
  it("caps a critical flag to caution when it stands on one or two reports", () => {
    expect(capSeverity("critical", 1)).toBe("caution");
    expect(capSeverity("critical", 2)).toBe("caution");
  });

  it("leaves severity alone once three reports back it", () => {
    expect(capSeverity("critical", 3)).toBe("critical");
  });

  it("never promotes a lesser severity", () => {
    expect(capSeverity("watch", 1)).toBe("watch");
    expect(capSeverity("watch", 20)).toBe("watch");
    expect(capSeverity("caution", 1)).toBe("caution");
  });
});

describe("adaptive bar applied to the rule bank", () => {
  it("raises a friction flag from a single report on a single-report field", () => {
    const flags = getStructuredFlags({
      ...empty,
      friction: [{ event: "Security questionnaire", count: 1, total: 1, reviewIds: ["a"] }],
    });
    expect(flags.find((x) => x.id === "security-review")).toBeDefined();
  });

  it("still suppresses a single report once the field has a larger sample", () => {
    const flags = getStructuredFlags({
      ...empty,
      friction: [{ event: "Security questionnaire", count: 1, total: 9, reviewIds: ["a"] }],
    });
    expect(flags.find((x) => x.id === "security-review")).toBeUndefined();
  });

  it("keys the bar off the field's own denominator, not the account total", () => {
    // 9 reviews on the account, but only one answered the friction question.
    const flags = getStructuredFlags({
      ...empty,
      sampleSize: 9,
      friction: [{ event: "Security questionnaire", count: 1, total: 1, reviewIds: ["a"] }],
    });
    expect(flags.find((x) => x.id === "security-review")).toBeDefined();
  });

  it("caps a thin critical flag to caution", () => {
    const flags = getStructuredFlags({
      ...empty,
      ghostRate: { count: 1, total: 1, reviewIds: ["a"] },
    });
    const f = flags.find((x) => x.id === "ghosting")!;
    expect(f.severity).toBe("caution");
  });

  it("leaves a well-evidenced critical flag critical", () => {
    const flags = getStructuredFlags({
      ...empty,
      ghostRate: { count: 4, total: 9, reviewIds: ["a", "b", "c", "d"] },
    });
    expect(flags.find((x) => x.id === "ghosting")!.severity).toBe("critical");
  });

  it("raises a modal flag from a single answered field", () => {
    const flags = getStructuredFlags({
      ...empty,
      paymentTerms: { value: "Net 90", count: 1, total: 1 },
    });
    expect(flags.find((x) => x.id === "payment-terms")).toBeDefined();
  });

  it("still fires reverse auction on one report out of many", () => {
    const flags = getStructuredFlags({
      ...empty,
      friction: [{ event: "Reverse auction / e-procurement", count: 1, total: 9, reviewIds: ["a"] }],
    });
    expect(flags.find((x) => x.id === "reverse-auction")).toBeDefined();
  });
});

describe("green flags", () => {
  it("marks every structured risk flag with risk polarity", () => {
    const flags = getStructuredFlags({
      ...empty,
      ghostRate: { count: 4, total: 9, reviewIds: ["a"] },
    });
    expect(flags.every((f) => f.polarity === "risk")).toBe(true);
  });

  it("flags a clean procurement run when nobody reported friction", () => {
    const f = getStructuredFlags({ ...empty, frictionAnswered: 5 } as any).find(
      (x) => x.id === "clean-procurement",
    );
    expect(f).toBeDefined();
    expect(f!.polarity).toBe("strength");
    expect(f!.stat).toMatch(/\d/);
  });

  it("flags a responsive buyer from the communication rating", () => {
    const f = getStructuredFlags({
      ...empty,
      ratings: { ...empty.ratings, communication: { average: 4.6, total: 9 } },
    }).find((x) => x.id === "responsive-buyer")!;
    expect(f.polarity).toBe("strength");
    expect(f.stat).toContain("4.6");
  });

  it("does not flag a responsive buyer on a middling rating", () => {
    const flags = getStructuredFlags({
      ...empty,
      ratings: { ...empty.ratings, communication: { average: 3.4, total: 9 } },
    });
    expect(flags.find((x) => x.id === "responsive-buyer")).toBeUndefined();
  });

  it("does not flag a rating that clears the bar on too thin a sample", () => {
    const flags = getStructuredFlags({
      ...empty,
      ratings: { ...empty.ratings, scope: { average: 5, total: 0 } },
    });
    expect(flags.find((x) => x.id === "clear-scope")).toBeUndefined();
  });

  it("flags dates holding when the close date never moved", () => {
    const f = getStructuredFlags({
      ...empty,
      slippageRate: { count: 0, total: 6, reviewIds: [] },
    }).find((x) => x.id === "dates-hold")!;
    expect(f.polarity).toBe("strength");
    expect(f.stat).toBe("0 of 6 deals pushed");
  });

  it("flags an engaged buyer when nobody went dark", () => {
    const f = getStructuredFlags({
      ...empty,
      ghostRate: { count: 0, total: 5, reviewIds: [] },
    }).find((x) => x.id === "stays-engaged")!;
    expect(f.polarity).toBe("strength");
  });

  it("does not flag dates holding or engagement on an unanswered field", () => {
    const flags = getStructuredFlags(empty);
    expect(flags.find((x) => x.id === "dates-hold")).toBeUndefined();
    expect(flags.find((x) => x.id === "stays-engaged")).toBeUndefined();
  });

  it("flags fair payment terms", () => {
    const f = getStructuredFlags({
      ...empty,
      paymentTerms: { value: "Net 30", count: 5, total: 6 },
    }).find((x) => x.id === "fair-terms")!;
    expect(f.polarity).toBe("strength");
  });

  it("every green flag carries a number and at least one point", () => {
    const flags = getStructuredFlags({
      ...empty,
      frictionAnswered: 5,
      slippageRate: { count: 0, total: 6, reviewIds: [] },
      ghostRate: { count: 0, total: 5, reviewIds: [] },
      paymentTerms: { value: "Net 30", count: 5, total: 6 },
      ratings: {
        communication: { average: 4.6, total: 9 },
        negotiation: { average: 4.2, total: 9 },
        intent: { average: 4.4, total: 9 },
        scope: { average: 4.1, total: 9 },
      },
    } as any).filter((f) => f.polarity === "strength");
    expect(flags.length).toBeGreaterThan(3);
    for (const f of flags) {
      expect(f.stat).toMatch(/\d/);
      expect(f.qualify.length).toBeGreaterThan(0);
    }
  });
});
