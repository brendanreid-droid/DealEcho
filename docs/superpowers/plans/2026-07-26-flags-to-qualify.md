# Flags To Qualify Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collapse the company profile's four overlapping intelligence panels into one — a ranked list of flags, each carrying the stat that proves it, the points a seller should qualify, and links to the reviews it came from.

**Architecture:** One flag engine, two sources. Structured flags are derived deterministically from schema v2 review fields via the existing `getDealMechanics` output. Free-text flags come from a single Gemini call whose every claim must cite review IDs that exist in the corpus. Both produce the same `AccountFlag` shape, are merged, ranked and rendered by one component. The old keyword-matching flag rules, the separate questions panel and the separate themes panel are all deleted.

**Tech Stack:** React 19 + TypeScript + Vite + Tailwind, Vitest, Firebase Cloud Functions v2 (Node 22) with `@google/genai` (Gemini 2.5 Flash), Firestore for the AI flag cache.

---

## Background For The Implementer

This plan continues from `docs/superpowers/plans/2026-07-26-deal-mechanics-brief.md`, already implemented on branch `feat/deal-mechanics-brief`. Read that plan's "As-built corrections" section before starting — it records where the earlier plan was wrong.

### Why this change

The profile currently renders four panels computed by two engines that overlap:

| Panel | Source | Problem |
|---|---|---|
| Red flags | `services/accountSignal.ts` keyword rules | Substring matching. `"freeze"` fires on anything, `"legal"` fires on *"legal team was great"*. Reads none of the v2 fields. |
| How this buyer buys | `services/dealMechanics.ts` | Correct. Keep as is. |
| Ask this account | `services/qualificationQuestions.ts` | Reads v2 fields but never the review text. 13 fixed sentences. |
| What sellers keep reporting | `functions/src/accountThemes.ts` | Reads review text, emits observations with no action attached. |

Rows 1, 3 and 4 are three passes over the same question — "what should worry me about this account" — computed three different ways, one of them known-noisy. This plan makes it one.

### The output shape

A flag is a finding, the number that proves it, and what to nail down:

> **Security review is a gate** · critical · 7 of 9 deals
> Qualify: which tier applies at your contract size · whether it runs parallel to commercial · who signs off
> Evidence: 3 reports

### Rules that carry over from the previous plan

1. Schema v2 fields on `Review` are **optional**. Every aggregate computes its own denominator. Never divide by `reviews.length`.
2. `communicationRating`, `negotiationLevel`, `timeWasterLevel`, `clarityOfScope` are **high-is-good** despite the names (`types.ts:31-33`). Do not invert.
3. **Every flag's `stat` string must contain a real number.** A flag that would apply to any account is the failure mode this whole line of work exists to avoid. A test enforces this.
4. Minimum sample is 3 reviews overall (`MIN_MECHANICS_REVIEWS`) and 2 answering reviews per field (`MIN_RULE_SAMPLE`).
5. AI output is untrusted: a claim citing no real review ID is dropped entirely.

### Commands that actually work in this repo

- Frontend tests: `npm test`, or `npx vitest run <path>` — from the repo root
- Functions tests: `cd functions && npx vitest run src/<file>.test.ts`
- Functions build: `cd functions && npm run build`  (**not** `npm run build -w functions`, which fails — no `workspaces` field)
- Type check: `npm run type-check`

### Do not touch

`functions/src/extension/lookupCompanyReviews.ts` and `functions/src/extension/personaCache.ts`. The browser extension has its own separate persona feature. It stays.

---

## File Structure

**New**
- `services/accountFlags.ts` — `AccountFlag` type, the structured rule bank, merge and ranking
- `services/accountFlags.test.ts`
- `services/aiFlags.ts` — client wrapper for the `getAccountFlags` callable
- `functions/src/accountFlags.ts` — the callable, corpus fingerprinting, AI flag validation
- `functions/src/accountFlags.test.ts`

**Rewritten**
- `src/components/intel/FlagCard.tsx` + test — renders one flag with qualify points and ticks
- `src/components/intel/FlagList.tsx` + test — ranks, caps, owns tick persistence
- `services/accountSignal.ts` + test — keeps `headline`, `sentiment`, `trend`; loses `flags`
- `pages/CompanyProfile.tsx` — two panels instead of four

**Deleted**
- `services/qualificationQuestions.ts` + test
- `src/components/intel/QuestionList.tsx` + test
- `src/components/intel/ThemeList.tsx` + test
- `services/accountThemes.ts`
- `functions/src/accountThemes.ts` + test

**Modified**
- `functions/src/index.ts` — export `getAccountFlags`, drop `getAccountThemes`
- `.github/workflows/deploy-functions.yml` — rename in the deploy allowlist

`getAccountThemes` has never been deployed (the branch was never pushed, and CI deploys only on `main`), so renaming it is free — no orphaned function.

---

## Task 1: The AccountFlag type and stable tick IDs

**Files:**
- Create: `services/accountFlags.ts`
- Test: `services/accountFlags.test.ts`

Tick state must survive regeneration. A seller ticks "who signs off" on Monday; a new review lands on Tuesday and the AI flags regenerate. If IDs are positional, their ticks silently move to different points. Derive the ID from the text instead.

- [ ] **Step 1: Write the failing test**

Create `services/accountFlags.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { pointId } from "./accountFlags";

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run services/accountFlags.test.ts`
Expected: FAIL — `Failed to resolve import "./accountFlags"`

- [ ] **Step 3: Write minimal implementation**

Create `services/accountFlags.ts`:

```ts
/**
 * One flag engine for the company profile: a finding, the number that proves
 * it, and the points a seller should qualify on their next call.
 *
 * Two sources produce the same shape. Structured flags are derived
 * deterministically from schema v2 fields (see services/dealMechanics.ts).
 * Free-text flags come from Gemini and are citation-validated server-side.
 *
 * Design rule inherited from the questions engine this replaces: a flag only
 * renders if its data slot is filled, and `stat` must carry a real number. A
 * finding that would apply to any account is worthless.
 */

export type FlagSeverity = "critical" | "caution" | "watch";

/** Where a flag came from. The UI marks free-text flags so sellers can weigh them. */
export type FlagSource = "mechanics" | "reports";

export interface AccountFlag {
  /** Stable kebab-case identifier. Structured flags use a fixed id; AI flags hash their label. */
  id: string;
  /** Short finding, e.g. "Security review is a gate". */
  label: string;
  severity: FlagSeverity;
  /** The evidence line. MUST contain a number. */
  stat: string;
  /** One to three fragments a seller should nail down. Not full sentences. */
  qualify: string[];
  /** Reviews backing this flag, for the evidence link. */
  reviewIds: string[];
  /** Observed rate, 0-1. Blended into ranking. */
  strength: number;
  /** Category weight. Higher sorts first. */
  priority: number;
  source: FlagSource;
}

/**
 * FNV-1a. Not cryptographic - this only needs to be stable and cheap so a
 * ticked qualification point keeps its identity when flags regenerate.
 */
function hash8(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/**
 * Identity for one qualification point, stable across regenerations.
 * Normalised so that whitespace or capitalisation changes do not orphan a tick.
 */
export function pointId(flagId: string, point: string): string {
  return `${flagId}:${hash8(point.trim().toLowerCase())}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run services/accountFlags.test.ts`
Expected: PASS — 5 tests

- [ ] **Step 5: Commit**

```bash
git add services/accountFlags.ts services/accountFlags.test.ts
git commit -m "feat(flags): add AccountFlag type and stable qualification point ids"
```

---

## Task 2: The structured flag bank

**Files:**
- Modify: `services/accountFlags.ts`
- Test: `services/accountFlags.test.ts`

This ports the 13 rules from `services/qualificationQuestions.ts`. Read that file before you start — the triggers, thresholds, `MIN_RULE_SAMPLE` floor and `strength` calculation all carry over unchanged. What changes is the output: a scripted question becomes a label plus qualification fragments.

- [ ] **Step 1: Write the failing test**

Append to `services/accountFlags.test.ts` (add `getStructuredFlags, MAX_FLAGS` to the existing import):

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run services/accountFlags.test.ts`
Expected: FAIL — `getStructuredFlags is not exported`

