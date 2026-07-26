# Adaptive Evidence Bar and Green Flags Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the flag panel useful on accounts with one or two reviews without overstating what that evidence proves, and surface what a buyer does *well* alongside what to watch for.

**Architecture:** Two changes to the same rule bank. First, the fixed "2 corroborating reports" bar becomes a function of how much evidence exists for that specific field, and severity is capped when the evidence is thin — so a single report can raise a flag but can never claim to be critical. Second, `AccountFlag` gains a `polarity`, a green rule bank is added over the same `DealMechanics` output plus the four star ratings the engine currently ignores, and the UI groups risks and strengths separately.

**Tech Stack:** React 19 + TypeScript + Vite + Tailwind, Vitest.

---

## Background For The Implementer

This continues `docs/superpowers/plans/2026-07-26-flags-to-qualify.md`, already implemented and merged. Read `services/accountFlags.ts` and `services/dealMechanics.ts` in full before starting.

### The problem being fixed

No account in production has three reviews yet, and `MIN_MECHANICS_REVIEWS = 3` hard-gates the whole panel. **The feature currently renders nothing for anyone.** Three separate gates have to move together or it stays dark:

| Gate | Where | Currently |
|---|---|---|
| `MIN_MECHANICS_REVIEWS` | `services/dealMechanics.ts` | 3 — `getDealMechanics` returns null below this, so no flags at all |
| `MIN_RULE_SAMPLE` | `services/accountFlags.ts` | 2 — blocks rate and modal flags standing on one answered field |
| `friction(m, event, min)` | `services/accountFlags.ts` | callers pass `min: 2` (except `reverse-auction`, deliberately 1) |

### The two ideas, and why they belong together

**Adaptive bar.** A constant bar is wrong at both ends. On a one-review account, "1 of 1" is all the evidence that exists — suppressing it doesn't make the account safer, it makes the product look empty. On a twenty-review account, two reports agreeing is noise but currently renders identically to fifteen.

**Confidence capping is not optional.** Lowering the bar alone would let one person's bad week render as `critical`, visually identical to a pattern across nine deals. That breaks the promise the panel makes. The bar falls, but severity is capped when evidence is thin.

**Green flags.** Everything today is a risk, which means the panel cannot distinguish a good account from a bad one — every account looks equally alarming. It also biases the data flywheel: if the product only publishes complaints, sellers who had a good experience have no reason to file a review.

### The denominator rule — the subtle part

Schema v2 fields are optional, so **each field has its own denominator**. A 6-review account can have a field only one person answered. The bar must key off *that field's* `total`, never `m.sampleSize`. Getting this wrong means a well-reviewed account still shows 1-of-1 flags at full confidence — the exact failure this plan exists to prevent.

### Rules that carry over

1. `communicationRating`, `negotiationLevel`, `timeWasterLevel`, `clarityOfScope` are all **high-is-good** despite the names (`types.ts:31-33`). Do not invert them. This matters enormously here — the green flags are built on them.
2. Every flag's `stat` must contain a real number. `mergeFlags` drops any that does not, and a test enforces it.
3. `reverse-auction` deliberately fires on a single report regardless of the bar — it is the worst outcome in the bank and one confirmed sighting is worth knowing.

### Commands

- Tests: `npm test`, or `npx vitest run <path>`
- Type check: `npm run type-check`
- Do not use `npm run build -w functions` — it fails, there is no `workspaces` field.

### Out of scope

The two-question review form split ("what went well / what didn't"). Deliberately deferred until review volume improves — it needs a schema change and a longer form at the moment submissions matter most. Do not touch `pages/CreateReview.tsx` or the review schema.

---

## File Structure

- `services/dealMechanics.ts` + test — lower the gate to 1, add rating averages
- `services/accountFlags.ts` + test — `evidenceBar`, `capSeverity`, `polarity`, the green rule bank, grouped merge
- `src/components/intel/FlagCard.tsx` + test — polarity styling
- `src/components/intel/FlagList.tsx` + test — group into risks and strengths
- `pages/CompanyProfile.tsx` + test — heading copy for the grouped panel

---

## Task 1: Lower the mechanics gate and add rating averages

**Files:**
- Modify: `services/dealMechanics.ts`
- Test: `services/dealMechanics.test.ts`

The green flags need the four star ratings, which `DealMechanics` does not currently carry. Each rating is optional in practice on legacy rows, so it gets its own count.

- [ ] **Step 1: Write the failing test**

Append to `services/dealMechanics.test.ts` (the file already imports `getDealMechanics`, `MIN_MECHANICS_REVIEWS` and the `r` helper):

```ts
describe("getDealMechanics rating averages", () => {
  it("returns a brief for a single review now that the gate is 1", () => {
    expect(MIN_MECHANICS_REVIEWS).toBe(1);
    const m = getDealMechanics([r({ id: "a" })]);
    expect(m).not.toBeNull();
    expect(m!.sampleSize).toBe(1);
  });

  it("returns null for an empty review set", () => {
    expect(getDealMechanics([])).toBeNull();
  });

  it("averages each rating with its own count", () => {
    const m = getDealMechanics([
      r({ id: "a", communicationRating: 5, negotiationLevel: 4, timeWasterLevel: 5, clarityOfScope: 4 }),
      r({ id: "b", communicationRating: 3, negotiationLevel: 2, timeWasterLevel: 3, clarityOfScope: 2 }),
    ]);
    expect(m!.ratings.communication).toEqual({ average: 4, total: 2 });
    expect(m!.ratings.negotiation).toEqual({ average: 3, total: 2 });
    expect(m!.ratings.intent).toEqual({ average: 4, total: 2 });
    expect(m!.ratings.scope).toEqual({ average: 3, total: 2 });
  });

  it("excludes a review from a rating's denominator when that rating is missing", () => {
    const m = getDealMechanics([
      r({ id: "a", communicationRating: 4 }),
      r({ id: "b", communicationRating: undefined as unknown as number }),
    ]);
    expect(m!.ratings.communication).toEqual({ average: 4, total: 1 });
  });

  it("rounds an average to one decimal place", () => {
    const m = getDealMechanics([
      r({ id: "a", communicationRating: 5 }),
      r({ id: "b", communicationRating: 4 }),
      r({ id: "c", communicationRating: 4 }),
    ]);
    expect(m!.ratings.communication.average).toBe(4.3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run services/dealMechanics.test.ts`
Expected: FAIL — `expected 3 to be 1` and `Cannot read properties of undefined (reading 'communication')`

- [ ] **Step 3: Write the implementation**

In `services/dealMechanics.ts`, change the constant and its comment:

```ts
/**
 * A brief needs at least one review. The per-flag evidence bar in
 * services/accountFlags.ts is what scales confidence with sample size - this
 * gate only stops an empty account rendering an empty panel.
 */
export const MIN_MECHANICS_REVIEWS = 1;
```

Add above the `DealMechanics` interface:

```ts
/** Average of one 1-5 rating, with the number of reviews that supplied it. */
export interface RatingStat {
  average: number;
  total: number;
}

/**
 * The four execution ratings. ALL ARE HIGH-IS-GOOD despite the legacy field
 * names on Review (see types.ts:31-33) - a 5 for `negotiation` means the
 * negotiation was easy, not brutal. Never invert these.
 */
export interface Ratings {
  communication: RatingStat;
  negotiation: RatingStat;
  intent: RatingStat;
  scope: RatingStat;
}

/** Average one rating across the reviews that actually supplied it. */
export function ratingStat(reviews: Review[], pick: (r: Review) => number | undefined): RatingStat {
  const values = reviews
    .map(pick)
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v) && v > 0);
  if (values.length === 0) return { average: 0, total: 0 };
  const sum = values.reduce((a, v) => a + v, 0);
  return { average: Number((sum / values.length).toFixed(1)), total: values.length };
}
```

Add `ratings: Ratings;` to the `DealMechanics` interface, and add this to the object returned by `getDealMechanics`:

```ts
    ratings: {
      communication: ratingStat(reviews, (r) => r.communicationRating),
      negotiation: ratingStat(reviews, (r) => r.negotiationLevel),
      intent: ratingStat(reviews, (r) => r.timeWasterLevel),
      scope: ratingStat(reviews, (r) => r.clarityOfScope),
    },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run services/dealMechanics.test.ts`
Expected: PASS — all tests, including the pre-existing ones

- [ ] **Step 5: Commit**

```bash
git add services/dealMechanics.ts services/dealMechanics.test.ts
git commit -m "feat(mechanics): lower the gate to one review and expose rating averages"
```

---

## Task 2: The adaptive evidence bar