- [ ] **Step 3: Write minimal implementation**

Append to `services/accountFlags.ts`:

```ts
import { DealMechanics, FrictionStat } from "./dealMechanics";

/** Sellers scan. More than this and the list stops being read. */
export const MAX_FLAGS = 7;

/**
 * A rate or modal rule needs at least this many reviews to have ANSWERED the
 * underlying field. Per-field denominators are independent of the review count,
 * so a 9-review account can still have a 1-of-1 modal.
 */
export const MIN_RULE_SAMPLE = 2;

/** Find a friction event that hit at least `min` reports. */
export function friction(m: DealMechanics, event: string, min: number): FrictionStat | null {
  const f = m.friction.find((x) => x.event === event);
  return f && f.count >= min ? f : null;
}

/** True when a rate cleared `threshold` (0-1) on a sample of at least MIN_RULE_SAMPLE. */
export function rateOver(s: { count: number; total: number }, threshold: number): boolean {
  return s.total >= MIN_RULE_SAMPLE && s.count / s.total > threshold;
}

type Rule = (m: DealMechanics) => AccountFlag | null;

/** Shorthand for a friction-driven flag, which is most of the bank. */
function frictionFlag(
  m: DealMechanics,
  opts: {
    id: string;
    event: string;
    min: number;
    label: string;
    severity: FlagSeverity;
    priority: number;
    qualify: string[];
  },
): AccountFlag | null {
  const f = friction(m, opts.event, opts.min);
  if (!f) return null;
  return {
    id: opts.id,
    label: opts.label,
    severity: opts.severity,
    stat: `${f.count} of ${f.total} deals`,
    qualify: opts.qualify,
    reviewIds: f.reviewIds,
    strength: f.count / f.total,
    priority: opts.priority,
    source: "mechanics",
  };
}

const RULES: Rule[] = [
  (m) =>
    frictionFlag(m, {
      id: "reverse-auction",
      event: "Reverse auction / e-procurement",
      min: 1,
      label: "Deals go to reverse auction",
      severity: "critical",
      priority: 100,
      qualify: [
        "whether this deal is headed for an auction or e-procurement event",
        "what qualifies a vendor to be exempted",
        "who decides that, and when",
      ],
    }),
  (m) =>
    frictionFlag(m, {
      id: "security-review",
      event: "Security questionnaire",
      min: 2,
      label: "Security review is a gate",
      severity: "caution",
      priority: 90,
      qualify: [
        "which review tier applies at your contract size",
        "whether it can run parallel to the commercial evaluation",
        "who signs it off",
      ],
    }),
  (m) =>
    frictionFlag(m, {
      id: "legal-redlines",
      event: "Legal redlines on MSA",
      min: 2,
      label: "MSA redlines are routine",
      severity: "caution",
      priority: 80,
      qualify: [
        "whether they will share their standard MSA up front",
        "which clauses they will not move on",
        "how long legal review has taken before",
      ],
    }),
  (m) =>
    frictionFlag(m, {
      id: "poc-required",
      event: "Pilot / POC required",
      min: 2,
      label: "A pilot is expected before signature",
      severity: "caution",
      priority: 78,
      qualify: [
        "the written success criteria",
        "who signs off that they were met",
        "what happens commercially once they are",
      ],
    }),
  (m) =>
    frictionFlag(m, {
      id: "soc2-evidence",
      event: "SOC 2 / pen test required",
      min: 2,
      label: "Third-party security evidence required",
      severity: "caution",
      priority: 75,
      qualify: [
        "whether your current SOC 2 satisfies them",
        "whether they require an independent pen test",
        "how long their review of it takes",
      ],
    }),
  (m) =>
    frictionFlag(m, {
      id: "vendor-portal",
      event: "Vendor onboarding portal",
      min: 2,
      label: "Vendor onboarding adds time at PO stage",
      severity: "watch",
      priority: 60,
      qualify: [
        "which portal you need to register in",
        "how long approval usually takes",
        "whether you can start before the PO",
      ],
    }),
  (m) =>
    frictionFlag(m, {
      id: "reference-calls",
      event: "Reference calls required",
      min: 2,
      label: "Customer references become a gate",
      severity: "watch",
      priority: 55,
      qualify: [
        "how many references they need and in which industries",
        "at what stage they become blocking",
      ],
    }),
  (m) => {
    const s = m.procurementEntry;
    if (!s || s.total < MIN_RULE_SAMPLE || s.value !== "Early (before shortlist)") return null;
    return {
      id: "procurement-early",
      label: "Procurement engages before shortlist",
      severity: "caution",
      stat: `${s.count} of ${s.total} deals`,
      qualify: [
        "who owns the commercial evaluation",
        "what they need from you to stay on the shortlist",
        "whether a preferred vendor is already in place",
      ],
      reviewIds: [],
      strength: s.count / s.total,
      priority: 88,
      source: "mechanics",
    };
  },
  (m) => {
    if (!rateOver(m.ghostRate, 1 / 3)) return null;
    return {
      id: "ghosting",
      label: "Buyer goes quiet mid-cycle",
      severity: "critical",
      stat: `${m.ghostRate.count} of ${m.ghostRate.total} deals`,
      qualify: [
        "who to contact when the thread goes cold",
        "what normally causes the pause on their side",
        "whether an internal approval cycle explains it",
      ],
      reviewIds: m.ghostRate.reviewIds,
      strength: m.ghostRate.count / m.ghostRate.total,
      priority: 85,
      source: "mechanics",
    };
  },
  (m) => {
    if (!rateOver(m.slippageRate, 1 / 3)) return null;
    return {
      id: "close-slippage",
      label: "Close dates slip repeatedly",
      severity: "critical",
      stat: `${m.slippageRate.count} of ${m.slippageRate.total} deals pushed twice or more`,
      qualify: [
        "what has to be true for this to sign in the quarter",
        "which of those steps has slipped for them before",
        "whether budget is committed or still being approved",
      ],
      reviewIds: m.slippageRate.reviewIds,
      strength: m.slippageRate.count / m.slippageRate.total,
      priority: 82,
      source: "mechanics",
    };
  },
  (m) => {
    const s = m.verbalToSignature;
    if (!s || s.total < MIN_RULE_SAMPLE || (s.value !== "1-3 Months" && s.value !== "3+ Months")) {
      return null;
    }
    return {
      id: "verbal-drift",
      label: "Long gap between verbal yes and signature",
      severity: "caution",
      stat: `${s.value} typical, across ${s.total} reports`,
      qualify: [
        "the signature path after a verbal commit",
        "how many approvals sit in between",
        "who can escalate if it stalls",
      ],
      reviewIds: [],
      strength: s.count / s.total,
      priority: 70,
      source: "mechanics",
    };
  },
  (m) => {
    const s = m.stakeholderCount;
    if (!s || s.total < MIN_RULE_SAMPLE || (s.value !== "6-10" && s.value !== "10+")) return null;
    return {
      id: "stakeholder-sprawl",
      label: "Large buying committee",
      severity: "watch",
      stat: `${s.value} stakeholders typical, across ${s.total} reports`,
      qualify: [
        "who else needs to say yes that you have not met",
        "which of them can say no on their own",
      ],
      reviewIds: [],
      strength: s.count / s.total,
      priority: 65,
      source: "mechanics",
    };
  },
  (m) => {
    const s = m.paymentTerms;
    if (!s || s.total < MIN_RULE_SAMPLE || !["Net 60", "Net 90", "Net 120+"].includes(s.value)) {
      return null;
    }
    return {
      id: "payment-terms",
      label: `Standard terms are ${s.value}`,
      severity: "watch",
      stat: `${s.count} of ${s.total} reports`,
      qualify: ["what would justify an exception", "who approves it"],
      reviewIds: [],
      strength: s.count / s.total,
      priority: 50,
      source: "mechanics",
    };
  },
];

/** Deterministic flags from structured v2 fields. Unranked and uncapped - see mergeFlags. */
export function getStructuredFlags(m: DealMechanics): AccountFlag[] {
  return RULES.map((rule) => rule(m)).filter((f): f is AccountFlag => f !== null);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run services/accountFlags.test.ts`