**Files:**
- Modify: `services/accountFlags.ts`
- Test: `services/accountFlags.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `services/accountFlags.test.ts` (add `evidenceBar, capSeverity` to the existing import):

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run services/accountFlags.test.ts`
Expected: FAIL — `evidenceBar is not exported`

- [ ] **Step 3: Write the implementation**

In `services/accountFlags.ts`, delete `MIN_RULE_SAMPLE` and its comment, and replace with:

```ts
/**
 * How many corroborating reports a flag needs, as a function of how many
 * reviews answered THAT FIELD - not how many reviews the account has. Schema
 * v2 fields are optional, so a 9-review account can still have a field only one
 * person filled in.
 *
 * A constant bar is wrong at both ends. On a one-review account "1 of 1" is all
 * the evidence that exists, and suppressing it makes the product look empty
 * rather than making the account safer. On a twenty-review account two reports
 * agreeing is noise.
 *
 * An explicit table rather than a formula - these want tuning by feel against
 * real accounts, and `clamp(ceil(n / 3), 1, 3)` is unreadable in six months.
 */
export function evidenceBar(fieldTotal: number): number {
  if (fieldTotal <= 2) return 1;
  if (fieldTotal <= 8) return 2;
  return 3;
}

/** Below this many corroborating reports, a flag cannot claim to be critical. */
const CONFIDENT_EVIDENCE = 3;

/**
 * A flag standing on one or two reports is one person's experience. It is
 * still worth showing - but it must not render identically to a pattern across
 * nine deals, which is what dropping the bar would otherwise do.
 */
export function capSeverity(severity: FlagSeverity, backing: number): FlagSeverity {
  if (severity === "critical" && backing < CONFIDENT_EVIDENCE) return "caution";
  return severity;
}
```

Replace `friction` and `rateOver`:

```ts
/**
 * Find a friction event that cleared the adaptive bar for its own sample.
 * `alwaysOne` is for findings severe enough that a single confirmed sighting
 * is worth knowing regardless of sample size.
 */
export function friction(m: DealMechanics, event: string, alwaysOne = false): FrictionStat | null {
  const f = m.friction.find((x) => x.event === event);
  if (!f) return null;
  const bar = alwaysOne ? 1 : evidenceBar(f.total);
  return f.count >= bar ? f : null;
}

/** True when a rate cleared `threshold` (0-1) on a sample that clears its own bar. */
export function rateOver(s: { count: number; total: number }, threshold: number): boolean {
  return s.total > 0 && s.count >= evidenceBar(s.total) && s.count / s.total > threshold;
}
```

In the `frictionFlag` helper, change the options type: replace `min: number;` with `alwaysOne?: boolean;`, change the lookup to `const f = friction(m, opts.event, opts.alwaysOne);`, and wrap the severity as `severity: capSeverity(opts.severity, f.count),`.

In the rule bank:
- `reverse-auction`: replace `min: 1,` with `alwaysOne: true,`
- every other `frictionFlag` call: delete the `min: 2,` line entirely
- the four modal rules (`procurement-early`, `verbal-drift`, `payment-terms`, `stakeholder-sprawl`): replace `s.total < MIN_RULE_SAMPLE` with `s.count < evidenceBar(s.total)`
- `ghosting` and `close-slippage`: wrap severity as `severity: capSeverity("critical", m.ghostRate.count)` and `capSeverity("critical", m.slippageRate.count)` respectively

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run services/accountFlags.test.ts`
Expected: PASS. Some pre-existing tests will now be wrong — specifically ones asserting that a 1-of-1 field does NOT fire, which was the old behaviour and is exactly what this task changes. Update those assertions to the new expectation rather than weakening the code. The `"does not fire a rate flag at exactly one third"` test uses 3 of 9, which still correctly does not fire.

- [ ] **Step 5: Commit**

```bash
git add services/accountFlags.ts services/accountFlags.test.ts
git commit -m "feat(flags): scale the evidence bar with sample size and cap thin severity"
```

---

## Task 3: Polarity and the green rule bank

**Files:**
- Modify: `services/accountFlags.ts`
- Test: `services/accountFlags.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `services/accountFlags.test.ts`:

```ts
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
```

Note the test fixture `empty` needs a `ratings` field added — set all four to `{ average: 0, total: 0 }`. Also add `frictionAnswered: 0`, described in Step 3.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run services/accountFlags.test.ts`
Expected: FAIL — `polarity` is not a property, and none of the green flag ids exist

- [ ] **Step 3: Write the implementation**

`frictionRanking` omits events nobody reported, so an account with zero friction has an empty array and no way to tell "nobody answered" from "everybody answered none". Add the answered count to `services/dealMechanics.ts` — on the `DealMechanics` interface:

```ts
  /** Reviews that answered the friction question at all. An empty array is a real answer. */
  frictionAnswered: number;
```

and in the returned object:

```ts
    frictionAnswered: reviews.filter((r) => Array.isArray(r.frictionEvents)).length,
```

In `services/accountFlags.ts`, add to `AccountFlag`:

```ts
  /** Whether this is something to watch for or something working in your favour. */
  polarity: FlagPolarity;
```

and the type:

```ts
export type FlagPolarity = "risk" | "strength";
```

Add `polarity: "risk",` to every existing rule and to the `frictionFlag` helper's returned object. Then append the green bank to `RULES`:

```ts
  // ── Strengths ────────────────────────────────────────────────────────────
  // Same evidence bar as the risks. A buyer who runs a clean process is a
  // finding too - a panel that only ever shows red cannot tell a good account
  // from a bad one, which is the entire job.
  (m) => {
    if (m.frictionAnswered < 2 || m.friction.length > 0) return null;
    return {
      id: "clean-procurement",
      label: "No procurement gauntlet reported",
      severity: "watch",
      stat: `0 friction events across ${m.frictionAnswered} reports`,
      qualify: [
        "whether your contract size stays under their review threshold",
        "what changed for sellers who did hit a review",
      ],
      reviewIds: [],
      strength: 1,
      priority: 70,
      source: "mechanics",
      polarity: "strength",
    };
  },
  (m) => {
    const s = m.ghostRate;
    if (s.total < 2 || s.count > 0) return null;
    return {
      id: "stays-engaged",
      label: "Buyer stays engaged through the cycle",
      severity: "watch",
      stat: `0 of ${s.total} deals went dark`,
      qualify: ["who kept the thread moving", "what cadence they expect"],
      reviewIds: [],
      strength: 1,
      priority: 75,
      source: "mechanics",
      polarity: "strength",
    };
  },
  (m) => {
    const s = m.slippageRate;
    if (s.total < 2 || s.count > 0) return null;
    return {
      id: "dates-hold",
      label: "Close dates hold",
      severity: "watch",
      stat: `0 of ${s.total} deals pushed`,
      qualify: ["what their approval calendar looks like", "whether budget is already allocated"],
      reviewIds: [],
      strength: 1,
      priority: 80,
      source: "mechanics",
      polarity: "strength",
    };
  },
  (m) => {
    const s = m.paymentTerms;
    if (!s || s.count < evidenceBar(s.total) || s.value !== "Net 30") return null;
    return {
      id: "fair-terms",
      label: "Standard terms are Net 30",
      severity: "watch",
      stat: `${s.count} of ${s.total} reports`,
      qualify: ["whether that holds at your contract size"],
      reviewIds: [],
      strength: s.count / s.total,
      priority: 55,
      source: "mechanics",
      polarity: "strength",
    };
  },
  (m) => {
    const s = m.verbalToSignature;
    if (!s || s.count < evidenceBar(s.total) || (s.value !== "< 1 Week" && s.value !== "1-4 Weeks")) {
      return null;
    }
    return {
      id: "fast-signature",
      label: "Signature follows the verbal quickly",
      severity: "watch",
      stat: `${s.value} typical, across ${s.total} reports`,
      qualify: ["who holds signing authority at your deal size"],
      reviewIds: [],
      strength: s.count / s.total,
      priority: 60,
      source: "mechanics",
      polarity: "strength",
    };
  },
  ...ratingFlag({
    id: "responsive-buyer",
    key: "communication",
    label: "Responsive buyer",
    noun: "responsiveness",
    priority: 72,
    qualify: ["which channel they actually reply on", "who your day-to-day contact will be"],
  }),
  ...ratingFlag({
    id: "easy-negotiation",
    key: "negotiation",
    label: "Negotiation runs clean",
    noun: "negotiation ease",
    priority: 68,
    qualify: ["what they expect on commercials up front"],
  }),
  ...ratingFlag({
    id: "serious-buyer",
    key: "intent",
    label: "Buyers here are serious",
    noun: "buyer intent",
    priority: 76,
    qualify: ["what triggered their evaluation", "whether budget already exists"],
  }),
  ...ratingFlag({
    id: "clear-scope",
    key: "scope",
    label: "Scope is clear up front",
    noun: "scope clarity",
    priority: 64,
    qualify: ["whether requirements are already written down"],
  }),