Expected: PASS — 15 tests

- [ ] **Step 5: Commit**

```bash
git add services/accountFlags.ts services/accountFlags.test.ts
git commit -m "feat(flags): port the rule bank to flags with qualification points"
```

---

## Task 3: Merge and rank

**Files:**
- Modify: `services/accountFlags.ts`
- Test: `services/accountFlags.test.ts`

Structured flags and AI flags compete for the same slots. Structured flags win ties — they are deterministic and their numbers come from checkbox data rather than a model's reading.

- [ ] **Step 1: Write the failing test**

Append to `services/accountFlags.test.ts` (add `mergeFlags, rank` to the existing import):

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run services/accountFlags.test.ts`
Expected: FAIL — `mergeFlags is not exported`

- [ ] **Step 3: Write minimal implementation**

Append to `services/accountFlags.ts`:

```ts
const SEVERITY_WEIGHT: Record<FlagSeverity, number> = {
  critical: 200,
  caution: 100,
  watch: 0,
};

/** Severity band, then category weight, then up to 20 points for observed strength. */
export function rank(f: AccountFlag): number {
  return SEVERITY_WEIGHT[f.severity] + f.priority + f.strength * 20;
}

/** A flag with no number in its stat would apply to any account. Drop it. */
const hasNumber = (f: AccountFlag): boolean => /\d/.test(f.stat);

/**
 * Combine both sources into the rendered list. Structured flags win id
 * collisions - they are deterministic, and their numbers come from checkbox
 * fields rather than a model's reading of prose.
 */
export function mergeFlags(structured: AccountFlag[], ai: AccountFlag[]): AccountFlag[] {
  const seen = new Set(structured.map((f) => f.id));
  const usable = (f: AccountFlag) => hasNumber(f) && f.qualify.length > 0;

  return [...structured.filter(usable), ...ai.filter((f) => !seen.has(f.id) && usable(f))]
    .sort((a, b) => rank(b) - rank(a))
    .slice(0, MAX_FLAGS);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run services/accountFlags.test.ts`
Expected: PASS — 22 tests

- [ ] **Step 5: Commit**

```bash
git add services/accountFlags.ts services/accountFlags.test.ts
git commit -m "feat(flags): merge and rank structured and AI flags"
```

---

## Task 4: Server — corpus fingerprint and AI flag validation

**Files:**
- Create: `functions/src/accountFlags.ts`
- Test: `functions/src/accountFlags.test.ts`

Two pure functions first, testable without Firestore or Gemini.

**The fingerprint replaces the old `reviewCount` + 7-day TTL cache key.** Count alone misses an edited review, and the TTL regenerated on an unchanged corpus — producing differently-worded flags for no reason, which is exactly the inconsistency this design is meant to avoid. Fingerprint on content: regenerate when the corpus actually changes, never on a timer. `PROMPT_VERSION` covers the TTL's only legitimate use — forcing a refresh when the prompt improves.

- [ ] **Step 1: Write the failing test**

Create `functions/src/accountFlags.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { corpusFingerprint, validateAiFlags, MAX_AI_FLAGS } from "./accountFlags";

describe("corpusFingerprint", () => {
  const corpus = [
    { id: "r1", content: "slow legal" },
    { id: "r2", content: "champion left" },
  ];

  it("is stable for the same corpus", () => {
    expect(corpusFingerprint(corpus)).toBe(corpusFingerprint(corpus));
  });

  it("ignores review order", () => {
    expect(corpusFingerprint(corpus)).toBe(corpusFingerprint([corpus[1], corpus[0]]));
  });

  it("changes when a review is added", () => {
    expect(corpusFingerprint([...corpus, { id: "r3", content: "new" }])).not.toBe(
      corpusFingerprint(corpus),
    );
  });

  it("changes when a review is removed", () => {
    expect(corpusFingerprint([corpus[0]])).not.toBe(corpusFingerprint(corpus));
  });

  it("changes when a review is edited but the count stays the same", () => {
    expect(corpusFingerprint([corpus[0], { id: "r2", content: "champion stayed" }])).not.toBe(
      corpusFingerprint(corpus),
    );
  });
});

describe("validateAiFlags", () => {
  const known = ["r1", "r2", "r3"];

  const raw = (over: Record<string, unknown> = {}) => ({
    label: "Champion lacks budget authority",
    stat: "3 of 9 deals",
    qualify: ["who controls the budget line"],
    reviewIds: ["r1", "r2"],
    severity: "caution",
    ...over,
  });

  it("keeps a well-formed flag and marks it as coming from reports", () => {
    const out = validateAiFlags([raw()], known);
    expect(out).toHaveLength(1);
    expect(out[0].source).toBe("reports");
    expect(out[0].label).toBe("Champion lacks budget authority");
    expect(out[0].reviewIds).toEqual(["r1", "r2"]);
  });

  it("gives each flag a stable id derived from its label", () => {
    expect(validateAiFlags([raw()], known)[0].id).toBe(validateAiFlags([raw()], known)[0].id);
    expect(validateAiFlags([raw()], known)[0].id).toMatch(/^ai-[0-9a-f]{8}$/);
  });

  it("drops invented review ids but keeps the flag", () => {
    expect(validateAiFlags([raw({ reviewIds: ["r1", "r99"] })], known)[0].reviewIds).toEqual(["r1"]);
  });

  it("drops a flag when every citation is invented", () => {
    expect(validateAiFlags([raw({ reviewIds: ["r99"] })], known)).toEqual([]);
  });

  it("drops a flag citing fewer than two reviews", () => {
    expect(validateAiFlags([raw({ reviewIds: ["r1"] })], known)).toEqual([]);
  });

  it("drops a flag whose stat carries no number", () => {
    expect(validateAiFlags([raw({ stat: "several deals" })], known)).toEqual([]);
  });

  it("drops a flag with no qualification points", () => {
    expect(validateAiFlags([raw({ qualify: [] })], known)).toEqual([]);
  });

  it("coerces an unknown severity to caution rather than trusting it", () => {
    expect(validateAiFlags([raw({ severity: "apocalyptic" })], known)[0].severity).toBe("caution");
  });

  it("drops malformed entries without throwing", () => {
    const out = validateAiFlags(
      [null, {}, { label: "" }, raw(), "string"] as any,
      known,
    );
    expect(out).toHaveLength(1);
  });

  it("caps the number of AI flags", () => {
    const many = Array.from({ length: 10 }, (_, i) => raw({ label: `Flag ${i}` }));
    expect(validateAiFlags(many, known)).toHaveLength(MAX_AI_FLAGS);
  });

  it("returns nothing for a non-array", () => {
    expect(validateAiFlags("nope" as any, known)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd functions && npx vitest run src/accountFlags.test.ts`
Expected: FAIL — `Failed to resolve import "./accountFlags"`

- [ ] **Step 3: Write minimal implementation**

Create `functions/src/accountFlags.ts`:

```ts
import { createHash } from "node:crypto";

/** Mirrors services/accountFlags.ts. The two workspaces cannot import each other. */
export type FlagSeverity = "critical" | "caution" | "watch";

export interface AccountFlag {
  id: string;
  label: string;
  severity: FlagSeverity;
  stat: string;
  qualify: string[];
  reviewIds: string[];
  strength: number;
  priority: number;
  source: "mechanics" | "reports";
}

export interface CorpusEntry {
  id: string;
  content: string;
}

/** Bump to force regeneration when the prompt changes. Replaces a time-based TTL. */
export const PROMPT_VERSION = 1;

/** Free-text flags supplement the structured bank; they should not swamp it. */
export const MAX_AI_FLAGS = 4;

/** A free-text claim needs corroboration. One review is one person's account. */
const MIN_AI_CITATIONS = 2;

/** Everything a free-text flag gets, so the ranker treats it as mid-weight. */
const AI_PRIORITY = 72;

/**
 * Content-addressed cache key. Regenerate when the corpus actually changes -
 * a new review, a deleted review, or an EDITED review, which a plain count
 * misses entirely. Deliberately not time-based: re-running Gemini over an
 * unchanged corpus only reshuffles the wording, and a seller mid-cycle should
 * not find the flags reworded between visits.
 */
export function corpusFingerprint(corpus: CorpusEntry[]): string {
  const canonical = corpus
    .map((r) => `${r.id}:${createHash("sha1").update(r.content).digest("hex")}`)
    .sort()
    .join("|");
  return createHash("sha1").update(`v${PROMPT_VERSION}|${canonical}`).digest("hex");
}

const SEVERITIES: FlagSeverity[] = ["critical", "caution", "watch"];

/**
 * Strip anything the model invented or under-evidenced. A free-text flag
 * survives only with a label, a stat containing a number, at least one
 * qualification point, and at least two review IDs that exist in the corpus.
 *
 * Validating that an ID exists is not the same as validating that the review
 * says the thing - requiring two independent citations is what makes a single
 * planted review insufficient to manufacture a flag.
 */
export function validateAiFlags(raw: unknown, knownIds: string[]): AccountFlag[] {
  if (!Array.isArray(raw)) return [];
  const known = new Set(knownIds);
  const out: AccountFlag[] = [];

  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;

    const label = typeof e["label"] === "string" ? e["label"].trim() : "";
    const stat = typeof e["stat"] === "string" ? e["stat"].trim() : "";
    if (!label || !stat || !/\d/.test(stat)) continue;

    const qualify = Array.isArray(e["qualify"])
      ? e["qualify"].filter((q): q is string => typeof q === "string" && q.trim().length > 0).map((q) => q.trim())
      : [];
    if (qualify.length === 0) continue;

    const ids = Array.isArray(e["reviewIds"]) ? e["reviewIds"] : [];
    const valid = Array.from(
      new Set(ids.filter((id: unknown): id is string => typeof id === "string" && known.has(id))),
    );
    if (valid.length < MIN_AI_CITATIONS) continue;

    const severity = SEVERITIES.includes(e["severity"] as FlagSeverity)
      ? (e["severity"] as FlagSeverity)
      : "caution";

    out.push({
      id: `ai-${createHash("sha1").update(label.toLowerCase()).digest("hex").slice(0, 8)}`,
      label,
      severity,
      stat,
      qualify: qualify.slice(0, 3),
      reviewIds: valid,
      strength: valid.length / Math.max(knownIds.length, 1),
      priority: AI_PRIORITY,
      source: "reports",
    });
    if (out.length === MAX_AI_FLAGS) break;
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd functions && npx vitest run src/accountFlags.test.ts`
Expected: PASS — 17 tests

- [ ] **Step 5: Commit**

```bash
git add functions/src/accountFlags.ts functions/src/accountFlags.test.ts
git commit -m "feat(flags): fingerprint the corpus and validate AI flag citations"
```

---

## Task 5: Server — the getAccountFlags callable

**Files:**
- Modify: `functions/src/accountFlags.ts`
- Modify: `functions/src/index.ts`
- Modify: `.github/workflows/deploy-functions.yml`
- Delete: `functions/src/accountThemes.ts`, `functions/src/accountThemes.test.ts`

Port the security properties from `functions/src/accountThemes.ts` before deleting it: auth plus Pro gate, server-side corpus read, bracket sanitising, Firestore reads inside the try/catch, no caching of empty results. Read that file first.

- [ ] **Step 1: Append the callable**

Append to `functions/src/accountFlags.ts`:

```ts
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { GoogleGenAI, Type } from "@google/genai";
import { db } from "./lib/firebaseAdmin";
import { isProRole } from "./extension/gating";

const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");

/** Below this many reviews, a free-text pattern is one person's opinion. */
const MIN_FLAG_REVIEWS = 3;
/** Cap the corpus so one company cannot drive an unbounded prompt. */
export const MAX_CORPUS_REVIEWS = 60;
/** Cap each review so one long review cannot dominate the context. */
export const MAX_CONTENT_CHARS = 2000;

/** Legacy reviews predate moderation and count as approved. Mirrors reviewModeration.ts:219. */
export const isApproved = (d: FirebaseFirestore.DocumentData): boolean =>
  !d["moderationStatus"] || d["moderationStatus"] === "approved";

/**
 * Review text is user-submitted and gets interpolated next to `[id]` citation
 * markers. Square brackets are replaced so planted text cannot imitate a marker
 * and win a fabricated attribution - validateAiFlags checks that an ID exists,
 * not that the review actually says the thing.
 */
export const sanitise = (content: string): string =>
  content.slice(0, MAX_CONTENT_CHARS).replace(/\[/g, "(").replace(/\]/g, ")");

/**
 * Free-text flags for a company, cached on a corpus fingerprint.
 *
 * Trust model: the client sends only a companyId. The server reads the reviews
 * itself - a client-supplied corpus would let anyone poison the shared cache
 * for a real company with fabricated text and citations resolving to nothing.
 *
 * Region is inherited from setGlobalOptions in index.ts (australia-southeast1),
 * matching every other onCall in this codebase.
 */
export const getAccountFlags = onCall(
  { cors: true, secrets: [GEMINI_API_KEY] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Sign in to use Dealecho.");
    }
    if (!isProRole(request.auth.token.role as string | undefined)) {
      throw new HttpsError("permission-denied", "Sales Pro required.");
    }

    const companyId = request.data?.companyId;
    if (typeof companyId !== "string" || companyId.trim().length === 0 || companyId.length >= 200) {
      throw new HttpsError("invalid-argument", "companyId is required");
    }

    const cacheRef = db.doc(`account_flags/${companyId}`);

    // A Firestore outage must degrade to an empty flag list, not break the
    // page - the structured flags render without this.
    let corpus: CorpusEntry[];
    let cached: FirebaseFirestore.DocumentData | null = null;
    try {
      const [reviewsSnap, cacheSnap] = await Promise.all([
        db.collection("reviews").where("companyId", "==", companyId).get(),
        cacheRef.get(),
      ]);

      corpus = reviewsSnap.docs
        .map((doc) => ({ id: doc.id, data: doc.data() }))
        .filter(
          ({ data }) =>
            isApproved(data) && typeof data["content"] === "string" && data["content"].trim().length > 0,
        )
        .slice(0, MAX_CORPUS_REVIEWS)
        .map(({ id, data }) => ({ id, content: String(data["content"]).trim() }));

      cached = cacheSnap.exists ? (cacheSnap.data() ?? null) : null;
    } catch (error) {
      console.error("Failed to read reviews or cache for flag extraction:", error);
      return { flags: [] };
    }

    if (corpus.length < MIN_FLAG_REVIEWS) return { flags: [] };

    const knownIds = corpus.map((r) => r.id);
    const fingerprint = corpusFingerprint(corpus);

    // Content-addressed: an unchanged corpus always returns the same flags, so
    // a seller mid-cycle never finds them silently reworded.
    if (cached && cached["fingerprint"] === fingerprint) {
      return { flags: validateAiFlags(cached["flags"], knownIds) };
    }

    const apiKey = GEMINI_API_KEY.value();
    if (!apiKey || apiKey.includes("PLACEHOLDER")) {
      console.warn("No valid GEMINI_API_KEY - returning no flags.");
      return { flags: [] };
    }

    const ai = new GoogleGenAI({ apiKey });
    const body = corpus.map((r) => `[${r.id}] ${sanitise(r.content)}`).join("\n\n");

    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents:
          `Below are ${corpus.length} reviews written by B2B sellers about selling to this ` +
          `company. Each is prefixed with its ID in square brackets.\n\n` +
          `Identify up to ${MAX_AI_FLAGS} recurring risks a seller should know about, that are ` +
          `only visible in the written text - things like a champion leaving mid-cycle, the buyer ` +
          `hinting they could build it internally, a reorg stalling the deal, or a competitor ` +
          `already embedded. Do NOT report procurement mechanics such as security questionnaires, ` +
          `MSA redlines, pilots, payment terms or committee size - those are already covered ` +
          `elsewhere from structured data.\n\n` +
          `Each risk must appear in at least two reviews. For each one give:\n` +
          `- label: a short finding, at most eight words, about the buyer\n` +
          `- stat: how many reviews show it, written as "N of ${corpus.length} reports"\n` +
          `- severity: critical, caution or watch\n` +
          `- qualify: one to three short fragments a seller should nail down. Fragments, not ` +
          `questions, and not full sentences.\n` +
          `- reviewIds: the exact IDs supporting it. Use only IDs from the text below, never ` +
          `invent one.\n\n` +
          `Write in Australian English. Use plain hyphens, never em dashes. If the evidence is ` +
          `thin, return fewer risks.\n\nReviews:\n${body}`,
        config: {
          systemInstruction:
            "You extract evidence-backed risks from seller-submitted reviews. You never state a " +
            "claim you cannot cite to at least two reviews. You report what the reviews say, not advice.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              flags: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    label: { type: Type.STRING },
                    stat: { type: Type.STRING },
                    severity: { type: Type.STRING },
                    qualify: { type: Type.ARRAY, items: { type: Type.STRING } },
                    reviewIds: { type: Type.ARRAY, items: { type: Type.STRING } },
                  },
                  required: ["label", "stat", "severity", "qualify", "reviewIds"],
                },
              },
            },
            required: ["flags"],
          },
        },
      });

      const text = (response.text ?? "").replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(text || "{}");
      const flags = validateAiFlags(parsed.flags, knownIds);

      // Never cache an empty result - a transient model failure would otherwise
      // lock the panel empty until the corpus happens to change.
      if (flags.length > 0) {
        await cacheRef.set({ flags, fingerprint, generatedAt: Date.now() }, { merge: true });
      }
      return { flags };
    } catch (error) {
      console.error("Flag extraction failed:", error);
      return { flags: [] };
    }
  },
);
```

- [ ] **Step 2: Swap the export**

In `functions/src/index.ts`, replace:

```ts
export { getAccountThemes } from "./accountThemes";
```

with:

```ts
export { getAccountFlags } from "./accountFlags";
```

- [ ] **Step 3: Update the CI deploy allowlist**

**Critical:** CI deploys with explicit `--only functions:<name>` lists. A function missing from a list is never deployed, and the frontend call fails with what looks like a CORS error.

In `.github/workflows/deploy-functions.yml`, change `functions:getAccountThemes` to `functions:getAccountFlags` on the extension deploy line.

`getAccountThemes` was never deployed — the branch has not been pushed and CI runs only on `main` — so nothing is orphaned by the rename.

- [ ] **Step 4: Delete the themes function**

```bash
git rm functions/src/accountThemes.ts functions/src/accountThemes.test.ts
```

- [ ] **Step 5: Verify**

Run: `cd functions && npm run build`
Expected: exit 0

Run: `cd functions && npx vitest run`
Expected: PASS, with no reference to the deleted themes module

Run: `grep -rn "getAccountThemes" functions/ .github/`
Expected: no output

- [ ] **Step 6: Commit**

```bash
git add functions/src/accountFlags.ts functions/src/index.ts .github/workflows/deploy-functions.yml
git commit -m "feat(flags): replace getAccountThemes with the getAccountFlags callable"
```

---

## Task 6: Client wrapper for the AI flags

**Files:**
- Create: `services/aiFlags.ts`
- Delete: `services/accountThemes.ts`

- [ ] **Step 1: Write the client service**

Create `services/aiFlags.ts`:

```ts
import { getFunctions, httpsCallable } from "firebase/functions";
import { AccountFlag } from "./accountFlags";