```

Add above `RULES`:

```ts
/** A rating at or above this is a genuine strength rather than "fine". */
const STRONG_RATING = 4;

/**
 * Build a rule from one of the four execution ratings. All four are
 * HIGH-IS-GOOD despite the legacy field names - see the comment on `Ratings`
 * in services/dealMechanics.ts. Returned as a single-element array so the call
 * site can spread it inline with the other rules.
 */
function ratingFlag(opts: {
  id: string;
  key: keyof DealMechanics["ratings"];
  label: string;
  noun: string;
  priority: number;
  qualify: string[];
}): Rule[] {
  return [
    (m) => {
      const s = m.ratings[opts.key];
      if (s.total < 2 || s.average < STRONG_RATING) return null;
      return {
        id: opts.id,
        label: opts.label,
        severity: "watch",
        stat: `${s.average} out of 5 for ${opts.noun}, across ${s.total} reports`,
        qualify: opts.qualify,
        reviewIds: [],
        strength: (s.average - STRONG_RATING) / (5 - STRONG_RATING),
        priority: opts.priority,
        source: "mechanics",
        polarity: "strength",
      };
    },
  ];
}
```

Also update `validateAiFlags` in `functions/src/accountFlags.ts` to stamp `polarity: "risk"` on AI flags — the free-text prompt asks for risks only. Add the field to that file's local `AccountFlag` interface too.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run services/accountFlags.test.ts services/dealMechanics.test.ts`
Expected: PASS

Run: `cd functions && npx vitest run src/accountFlags.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add services/accountFlags.ts services/accountFlags.test.ts services/dealMechanics.ts functions/src/accountFlags.ts
git commit -m "feat(flags): add green flags for what a buyer does well"
```

---

## Task 4: Group risks and strengths in the merge

**Files:**
- Modify: `services/accountFlags.ts`
- Test: `services/accountFlags.test.ts`

Strengths must not crowd out a critical risk, so each group is capped independently.

- [ ] **Step 1: Write the failing test**

Append to `services/accountFlags.test.ts` (add `groupFlags, MAX_RISK_FLAGS, MAX_STRENGTH_FLAGS` to the import). The `flag()` helper already in the file needs `polarity: "risk"` added to its defaults.

```ts
describe("groupFlags", () => {
  it("splits by polarity and ranks within each group", () => {
    const out = groupFlags(
      [
        flag({ id: "weak", priority: 90, strength: 0.2 }),
        flag({ id: "strong", priority: 82, strength: 0.9 }),
        flag({ id: "good", polarity: "strength", priority: 70, strength: 1 }),
      ],
      [],
    );
    expect(out.risks.map((f) => f.id)).toEqual(["strong", "weak"]);
    expect(out.strengths.map((f) => f.id)).toEqual(["good"]);
  });

  it("caps each group independently so strengths cannot crowd out risks", () => {
    const risks = Array.from({ length: 9 }, (_, i) => flag({ id: `r${i}`, priority: 100 - i }));
    const strengths = Array.from({ length: 9 }, (_, i) =>
      flag({ id: `s${i}`, polarity: "strength", priority: 100 - i }),
    );
    const out = groupFlags([...risks, ...strengths], []);
    expect(out.risks).toHaveLength(MAX_RISK_FLAGS);
    expect(out.strengths).toHaveLength(MAX_STRENGTH_FLAGS);
  });

  it("still drops a flag with no number in its stat", () => {
    const out = groupFlags([flag({ id: "bad", stat: "several deals" })], []);
    expect(out.risks).toEqual([]);
  });

  it("puts AI flags in the risk group", () => {
    const out = groupFlags([], [flag({ id: "ai-1", source: "reports" })]);
    expect(out.risks.map((f) => f.id)).toEqual(["ai-1"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run services/accountFlags.test.ts`
Expected: FAIL — `groupFlags is not exported`

- [ ] **Step 3: Write the implementation**

In `services/accountFlags.ts`, replace `MAX_FLAGS` with:

```ts
/** Sellers scan. Risks get the larger share - they drive the next call. */
export const MAX_RISK_FLAGS = 5;
export const MAX_STRENGTH_FLAGS = 3;
```