/**
 * Free-text flags for a company. The server reads the corpus from Firestore
 * itself - we send only the company ID, never review content. Returns [] on
 * any failure; the structured flags carry the panel without this.
 */
export const getAiFlags = async (companyId: string): Promise<AccountFlag[]> => {
  try {
    const functions = getFunctions(undefined, "australia-southeast1");
    const fn = httpsCallable<{ companyId: string }, { flags: AccountFlag[] }>(
      functions,
      "getAccountFlags",
    );
    const result = await fn({ companyId });
    return result.data.flags ?? [];
  } catch (error) {
    console.error("Flag extraction failed:", error);
    return [];
  }
};
```

- [ ] **Step 2: Delete the themes client**

```bash
git rm services/accountThemes.ts
```

- [ ] **Step 3: Verify**

Run: `npm run type-check`
Expected: errors ONLY in `pages/CompanyProfile.tsx` and `src/components/intel/ThemeList.tsx`, which Task 8 removes. If anything else references the deleted module, fix that reference.

- [ ] **Step 4: Commit**

```bash
git add services/aiFlags.ts
git commit -m "feat(flags): add the AI flag client service"
```

---

## Task 7: Rewrite FlagCard and FlagList

**Files:**
- Modify: `src/components/intel/FlagCard.tsx`, `src/components/intel/FlagCard.test.tsx`
- Modify: `src/components/intel/FlagList.tsx`, `src/components/intel/FlagList.test.tsx`
- Delete: `src/components/intel/QuestionList.tsx` + test, `src/components/intel/ThemeList.tsx` + test

`FlagList` owns tick persistence, ported from `QuestionList.tsx` — read it first. Keys are `pointId(flagId, point)` rather than positional, so a tick survives regeneration.

- [ ] **Step 1: Write the failing test**

Replace `src/components/intel/FlagCard.test.tsx` entirely:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import FlagCard from "./FlagCard";
import { AccountFlag, pointId } from "../../../services/accountFlags";

const flag: AccountFlag = {
  id: "security-review",
  label: "Security review is a gate",
  severity: "caution",
  stat: "7 of 9 deals",
  qualify: ["which review tier applies", "who signs it off"],
  reviewIds: ["a", "b", "c"],
  strength: 7 / 9,
  priority: 90,
  source: "mechanics",
};

describe("FlagCard", () => {
  it("shows the finding, the stat and the report count", () => {
    render(<FlagCard flag={flag} checked={[]} onToggle={() => {}} showDetail />);
    expect(screen.getByText("Security review is a gate")).toBeInTheDocument();
    expect(screen.getByText("7 of 9 deals")).toBeInTheDocument();
    expect(screen.getByText("3 reports")).toBeInTheDocument();
  });

  it("lists each qualification point as a checkbox", () => {
    render(<FlagCard flag={flag} checked={[]} onToggle={() => {}} showDetail />);
    expect(screen.getAllByRole("checkbox")).toHaveLength(2);
    expect(screen.getByText("which review tier applies")).toBeInTheDocument();
  });

  it("reports the point id when a point is ticked", () => {
    const onToggle = vi.fn();
    render(<FlagCard flag={flag} checked={[]} onToggle={onToggle} showDetail />);
    fireEvent.click(screen.getAllByRole("checkbox")[0]);
    expect(onToggle).toHaveBeenCalledWith(pointId("security-review", "which review tier applies"));
  });

  it("reflects an already ticked point", () => {
    render(
      <FlagCard
        flag={flag}
        checked={[pointId("security-review", "who signs it off")]}
        onToggle={() => {}}
        showDetail
      />,
    );
    expect(screen.getAllByRole("checkbox")[1]).toBeChecked();
  });

  it("marks a free-text flag as coming from written reports", () => {
    render(
      <FlagCard flag={{ ...flag, source: "reports" }} checked={[]} onToggle={() => {}} showDetail />,
    );
    expect(screen.getByText("From written reports")).toBeInTheDocument();
  });

  it("does not mark a structured flag", () => {
    render(<FlagCard flag={flag} checked={[]} onToggle={() => {}} showDetail />);
    expect(screen.queryByText("From written reports")).not.toBeInTheDocument();
  });

  it("hides the stat and qualification points for non-Pro users", () => {
    render(<FlagCard flag={flag} checked={[]} onToggle={() => {}} showDetail={false} />);
    expect(screen.getByText("Security review is a gate")).toBeInTheDocument();
    expect(screen.queryByText("7 of 9 deals")).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });
});
```

Replace `src/components/intel/FlagList.test.tsx` entirely:

```tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import FlagList from "./FlagList";
import { AccountFlag } from "../../../services/accountFlags";

const flags: AccountFlag[] = [
  {
    id: "ghosting", label: "Buyer goes quiet mid-cycle", severity: "critical",
    stat: "4 of 9 deals", qualify: ["who to contact when the thread goes cold"],
    reviewIds: ["a"], strength: 4 / 9, priority: 85, source: "mechanics",
  },
  {
    id: "security-review", label: "Security review is a gate", severity: "caution",
    stat: "7 of 9 deals", qualify: ["which review tier applies"],
    reviewIds: ["b"], strength: 7 / 9, priority: 90, source: "mechanics",
  },
];

const renderList = (props: Partial<React.ComponentProps<typeof FlagList>> = {}) =>
  render(
    <MemoryRouter>
      <FlagList companyId="c1" flags={flags} isPro {...props} />
    </MemoryRouter>,
  );

describe("FlagList", () => {
  beforeEach(() => localStorage.clear());

  it("renders every flag", () => {
    renderList();
    expect(screen.getByText("Buyer goes quiet mid-cycle")).toBeInTheDocument();
    expect(screen.getByText("Security review is a gate")).toBeInTheDocument();
  });

  it("shows a progress count across all qualification points", () => {
    renderList();
    expect(screen.getByText("0 of 2 qualified")).toBeInTheDocument();
  });

  it("persists a ticked point and updates progress", () => {
    renderList();
    fireEvent.click(screen.getAllByRole("checkbox")[0]);
    expect(screen.getByText("1 of 2 qualified")).toBeInTheDocument();
    expect(localStorage.getItem("dealecho_qq:c1")).toContain("ghosting:");
  });

  it("restores ticks from localStorage on mount", () => {
    localStorage.setItem("dealecho_qq:c1", JSON.stringify(["ghosting:00000000"]));
    renderList();
    expect(screen.getByText("0 of 2 qualified")).toBeInTheDocument();
  });

  it("reloads ticks when companyId changes without remounting", () => {
    const { rerender } = renderList();
    fireEvent.click(screen.getAllByRole("checkbox")[0]);
    expect(screen.getByText("1 of 2 qualified")).toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <FlagList companyId="c2" flags={flags} isPro />
      </MemoryRouter>,
    );
    expect(screen.getByText("0 of 2 qualified")).toBeInTheDocument();
  });

  it("shows the upsell and no progress count for non-Pro users", () => {
    renderList({ isPro: false });
    expect(screen.getByText(/Unlock 2 flags with Sales Pro/)).toBeInTheDocument();
    expect(screen.queryByText(/qualified/)).not.toBeInTheDocument();
  });

  it("says so when there are no flags", () => {
    renderList({ flags: [] });
    expect(screen.getByText(/No red flags detected/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/intel/FlagCard.test.tsx src/components/intel/FlagList.test.tsx`