Add below `mergeFlags`, keeping `mergeFlags` itself unchanged so its dedupe and stat validation stay in one place:

```ts
export interface GroupedFlags {
  risks: AccountFlag[];
  strengths: AccountFlag[];
}

/**
 * Split the merged list by polarity and cap each group separately. Capping the
 * combined list would let a run of strengths push a critical risk off the page.
 */
export function groupFlags(structured: AccountFlag[], ai: AccountFlag[]): GroupedFlags {
  const all = mergeFlags(structured, ai);
  return {
    risks: all.filter((f) => f.polarity === "risk").slice(0, MAX_RISK_FLAGS),
    strengths: all.filter((f) => f.polarity === "strength").slice(0, MAX_STRENGTH_FLAGS),
  };
}
```

`mergeFlags` currently ends with `.slice(0, MAX_FLAGS)` — remove that slice so grouping sees the full ranked list, and update any test asserting the old combined cap.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run services/accountFlags.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add services/accountFlags.ts services/accountFlags.test.ts
git commit -m "feat(flags): group risks and strengths with independent caps"
```

---

## Task 5: Render both groups

**Files:**
- Modify: `src/components/intel/FlagCard.tsx` + test, `src/components/intel/FlagList.tsx` + test

- [ ] **Step 1: Write the failing test**

Append to `src/components/intel/FlagCard.test.tsx` (the existing `flag` fixture needs `polarity: "risk"` added):

```tsx
describe("FlagCard polarity", () => {
  it("renders a strength with the positive accent, not the risk accent", () => {
    const { container } = render(
      <FlagCard
        flag={{ ...flag, polarity: "strength", severity: "watch" }}
        checked={[]}
        onToggle={() => {}}
        showDetail
        onShowEvidence={() => {}}
      />,
    );
    expect(container.querySelector(".border-l-signal-healthy")).not.toBeNull();
    expect(container.querySelector(".border-l-signal-risk")).toBeNull();
  });

  it("keeps the risk accent for a risk flag", () => {
    const { container } = render(
      <FlagCard flag={flag} checked={[]} onToggle={() => {}} showDetail onShowEvidence={() => {}} />,
    );
    expect(container.querySelector(".border-l-signal-healthy")).toBeNull();
  });
});
```

Append to `src/components/intel/FlagList.test.tsx`:

```tsx
describe("FlagList grouping", () => {
  const grouped = {
    risks: [flags[0]],
    strengths: [
      {
        id: "dates-hold", label: "Close dates hold", severity: "watch" as const,
        stat: "0 of 6 deals pushed", qualify: ["what their approval calendar looks like"],
        reviewIds: [], strength: 1, priority: 80, source: "mechanics" as const,
        polarity: "strength" as const,
      },
    ],
  };

  it("renders both groups under their own headings", () => {
    render(
      <MemoryRouter>
        <FlagList companyId="c1" grouped={grouped} isPro onShowEvidence={() => {}} />
      </MemoryRouter>,
    );
    expect(screen.getByText("Watch for")).toBeInTheDocument();
    expect(screen.getByText("In your favour")).toBeInTheDocument();
    expect(screen.getByText("Close dates hold")).toBeInTheDocument();
  });

  it("omits a group heading when that group is empty", () => {
    render(
      <MemoryRouter>
        <FlagList
          companyId="c1"
          grouped={{ risks: grouped.risks, strengths: [] }}
          isPro
          onShowEvidence={() => {}}
        />
      </MemoryRouter>,
    );
    expect(screen.queryByText("In your favour")).not.toBeInTheDocument();
  });
});
```

The other `FlagList` tests need their `flags={flags}` prop changed to `grouped={{ risks: flags, strengths: [] }}`, and the fixtures need `polarity: "risk"`.

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/components/intel/FlagCard.test.tsx src/components/intel/FlagList.test.tsx`
Expected: FAIL — `grouped` is not a prop, and `.border-l-signal-healthy` does not exist

- [ ] **Step 3: Add the colour token**

In `tailwind.config.js`, add a `good` entry alongside the existing `signal.risk` and `signal.caution` colours — a green in the same family, e.g. `"#16a34a"`. Read the existing `signal` block and match its structure exactly rather than guessing the nesting.

- [ ] **Step 4: Update FlagCard**

Replace the `ACCENT` and `TEXT` lookups so polarity wins over severity:

```tsx
const RISK_ACCENT: Record<AccountFlag["severity"], string> = {
  critical: "border-l-signal-risk",
  caution: "border-l-signal-caution",
  watch: "border-l-slate-300",
};

const RISK_TEXT: Record<AccountFlag["severity"], string> = {
  critical: "text-signal-risk",
  caution: "text-signal-caution",
  watch: "text-slate-500",
};

const accentFor = (flag: AccountFlag): string =>
  flag.polarity === "strength" ? "border-l-signal-healthy" : RISK_ACCENT[flag.severity];

const textFor = (flag: AccountFlag): string =>
  flag.polarity === "strength" ? "text-signal-healthy" : RISK_TEXT[flag.severity];
```

and use `accentFor(flag)` / `textFor(flag)` in the JSX.

- [ ] **Step 4: Update FlagList**

Change the `flags: AccountFlag[]` prop to `grouped: GroupedFlags`, importing the type. Render each non-empty group under a heading — `"Watch for"` for risks, `"In your favour"` for strengths — using a small subheading style consistent with the existing `text-2xs font-semibold text-slate-400 uppercase tracking-wider` used elsewhere in `src/components/intel/`.

The progress count spans both groups. The empty state applies when both are empty. The non-Pro upsell counts both: `Unlock {risks.length + strengths.length} flags with Sales Pro`.

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run src/components/intel/FlagCard.test.tsx src/components/intel/FlagList.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/intel/FlagCard.tsx src/components/intel/FlagCard.test.tsx \
        src/components/intel/FlagList.tsx src/components/intel/FlagList.test.tsx
git commit -m "feat(flags): render strengths alongside risks"
```

---

## Task 6: Wire the page

**Files:**
- Modify: `pages/CompanyProfile.tsx`, `pages/CompanyProfile.test.tsx`

- [ ] **Step 1: Swap the derivation**

In `pages/CompanyProfile.tsx`, change the `flags` useMemo to use `groupFlags`:

```tsx
  const grouped = useMemo(
    () => groupFlags(mechanics ? getStructuredFlags(mechanics) : [], aiFlags),
    [mechanics, aiFlags],
  );
```

Update the import from `../services/accountFlags` to bring in `groupFlags` instead of `mergeFlags`, and pass `grouped={grouped}` to `FlagList`.

The section heading changes from `"Flags to qualify"` to `"Flags"` — the panel now covers both directions, and "qualify" no longer describes the strengths half.

- [ ] **Step 2: Update the page test**

In `pages/CompanyProfile.test.tsx`, change the `/Flags to qualify/` heading assertions to `/^Flags$/`. The 3-review `briefReviews` fixture will now also produce strengths, so add an assertion that the `"In your favour"` heading appears for Pro users and not for free users.

- [ ] **Step 3: Verify**

Run: `npm test`
Expected: PASS

Run: `npm run type-check`
Expected: exit 0

Run: `npm run build`
Expected: exit 0

- [ ] **Step 4: Commit**

```bash
git add pages/CompanyProfile.tsx pages/CompanyProfile.test.tsx
git commit -m "feat(profile): show flags in both directions"
```

---

## Task 7: Verify in the running app

**Files:** none — verification.

Local Firebase has no credentials in this sandbox, so reviews fail with `permission-denied` and a company profile cannot be reached. If that is still true, say so plainly rather than claiming the panels were verified.

- [ ] **Step 1: Start the preview** with `preview_start` `{name: "dev"}`

- [ ] **Step 2: Check for regressions** with `read_console_messages` `{onlyErrors: true}`. Firebase permission and analytics errors are pre-existing environment noise. Anything naming `accountFlags`, `FlagList` or `FlagCard` is not.

- [ ] **Step 3: If credentials are available**, open a company with exactly ONE review. The whole point of this change is that it now renders something. Confirm flags appear, that none of them read `critical`, and that the stats honestly say "1 of 1".

- [ ] **Step 4: Screenshot and stop the server.**

---

## Deferred

- **The two-question review form** ("what went well / what didn't"). The better data model for green flags — asking the seller beats classifying mixed prose — but it needs a schema v3 and a longer form at the moment review volume is the binding constraint. Revisit once accounts routinely carry 3+ reviews.
- **Green flags from free text.** The AI prompt asks for risks only. Once the form split lands, the "what went well" corpus feeds strengths directly with no classification step.
- **Tuning `evidenceBar`.** The 1/2/3 table is a first guess. Revisit against real accounts once volume allows.