Expected: FAIL — the components still expect the old `Flag` type from `accountSignal`

- [ ] **Step 3: Rewrite FlagCard**

Replace `src/components/intel/FlagCard.tsx` entirely:

```tsx
import React from "react";
import { AccountFlag, pointId } from "../../../services/accountFlags";

const ACCENT: Record<AccountFlag["severity"], string> = {
  critical: "border-l-signal-risk",
  caution: "border-l-signal-caution",
  watch: "border-l-slate-300",
};

const TEXT: Record<AccountFlag["severity"], string> = {
  critical: "text-signal-risk",
  caution: "text-signal-caution",
  watch: "text-slate-500",
};

interface Props {
  flag: AccountFlag;
  /** Point ids already ticked for this company. */
  checked: string[];
  onToggle: (id: string) => void;
  /** Pro users see the stat and the qualification points. */
  showDetail: boolean;
}

const FlagCard: React.FC<Props> = ({ flag, checked, onToggle, showDetail }) => (
  <div className={`bg-white border border-slate-200 border-l-[3px] ${ACCENT[flag.severity]} p-4`}>
    <div className="flex items-baseline justify-between gap-3">
      <span className={`text-sm font-semibold ${TEXT[flag.severity]}`}>{flag.label}</span>
      {showDetail && (
        <span className="shrink-0 text-2xs font-semibold text-slate-500 tabular-nums">
          {flag.stat}
        </span>
      )}
    </div>

    {showDetail ? (
      <>
        <div className="mt-1 flex flex-wrap gap-2 text-2xs text-slate-400">
          <span>
            {flag.reviewIds.length} report{flag.reviewIds.length !== 1 ? "s" : ""}
          </span>
          {flag.source === "reports" && <span>From written reports</span>}
        </div>
        <ul className="mt-2 space-y-1">
          {flag.qualify.map((point) => {
            const id = pointId(flag.id, point);
            return (
              <li key={id} className="flex gap-2">
                <input
                  type="checkbox"
                  id={id}
                  checked={checked.includes(id)}
                  onChange={() => onToggle(id)}
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-accent"
                />
                <label
                  htmlFor={id}
                  className={`text-2xs ${checked.includes(id) ? "text-slate-400 line-through" : "text-slate-600"}`}
                >
                  {point}
                </label>
              </li>
            );
          })}
        </ul>
      </>
    ) : (
      <p className="text-2xs text-slate-300 italic mt-1 select-none" aria-hidden="true">
        ░░░░░░░ ░░░░░ ░░░░░░░░░ ░░░░ ░░░░░░░
      </p>
    )}
  </div>
);

export default FlagCard;
```

- [ ] **Step 4: Rewrite FlagList**

Replace `src/components/intel/FlagList.tsx` entirely:

```tsx
import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AccountFlag, pointId } from "../../../services/accountFlags";
import FlagCard from "./FlagCard";

const storageKey = (companyId: string) => `dealecho_qq:${companyId}`;

const loadChecked = (companyId: string): string[] => {
  try {
    const raw = localStorage.getItem(storageKey(companyId));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
};

const saveChecked = (companyId: string, ids: string[]): void => {
  try {
    localStorage.setItem(storageKey(companyId), JSON.stringify(ids));
  } catch {
    // Fail silently if storage is blocked or full - the list still works in-session.
  }
};

interface Props {
  companyId: string;
  flags: AccountFlag[];
  isPro: boolean;
}

const FlagList: React.FC<Props> = ({ companyId, flags, isPro }) => {
  const [checked, setChecked] = useState<string[]>(() => loadChecked(companyId));

  // The route updates :companyId without remounting the profile page, so the
  // ticked set has to follow the prop or one account's answers leak onto another.
  useEffect(() => {
    setChecked(loadChecked(companyId));
  }, [companyId]);

  const toggle = useCallback(
    (id: string) => {
      const next = checked.includes(id) ? checked.filter((x) => x !== id) : [...checked, id];
      setChecked(next);
      saveChecked(companyId, next);
    },
    [checked, companyId],
  );

  if (flags.length === 0) {
    return <p className="text-sm text-slate-400">No red flags detected across recent reports.</p>;
  }

  const points = flags.flatMap((f) => f.qualify.map((p) => pointId(f.id, p)));
  const done = points.filter((p) => checked.includes(p)).length;

  return (
    <div className="space-y-2">
      {isPro && (
        <p className="text-2xs text-slate-400 text-right" aria-live="polite">
          {done} of {points.length} qualified
        </p>
      )}
      {flags.map((f) => (
        <FlagCard key={f.id} flag={f} checked={checked} onToggle={toggle} showDetail={isPro} />
      ))}
      {!isPro && (
        <Link
          to="/pricing"
          className="block text-center bg-navy text-white rounded-control px-4 py-3 text-2xs font-semibold uppercase tracking-widest hover:bg-navy-800 transition-colors"
        >
          Unlock {flags.length} flags with Sales Pro
        </Link>
      )}
    </div>
  );
};

export default FlagList;
```

- [ ] **Step 5: Delete the superseded panels**

```bash
git rm src/components/intel/QuestionList.tsx src/components/intel/QuestionList.test.tsx \
       src/components/intel/ThemeList.tsx src/components/intel/ThemeList.test.tsx
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run src/components/intel/FlagCard.test.tsx src/components/intel/FlagList.test.tsx`
Expected: PASS — 15 tests

- [ ] **Step 7: Commit**

```bash
git add src/components/intel/FlagCard.tsx src/components/intel/FlagCard.test.tsx \
        src/components/intel/FlagList.tsx src/components/intel/FlagList.test.tsx
git commit -m "feat(flags): render flags with qualification points and ticks"
```

---

## Task 8: Strip flags out of accountSignal

**Files:**
- Modify: `services/accountSignal.ts`, `services/accountSignal.test.ts`

`getAccountSignal` keeps the jobs it does well — `headline`, `sentiment` and `trend` feed `VerdictCard` and `TrendStrip`. Its keyword flag rules are replaced by the structured bank and go away.

- [ ] **Step 1: Update the test**

In `services/accountSignal.test.ts`, delete the two tests that assert on flags (`"raises a ghosting flag for very low responsiveness"` and `"sorts critical flags before caution flags"`). Keep the sentiment and trend tests. Add:

```ts
  it("no longer produces flags - the flag engine lives in services/accountFlags.ts", () => {
    // @ts-expect-error flags was removed from AccountSignal
    expect(base.flags).toBeUndefined();
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run services/accountSignal.test.ts`
Expected: FAIL — `flags` still exists on the returned signal

- [ ] **Step 3: Remove the flag machinery**

In `services/accountSignal.ts`, delete: the `FlagType` type, the `Flag` interface, `CRITICAL_TYPES`, the `FlagRule` interface, the `RULES` array, and the `buildFlags` function. Remove `flags` from the `AccountSignal` interface and from the object returned by `getAccountSignal`.

Keep `MetricTrend`, `healthIndex`, `buildTrend`, `quarter`, `headlineFor` and `getAccountSignal` itself.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run services/accountSignal.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add services/accountSignal.ts services/accountSignal.test.ts
git commit -m "refactor(signal): remove the keyword flag rules superseded by accountFlags"
```

---

## Task 9: Wire the profile to two panels

**Files:**
- Modify: `pages/CompanyProfile.tsx`, `pages/CompanyProfile.test.tsx`
- Delete: `services/qualificationQuestions.ts` + test

- [ ] **Step 1: Update the imports**

In `pages/CompanyProfile.tsx`, remove:

```tsx
import QuestionList from "../src/components/intel/QuestionList";
import ThemeList from "../src/components/intel/ThemeList";
import { getQualificationQuestions } from "../services/qualificationQuestions";
import { getAccountThemes, AccountTheme } from "../services/accountThemes";
```

and add:

```tsx
import { getStructuredFlags, mergeFlags, AccountFlag } from "../services/accountFlags";
import { getAiFlags } from "../services/aiFlags";
```

- [ ] **Step 2: Replace the state and derivations**

Replace the `themes` state declaration with:

```tsx
  const [aiFlags, setAiFlags] = useState<AccountFlag[]>([]);
```

Replace the `questions` useMemo with:

```tsx
  const flags = useMemo(
    () => mergeFlags(mechanics ? getStructuredFlags(mechanics) : [], aiFlags),
    [mechanics, aiFlags],
  );
```

Replace the themes effect with:

```tsx
  // The only AI call. Keyed on the company and its review count, NOT on the
  // filter state - free-text flags are a property of the account, and the
  // server caches them on a corpus fingerprint so an unchanged corpus always
  // returns the same flags.
  useEffect(() => {
    if (isPaid && company && companyReviews.length > 0) {
      getAiFlags(company.id).then(setAiFlags);
    } else {
      setAiFlags([]);
    }
  }, [isPaid, company?.id, companyReviews.length]);
```

- [ ] **Step 3: Replace the render blocks**

Replace the existing flags section with:

```tsx
      <section aria-labelledby="flags-heading" className="space-y-2">
        <h2 id="flags-heading" className="text-sm font-semibold text-slate-500">
          Flags to qualify
        </h2>
        <FlagList companyId={company.id} flags={flags} isPro={isPro} />
      </section>
```

Replace the three-panel Pro block with:

```tsx
      {isPro ? (
        mechanics && <DealMechanicsPanel mechanics={mechanics} />
      ) : (
        <Link to="/pricing" className="block bg-navy text-white rounded-card p-6 text-center">
          <span className="text-sm font-semibold">
            Unlock deal mechanics, flags to qualify, and full review evidence with Sales Pro
          </span>
        </Link>
      )}
```

- [ ] **Step 4: Update the page test**

In `pages/CompanyProfile.test.tsx`, change the mock of `../services/accountThemes` to mock `../services/aiFlags` with `getAiFlags: () => Promise.resolve([])`. Change the assertions in the `"CompanyProfile deal mechanics brief"` describe block: replace the `/Ask this account/` heading assertion with `/Flags to qualify/`, and replace the security question text assertion with the flag label `"Security review is a gate"` and the stat `"2 of 3 deals"`.

- [ ] **Step 5: Delete the questions engine**

```bash
git rm services/qualificationQuestions.ts services/qualificationQuestions.test.ts
```

- [ ] **Step 6: Verify**

Run: `grep -rn "QuestionList\|ThemeList\|qualificationQuestions\|accountThemes" pages/ src/ services/`
Expected: no output

Run: `npm test`
Expected: PASS

Run: `npm run type-check`
Expected: exit 0

- [ ] **Step 7: Commit**

```bash
git add pages/CompanyProfile.tsx pages/CompanyProfile.test.tsx
git commit -m "feat(profile): collapse four intel panels into flags to qualify"
```

---

## Task 10: Update the positioning copy

**Files:**
- Modify: `pages/Pricing.tsx`

The pricing page currently sells "Account-specific qualification questions" and "Recurring themes cited to verified reports". Both panels are gone. Locate the `proFeatures` array and replace those two entries with:

```tsx
    "Flags to qualify - what to nail down, with the evidence",
```

That is one entry replacing two, so the array shrinks by one.

- [ ] **Step 1: Apply the change and verify**

Run: `grep -rn "qualification questions\|Recurring themes" pages/`
Expected: no output

Run: `npm test`
Expected: PASS

- [ ] **Step 2: Commit**

```bash
git add pages/Pricing.tsx
git commit -m "copy: sell flags to qualify rather than questions and themes"
```

---

## Task 11: Verify in the running app

**Files:** none — verification.

Note: local Firebase has no credentials in the development sandbox, so reviews fail to load with `permission-denied` and a company profile cannot be reached. If that is still true, say so plainly rather than claiming the panels were verified.

- [ ] **Step 1: Start the preview**

Use `preview_start` with `{name: "dev"}`.

- [ ] **Step 2: Check for regressions**

Use `read_console_messages` with `onlyErrors: true`. Firebase permission and analytics errors are pre-existing environment noise. Any error naming `accountFlags`, `FlagList` or `FlagCard` is not.

- [ ] **Step 3: Confirm the pricing copy**

Navigate to `/pricing` and use `get_page_text` to confirm the feature list reads correctly.

- [ ] **Step 4: If credentials are available, check a real profile**

Open a company with 3+ reviews as a Pro user. Confirm flags render with stats and qualification points, tick a point, reload, and confirm the tick persisted.

- [ ] **Step 5: Screenshot and stop the server**

---

## Deferred

- **Evidence deep-links.** `reviewIds` are carried on every flag but the UI only shows a count. Linking a flag to the specific reviews in the evidence list below is the obvious next step.
- **Server-side tick persistence.** `localStorage` is enough to learn whether anyone ticks them. Add Firestore only if the engagement data justifies it.
- **Copy flags to clipboard as markdown** for CRM notes.
- **`PROMPT_VERSION` bumping.** Nothing automates this; remember to increment it in `functions/src/accountFlags.ts` when the prompt changes materially, or cached flags will never regenerate for unchanged corpora.
