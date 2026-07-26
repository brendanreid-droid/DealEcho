# Deal Mechanics Brief Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the AI MEDDPICC playbook on the company profile with a three-layer Deal Mechanics Brief: deterministic buying-behaviour stats (A), AI theme extraction with review citations (B), and account-specific qualification questions derived from those stats (C).

**Architecture:** Layer A is a pure client-side aggregation over schema v2 review fields — no AI, no network, fully deterministic and unit-testable. Layer C is a rule bank whose triggers read Layer A output, so every rendered question carries a real number from real reviews; a question with an empty data slot never renders. Layer B is the only AI call: a server-side Cloud Function that extracts themes from review free text, validates every returned review ID against the input set, and caches per `companyId + reviewCount` in Firestore.

**Tech Stack:** React 19 + TypeScript + Vite + Tailwind, Vitest for tests, Firebase Cloud Functions v2 (Node 22) with `@google/genai` (Gemini 2.5 Flash), Firestore for the theme cache.

---

## ⚠️ As-built corrections — read before re-running any task

This plan was executed on 2026-07-26. Review rounds found defects in the plan itself. **Do not re-run Tasks 9, 11 or 12 from the text below without applying these**, and prefer the committed code as the source of truth.

**Layer B took review text from the client, which was a cache-poisoning hole (Critical).** Tasks 9, 11 and 12 as written have the client POST `{ companyId, reviews: [{id, content}] }`, and the result is cached under `account_themes/{companyId}` shared by every viewer. The endpoint had no auth check, so anyone could submit a fabricated corpus for a real company and every genuine visitor would be served attacker-authored themes citing reviews that do not exist — for the full 7-day TTL. As built:
- the callable accepts `{ companyId }` only and reads approved reviews from Firestore itself
- it requires `request.auth` and `isProRole(...)`, matching `extension/lookupCompanyReviews.ts`
- review text is sanitised before entering the prompt, because content containing a literal `[r7] ...` mimics the citation marker and wins a fabricated attribution that `validateThemes` cannot catch — verifying an ID exists is not verifying the review says the thing
- the Firestore read is inside the try/catch, and empty results are never cached
- the client service takes one argument: `getAccountThemes(companyId)`

**Layer C rules could fire on a sample of one.** Per-field denominators are independent of review count, so a 9-review account could render "1 of 1 reported deals". As built, `MIN_RULE_SAMPLE = 2` floors the rate and modal rules, and ranking blends observed frequency via `rank()` rather than using fixed category priority alone.

**Task 9's `region` option was dropped** — `functions/src/index.ts` sets it globally via `setGlobalOptions` and no other `onCall` sets it per-function.

**Test and build commands in this plan are wrong.** The root vitest config excludes `functions/**`, so `npx vitest run functions/src/*.test.ts` from the root silently runs the wrong files. Use `cd functions && npx vitest run src/<file>.test.ts` and `cd functions && npm run build`. `npm run build -w functions` fails outright — the root `package.json` has no `workspaces` field, despite CLAUDE.md documenting it.

**Task 12's claim that `pages/CompanyProfile.test.tsx` passes untouched is wrong** — it mocked `services/geminiService` and asserted on Playbook content.

**Task 14's repo-wide MEDDPICC grep over-reaches.** Three mentions are intentional and remain: seed review text in `mockReviews.ts`, the protected extension feature's test double in `personaCache.test.ts`, and the design-rationale comment in `services/qualificationQuestions.ts`. The correct check is `grep -rni "meddpic\|meddic" pages/ src/`.

---

## Background For The Implementer

**What exists today (being replaced):**

- `functions/src/searchCompanies.ts:42` — `getAICompanyPersona` callable. Sends 4 review fields to Gemini, gets back a MEDDPICC blueprint. Every one of the 12 schema v2 fields is ignored.
- `services/geminiService.ts:92` — `getAICompanyPersona` client wrapper with `sessionStorage` caching.
- `src/components/intel/Playbook.tsx` — renders the 8 MEDDPICC pillars.
- `pages/CompanyProfile.tsx:193-218` — effect that calls the persona on every filter change.

**What exists and stays:**

- `services/accountSignal.ts` — `getAccountSignal` produces `flags` (rendered by `FlagList`) and `trend` (rendered by `TrendStrip`). This plan does **not** rewrite the flag rules. Layer C triggers read Layer A stats (structured v2 fields), which is a stronger signal than the keyword rules, so the flag layer is left alone.
- `functions/src/extension/lookupCompanyReviews.ts:108` — the browser extension has its own, much simpler persona (a 2-3 sentence plain-text summary, cached in Firestore via `getOrCreatePersona`). **Out of scope. Do not touch it.**

**Key domain facts you need:**

1. Schema v2 fields on `Review` (`types.ts:41-54`) are all **optional**. Legacy v1 reviews do not have them. Every aggregate must compute its own denominator from the reviews that actually have a known value for that field — never assume `reviews.length`.
2. Several v2 enums include a literal `"Unknown"` member (`VERBAL_TO_SIGNATURE`, `CLOSE_SLIPPAGE`, `PROCUREMENT_ENTRY`) and `PAYMENT_TERMS` includes `"Unknown / N/A"`. These must be excluded from modal calculations — an account whose most common answer is "Unknown" has no signal, not a finding.
3. `communicationRating`, `negotiationLevel`, `timeWasterLevel`, `clarityOfScope` are all **high-is-good** despite the misleading names. See the comment at `types.ts:31-33`. Do not invert them.
4. Legacy bracket values are normalized at read time by `normalizeTcvBracket` / `normalizeDurationBracket` in `src/utils/reviewSchema.ts`. Use those, never raw string comparison.
5. Minimum sample size is **3**. Below that, Layer A and Layer C render nothing — one review is one person's bad week, not a pattern.

**Test commands:**

- Frontend: `npm test` (vitest run) from repo root. Single file: `npx vitest run services/dealMechanics.test.ts`
- Functions: `npm run build -w functions`
- Types: `npm run type-check`

---

## File Structure

**Layer A — deterministic aggregation**
- Create `services/dealMechanics.ts` — types + `getDealMechanics(reviews)`. Pure, synchronous, no imports from React or Firebase.
- Create `services/dealMechanics.test.ts`
- Create `src/components/intel/DealMechanics.tsx` — renders the Layer A panel
- Create `src/components/intel/DealMechanics.test.tsx`

**Layer C — qualification questions**
- Create `services/qualificationQuestions.ts` — types + rule bank + `getQualificationQuestions(mechanics, reviews)`
- Create `services/qualificationQuestions.test.ts`
- Create `src/components/intel/QuestionList.tsx` — renders questions with per-user checked state
- Create `src/components/intel/QuestionList.test.tsx`

**Layer B — AI themes**
- Create `functions/src/accountThemes.ts` — `getAccountThemes` callable with Firestore cache + citation validation
- Create `functions/src/accountThemes.test.ts`
- Create `services/accountThemes.ts` — client wrapper
- Create `src/components/intel/ThemeList.tsx`
- Create `src/components/intel/ThemeList.test.tsx`
- Modify `functions/src/index.ts` — export the new callable
- Modify `.github/workflows/deploy-functions.yml` — add the new function to a `--only` list

**Wiring + removal**
- Modify `pages/CompanyProfile.tsx` — swap `Playbook` for the three new panels
- Delete `src/components/intel/Playbook.tsx`, `src/components/intel/Playbook.test.tsx`
- Modify `services/geminiService.ts` — remove `getAICompanyPersona`, `CompanyPersona`, `TeamPlaybook`
- Modify `functions/src/searchCompanies.ts` — remove the `getAICompanyPersona` callable
- Modify `pages/Pricing.tsx`, `pages/Home.tsx` — replace MEDDPICC copy

---

## Task 1: Layer A — types and shared helpers

**Files:**
- Create: `services/dealMechanics.ts`
- Test: `services/dealMechanics.test.ts`

- [ ] **Step 1: Write the failing test**

Create `services/dealMechanics.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run services/dealMechanics.test.ts`
Expected: FAIL — `Failed to resolve import "./dealMechanics"`

- [ ] **Step 3: Write minimal implementation**

Create `services/dealMechanics.ts`:

```ts
import { Review } from "../types";
import { DURATION_BRACKETS, FRICTION_EVENTS } from "../src/constants/dealData";
import { normalizeDurationBracket } from "../src/utils/reviewSchema";

/**
 * Deterministic aggregation of schema v2 review fields into "how this buyer
 * actually buys". No AI, no network — the same reviews always produce the same
 * brief, and every number is traceable to review IDs.
 *
 * Schema v2 fields are optional (legacy v1 reviews lack them), so every stat
 * carries its OWN denominator. Never divide by reviews.length.
 */

/** Below this many reviews a pattern is one person's bad week, not a finding. */
export const MIN_MECHANICS_REVIEWS = 3;

/** Most common known value for a field, with the count of reviews that answered it. */
export interface ModalStat {
  value: string;
  count: number;
  total: number;
}

/** "N of M reviews matched", with the matching review IDs for citation. */
export interface RateStat {
  count: number;
  total: number;
  reviewIds: string[];
}

/**
 * Most common non-sentinel value of `pick`. `sentinels` are enum members that
 * mean "no answer" (e.g. "Unknown") — they are excluded from both the winner
 * and the denominator. Returns null when nobody answered.
 */
export function modalOf(
  reviews: Review[],
  pick: (r: Review) => string | undefined,
  sentinels: string[] = [],
): ModalStat | null {
  const values = reviews
    .map(pick)
    .filter((v): v is string => typeof v === "string" && v.length > 0 && !sentinels.includes(v));
  if (values.length === 0) return null;

  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);

  let best = values[0];
  for (const [value, count] of counts) {
    if (count > (counts.get(best) ?? 0)) best = value;
  }
  return { value: best, count: counts.get(best) ?? 0, total: values.length };
}

/**
 * How many reviews satisfy `match`, out of those that answered at all
 * (`answered`). Collects matching review IDs so the UI can cite them.
 */
export function rateOf(
  reviews: Review[],
  match: (r: Review) => boolean,
  answered: (r: Review) => boolean,
): RateStat {
  const pool = reviews.filter(answered);
  const hits = pool.filter(match);
  return { count: hits.length, total: pool.length, reviewIds: hits.map((r) => r.id) };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run services/dealMechanics.test.ts`
Expected: PASS — 5 tests

- [ ] **Step 5: Commit**

```bash
git add services/dealMechanics.ts services/dealMechanics.test.ts
git commit -m "feat(mechanics): add modal and rate aggregation helpers"
```

---

## Task 2: Layer A — friction ranking and median cycle

**Files:**
- Modify: `services/dealMechanics.ts`
- Test: `services/dealMechanics.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `services/dealMechanics.test.ts` (add `frictionRanking, medianCycle` to the existing import from `./dealMechanics`):

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run services/dealMechanics.test.ts`
Expected: FAIL — `frictionRanking is not exported` / `medianCycle is not exported`

- [ ] **Step 3: Write minimal implementation**

Append to `services/dealMechanics.ts`:

```ts
/** One procurement-gauntlet event, with how often this account triggered it. */
export interface FrictionStat {
  event: string;
  count: number;
  total: number;
  reviewIds: string[];
}

/**
 * Friction events ranked most-common first. Denominator is the number of
 * reviews that answered the friction question at all (`frictionEvents` present,
 * empty array included — that is a real "no friction observed" answer).
 * Events nobody reported are omitted entirely.
 */
export function frictionRanking(reviews: Review[]): FrictionStat[] {
  const answered = reviews.filter((r) => Array.isArray(r.frictionEvents));
  const total = answered.length;
  if (total === 0) return [];

  return FRICTION_EVENTS.map((event) => {
    const hits = answered.filter((r) => r.frictionEvents!.includes(event));
    return { event, count: hits.length, total, reviewIds: hits.map((r) => r.id) };
  })
    .filter((s) => s.count > 0)
    .sort((a, b) => b.count - a.count);
}

/**
 * Median cycle length as a bracket label. Ranks by position in
 * DURATION_BRACKETS (chronological), not by string sort. Legacy "12+ Months"
 * is normalized down to "12-18 Months" so aggregates never overstate.
 */
export function medianCycle(reviews: Review[]): string | null {
  const ranks = reviews
    .map((r) => normalizeDurationBracket(r.cycleDuration))
    .filter((b): b is NonNullable<typeof b> => b !== null)
    .map((b) => (DURATION_BRACKETS as readonly string[]).indexOf(b))
    .sort((a, b) => a - b);
  if (ranks.length === 0) return null;
  return DURATION_BRACKETS[ranks[Math.floor((ranks.length - 1) / 2)]];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run services/dealMechanics.test.ts`
Expected: PASS — 11 tests

- [ ] **Step 5: Commit**

```bash
git add services/dealMechanics.ts services/dealMechanics.test.ts
git commit -m "feat(mechanics): rank friction events and compute median cycle"
```

---

## Task 3: Layer A — assemble getDealMechanics

**Files:**
- Modify: `services/dealMechanics.ts`
- Test: `services/dealMechanics.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `services/dealMechanics.test.ts` (add `getDealMechanics, MIN_MECHANICS_REVIEWS` to the existing import):

```ts
describe("getDealMechanics", () => {
  it("returns null below the minimum sample size", () => {
    const few = Array.from({ length: MIN_MECHANICS_REVIEWS - 1 }, (_, i) => r({ id: `x${i}` }));
    expect(getDealMechanics(few)).toBeNull();
  });

  it("assembles every stat from a mixed v1/v2 review set", () => {
    const m = getDealMechanics([
      r({
        id: "a", status: "Lost", cycleDuration: "6-12 Months",
        frictionEvents: ["Security questionnaire", "Legal redlines on MSA"],
        procurementEntry: "Early (before shortlist)", paymentTerms: "Net 60",
        verbalToSignature: "1-3 Months", closeSlippage: "Pushed 3+ times",
        stakeholderCount: "6-10", wentDark: true,
      }),
      r({
        id: "b", status: "Won", cycleDuration: "6-12 Months",
        frictionEvents: ["Security questionnaire"],
        procurementEntry: "Early (before shortlist)", paymentTerms: "Net 60",
        verbalToSignature: "1-4 Weeks", closeSlippage: "Never pushed",
        stakeholderCount: "6-10", wentDark: false,
      }),
      r({ id: "c", status: "Lost", cycleDuration: "3-6 Months" }), // legacy v1
    ]);

    expect(m).not.toBeNull();
    expect(m!.sampleSize).toBe(3);
    expect(m!.medianCycle).toBe("6-12 Months");
    expect(m!.friction[0].event).toBe("Security questionnaire");
    expect(m!.friction[0].count).toBe(2);
    expect(m!.friction[0].total).toBe(2); // review c never answered
    expect(m!.procurementEntry).toEqual({ value: "Early (before shortlist)", count: 2, total: 2 });
    expect(m!.paymentTerms).toEqual({ value: "Net 60", count: 2, total: 2 });
    expect(m!.stakeholderCount).toEqual({ value: "6-10", count: 2, total: 2 });
    expect(m!.ghostRate).toEqual({ count: 1, total: 2, reviewIds: ["a"] });
    expect(m!.slippageRate).toEqual({ count: 1, total: 2, reviewIds: ["a"] });
    expect(m!.outcomeMix).toContainEqual({ outcome: "Lost", count: 2 });
    expect(m!.outcomeMix).toContainEqual({ outcome: "Won", count: 1 });
  });

  it("treats only 'pushed twice or more' as slippage", () => {
    const m = getDealMechanics([
      r({ id: "a", closeSlippage: "Pushed once" }),
      r({ id: "b", closeSlippage: "Pushed twice" }),
      r({ id: "c", closeSlippage: "Never pushed" }),
    ]);
    expect(m!.slippageRate).toEqual({ count: 1, total: 3, reviewIds: ["b"] });
  });

  it("leaves modal stats null when every answer is an unknown sentinel", () => {
    const m = getDealMechanics([
      r({ id: "a", procurementEntry: "Unknown" }),
      r({ id: "b", procurementEntry: "Unknown" }),
      r({ id: "c", procurementEntry: "Unknown" }),
    ]);
    expect(m!.procurementEntry).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run services/dealMechanics.test.ts`
Expected: FAIL — `getDealMechanics is not exported`

- [ ] **Step 3: Write minimal implementation**

Append to `services/dealMechanics.ts`:

```ts
/** How this buyer actually buys, derived entirely from structured v2 fields. */
export interface DealMechanics {
  sampleSize: number;
  friction: FrictionStat[];
  procurementEntry: ModalStat | null;
  verbalToSignature: ModalStat | null;
  paymentTerms: ModalStat | null;
  stakeholderCount: ModalStat | null;
  /** Buyer went silent >2 weeks mid-cycle. */
  ghostRate: RateStat;
  /** Close date pushed twice or more. "Pushed once" is normal, not a finding. */
  slippageRate: RateStat;
  medianCycle: string | null;
  outcomeMix: { outcome: string; count: number }[];
}

const SLIPPED = ["Pushed twice", "Pushed 3+ times"];

export function getDealMechanics(reviews: Review[]): DealMechanics | null {
  if (reviews.length < MIN_MECHANICS_REVIEWS) return null;

  const outcomeCounts = new Map<string, number>();
  for (const r of reviews) outcomeCounts.set(r.status, (outcomeCounts.get(r.status) ?? 0) + 1);

  return {
    sampleSize: reviews.length,
    friction: frictionRanking(reviews),
    procurementEntry: modalOf(reviews, (r) => r.procurementEntry, ["Unknown"]),
    verbalToSignature: modalOf(reviews, (r) => r.verbalToSignature, ["Unknown"]),
    paymentTerms: modalOf(reviews, (r) => r.paymentTerms, ["Unknown / N/A"]),
    stakeholderCount: modalOf(reviews, (r) => r.stakeholderCount, []),
    ghostRate: rateOf(
      reviews,
      (r) => r.wentDark === true,
      (r) => r.wentDark !== undefined,
    ),
    slippageRate: rateOf(
      reviews,
      (r) => SLIPPED.includes(r.closeSlippage ?? ""),
      (r) => typeof r.closeSlippage === "string" && r.closeSlippage !== "Unknown",
    ),
    medianCycle: medianCycle(reviews),
    outcomeMix: Array.from(outcomeCounts, ([outcome, count]) => ({ outcome, count })).sort(
      (a, b) => b.count - a.count,
    ),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run services/dealMechanics.test.ts`
Expected: PASS — 15 tests

- [ ] **Step 5: Commit**

```bash
git add services/dealMechanics.ts services/dealMechanics.test.ts
git commit -m "feat(mechanics): assemble deal mechanics brief from v2 fields"
```

---

## Task 4: Layer A — DealMechanics panel

**Files:**
- Create: `src/components/intel/DealMechanics.tsx`
- Test: `src/components/intel/DealMechanics.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/intel/DealMechanics.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import DealMechanicsPanel from "./DealMechanics";
import { DealMechanics } from "../../../services/dealMechanics";

const mechanics: DealMechanics = {
  sampleSize: 9,
  friction: [
    { event: "Security questionnaire", count: 7, total: 9, reviewIds: ["a"] },
    { event: "Legal redlines on MSA", count: 6, total: 9, reviewIds: ["b"] },
  ],
  procurementEntry: { value: "Early (before shortlist)", count: 6, total: 8 },
  verbalToSignature: { value: "1-3 Months", count: 5, total: 8 },
  paymentTerms: { value: "Net 60", count: 5, total: 7 },
  stakeholderCount: { value: "6-10", count: 4, total: 8 },
  ghostRate: { count: 3, total: 9, reviewIds: ["a", "b", "c"] },
  slippageRate: { count: 4, total: 9, reviewIds: ["a"] },
  medianCycle: "6-12 Months",
  outcomeMix: [{ outcome: "Lost", count: 5 }, { outcome: "Won", count: 4 }],
};

describe("DealMechanicsPanel", () => {
  it("shows the friction gauntlet with counts out of the answering sample", () => {
    render(<DealMechanicsPanel mechanics={mechanics} />);
    expect(screen.getByText("Security questionnaire")).toBeInTheDocument();
    expect(screen.getByText("7 of 9")).toBeInTheDocument();
  });

  it("shows the modal stats", () => {
    render(<DealMechanicsPanel mechanics={mechanics} />);
    expect(screen.getByText("Early (before shortlist)")).toBeInTheDocument();
    expect(screen.getByText("Net 60")).toBeInTheDocument();
    expect(screen.getByText("6-12 Months")).toBeInTheDocument();
  });

  it("renders rates as percentages of the answering sample", () => {
    render(<DealMechanicsPanel mechanics={mechanics} />);
    expect(screen.getByText("33% of deals")).toBeInTheDocument(); // ghost 3/9
    expect(screen.getByText("44% of deals")).toBeInTheDocument(); // slippage 4/9
  });

  it("omits a stat entirely when there is no data for it", () => {
    render(<DealMechanicsPanel mechanics={{ ...mechanics, paymentTerms: null }} />);
    expect(screen.queryByText("Payment terms")).not.toBeInTheDocument();
  });

  it("omits the friction section when no friction was reported", () => {
    render(<DealMechanicsPanel mechanics={{ ...mechanics, friction: [] }} />);
    expect(screen.queryByText("Procurement gauntlet")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/intel/DealMechanics.test.tsx`
Expected: FAIL — `Failed to resolve import "./DealMechanics"`

- [ ] **Step 3: Write minimal implementation**

Create `src/components/intel/DealMechanics.tsx`:

```tsx
import React from "react";
import { BarChart3 } from "lucide-react";
import { DealMechanics, ModalStat, RateStat } from "../../../services/dealMechanics";

const pct = (s: RateStat): string => (s.total === 0 ? "0%" : `${Math.round((s.count / s.total) * 100)}%`);

const Stat: React.FC<{ label: string; value: string; note?: string }> = ({ label, value, note }) => (
  <div>
    <dt className="text-2xs font-semibold text-slate-400 uppercase tracking-wider">{label}</dt>
    <dd className="text-sm font-semibold text-slate-900">{value}</dd>
    {note && <dd className="text-2xs text-slate-500">{note}</dd>}
  </div>
);

const DealMechanicsPanel: React.FC<{ mechanics: DealMechanics }> = ({ mechanics }) => {
  const m = mechanics;
  const modal = (label: string, s: ModalStat | null) =>
    s ? <Stat key={label} label={label} value={s.value} note={`${s.count} of ${s.total} reports`} /> : null;

  return (
    <section
      aria-labelledby="mechanics-heading"
      className="bg-white border border-slate-200 rounded-card p-4 space-y-4"
    >
      <h2 id="mechanics-heading" className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        <BarChart3 size={15} className="text-accent" aria-hidden="true" />
        How this buyer buys
        <span className="ml-auto text-2xs font-normal text-slate-400">
          {m.sampleSize} report{m.sampleSize !== 1 ? "s" : ""}
        </span>
      </h2>

      <dl className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {m.medianCycle && <Stat label="Typical cycle" value={m.medianCycle} />}
        {modal("Procurement enters", m.procurementEntry)}
        {modal("Verbal to signature", m.verbalToSignature)}
        {modal("Payment terms", m.paymentTerms)}
        {modal("Stakeholders", m.stakeholderCount)}
        {m.ghostRate.total > 0 && (
          <Stat
            label="Went dark"
            value={`${pct(m.ghostRate)} of deals`}
            note={`${m.ghostRate.count} of ${m.ghostRate.total} reports`}
          />
        )}
        {m.slippageRate.total > 0 && (
          <Stat
            label="Close date pushed 2x+"
            value={`${pct(m.slippageRate)} of deals`}
            note={`${m.slippageRate.count} of ${m.slippageRate.total} reports`}
          />
        )}
      </dl>

      {m.friction.length > 0 && (
        <div className="border-t border-slate-100 pt-3">
          <h3 className="text-2xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Procurement gauntlet
          </h3>
          <ul className="space-y-1">
            {m.friction.map((f) => (
              <li key={f.event} className="flex items-center justify-between text-sm">
                <span className="text-slate-700">{f.event}</span>
                <span className="text-2xs font-semibold text-slate-500 tabular-nums">
                  {f.count} of {f.total}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
};

export default DealMechanicsPanel;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/intel/DealMechanics.test.tsx`
Expected: PASS — 5 tests

- [ ] **Step 5: Commit**

```bash
git add src/components/intel/DealMechanics.tsx src/components/intel/DealMechanics.test.tsx
git commit -m "feat(mechanics): render the how-this-buyer-buys panel"
```

---

## Task 5: Layer C — question types and rule engine

**Files:**
- Create: `services/qualificationQuestions.ts`
- Test: `services/qualificationQuestions.test.ts`

The engine is a list of rules. Each rule declares a trigger over `DealMechanics` and builds a question. **A rule that cannot fill its number slot must not fire** — that is the guardrail against generic MEDDPICC-style filler.

- [ ] **Step 1: Write the failing test**

Create `services/qualificationQuestions.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run services/qualificationQuestions.test.ts`
Expected: FAIL — `Failed to resolve import "./qualificationQuestions"`

- [ ] **Step 3: Write minimal implementation**

Create `services/qualificationQuestions.ts` (rule bank added in Task 6 — this task ships the engine plus the two rules the tests above need first; Task 6 completes the bank):

```ts
import { DealMechanics, FrictionStat } from "./dealMechanics";

/**
 * Account-specific discovery questions derived from Layer A stats.
 *
 * Design rule: a question only renders if its data slot is filled. Every `why`
 * string must contain a real number from real reviews — a question that would
 * apply to any account is worthless, which is exactly how the old MEDDPICC
 * blueprint failed.
 */

export type Stage = "Discovery" | "Evaluation" | "Negotiation" | "Close";

export interface QualificationQuestion {
  id: string;
  question: string;
  /** Department to put the question to. Values come from DEPARTMENTS. */
  askOf: string;
  stage: Stage;
  /** Rationale containing the account-specific number. */
  why: string;
  /** Reviews backing the rationale, for citation in the UI. */
  reviewIds: string[];
  /** Higher sorts first. */
  priority: number;
}

/** Sellers scan, they do not read. More than this and the list is ignored. */
export const MAX_QUESTIONS = 6;

interface Rule {
  id: string;
  build: (m: DealMechanics) => QualificationQuestion | null;
}

/** Find a friction event that hit at least `min` reports. */
export function friction(m: DealMechanics, event: string, min: number): FrictionStat | null {
  const f = m.friction.find((x) => x.event === event);
  return f && f.count >= min ? f : null;
}

/** True when a rate cleared `threshold` (0-1) on a non-empty sample. */
export function rateOver(s: { count: number; total: number }, threshold: number): boolean {
  return s.total > 0 && s.count / s.total > threshold;
}

export const RULES: Rule[] = [
  {
    id: "security-review",
    build: (m) => {
      const f = friction(m, "Security questionnaire", 2);
      if (!f) return null;
      return {
        id: "security-review",
        question:
          "Which security review tier applies at our contract size, and can it run in parallel with the commercial evaluation rather than after it?",
        askOf: "Security / InfoSec",
        stage: "Discovery",
        why: `${f.count} of ${f.total} sellers hit a security questionnaire at this account.`,
        reviewIds: f.reviewIds,
        priority: 90,
      };
    },
  },
  {
    id: "reverse-auction",
    build: (m) => {
      const f = friction(m, "Reverse auction / e-procurement", 1);
      if (!f) return null;
      return {
        id: "reverse-auction",
        question:
          "Will this go to a reverse auction or e-procurement event, and what are the qualification criteria to be exempted from it?",
        askOf: "Procurement",
        stage: "Evaluation",
        why: `${f.count} of ${f.total} sellers were pulled into a reverse auction or e-procurement event.`,
        reviewIds: f.reviewIds,
        priority: 100,
      };
    },
  },
  {
    id: "ghosting",
    build: (m) => {
      if (!rateOver(m.ghostRate, 1 / 3)) return null;
      return {
        id: "ghosting",
        question:
          "If we do not hear from you for two weeks, who should we contact and what usually causes the pause on your side?",
        askOf: "Procurement",
        stage: "Evaluation",
        why: `The buyer went silent mid-cycle in ${m.ghostRate.count} of ${m.ghostRate.total} reported deals.`,
        reviewIds: m.ghostRate.reviewIds,
        priority: 85,
      };
    },
  },
];

export function getQualificationQuestions(m: DealMechanics): QualificationQuestion[] {
  return RULES.map((rule) => rule.build(m))
    .filter((q): q is QualificationQuestion => q !== null)
    .sort((a, b) => b.priority - a.priority)
    .slice(0, MAX_QUESTIONS);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run services/qualificationQuestions.test.ts`
Expected: PASS — 6 tests

- [ ] **Step 5: Commit**

```bash
git add services/qualificationQuestions.ts services/qualificationQuestions.test.ts
git commit -m "feat(questions): add qualification question rule engine"
```

---

## Task 6: Layer C — complete the rule bank

**Files:**
- Modify: `services/qualificationQuestions.ts`
- Test: `services/qualificationQuestions.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `services/qualificationQuestions.test.ts` (reuse the `empty` fixture already defined at the top of the file):

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run services/qualificationQuestions.test.ts`
Expected: FAIL — 10 new failures, all `Cannot read properties of undefined (reading 'askOf')` or `expected undefined to be defined`

- [ ] **Step 3: Write minimal implementation**

In `services/qualificationQuestions.ts`, replace the closing `];` of the `RULES` array by appending these nine rules before it (keep the three existing rules in place):

```ts
  {
    id: "legal-redlines",
    build: (m) => {
      const f = friction(m, "Legal redlines on MSA", 2);
      if (!f) return null;
      return {
        id: "legal-redlines",
        question:
          "Can we see your standard MSA and the clauses you will not move on before we invest in a proposal?",
        askOf: "Legal / Compliance",
        stage: "Evaluation",
        why: `${f.count} of ${f.total} sellers went through MSA redlines here.`,
        reviewIds: f.reviewIds,
        priority: 80,
      };
    },
  },
  {
    id: "soc2-evidence",
    build: (m) => {
      const f = friction(m, "SOC 2 / pen test required", 2);
      if (!f) return null;
      return {
        id: "soc2-evidence",
        question:
          "Does our current SOC 2 report satisfy your requirement, or do you require an independent pen test against our environment?",
        askOf: "Security / InfoSec",
        stage: "Discovery",
        why: `${f.count} of ${f.total} sellers were asked for SOC 2 or pen test evidence.`,
        reviewIds: f.reviewIds,
        priority: 75,
      };
    },
  },
  {
    id: "poc-exit-criteria",
    build: (m) => {
      const f = friction(m, "Pilot / POC required", 2);
      if (!f) return null;
      return {
        id: "poc-exit-criteria",
        question:
          "What are the written success criteria for the pilot, who signs off that they were met, and does a pass commit budget?",
        askOf: "IT / Engineering",
        stage: "Evaluation",
        why: `${f.count} of ${f.total} sellers were required to run a pilot or POC.`,
        reviewIds: f.reviewIds,
        priority: 78,
      };
    },
  },
  {
    id: "reference-calls",
    build: (m) => {
      const f = friction(m, "Reference calls required", 2);
      if (!f) return null;
      return {
        id: "reference-calls",
        question:
          "How many customer references do you need, in which industries, and at what point do they become a gate?",
        askOf: "Procurement",
        stage: "Evaluation",
        why: `${f.count} of ${f.total} sellers had to supply reference calls.`,
        reviewIds: f.reviewIds,
        priority: 55,
      };
    },
  },
  {
    id: "vendor-portal",
    build: (m) => {
      const f = friction(m, "Vendor onboarding portal", 2);
      if (!f) return null;
      return {
        id: "vendor-portal",
        question:
          "Which vendor onboarding portal do we need to register in, how long does approval take, and can we start it now rather than at PO stage?",
        askOf: "Procurement",
        stage: "Close",
        why: `${f.count} of ${f.total} sellers had to clear a vendor onboarding portal.`,
        reviewIds: f.reviewIds,
        priority: 60,
      };
    },
  },
  {
    id: "procurement-early",
    build: (m) => {
      const s = m.procurementEntry;
      if (!s || s.value !== "Early (before shortlist)") return null;
      return {
        id: "procurement-early",
        question:
          "Procurement is already involved — who owns the commercial evaluation, and what do they need from us to keep us on the shortlist?",
        askOf: "Procurement",
        stage: "Discovery",
        why: `Procurement engaged before shortlist in ${s.count} of ${s.total} reported deals.`,
        reviewIds: [],
        priority: 88,
      };
    },
  },
  {
    id: "close-slippage",
    build: (m) => {
      if (!rateOver(m.slippageRate, 1 / 3)) return null;
      return {
        id: "close-slippage",
        question:
          "What has to be true on your side for this to sign in the quarter, and which of those steps has slipped for you before?",
        askOf: "Executive Leadership (C-Suite)",
        stage: "Negotiation",
        why: `The close date was pushed twice or more in ${m.slippageRate.count} of ${m.slippageRate.total} reported deals.`,
        reviewIds: m.slippageRate.reviewIds,
        priority: 82,
      };
    },
  },
  {
    id: "verbal-drift",
    build: (m) => {
      const s = m.verbalToSignature;
      if (!s || (s.value !== "1-3 Months" && s.value !== "3+ Months")) return null;
      return {
        id: "verbal-drift",
        question:
          "Once we have a verbal yes, what is the signature path and how many approvals sit between the verbal and the signed contract?",
        askOf: "Finance / Treasury",
        stage: "Negotiation",
        why: `Verbal to signature typically took ${s.value} here (${s.count} of ${s.total} reports).`,
        reviewIds: [],
        priority: 70,
      };
    },
  },
  {
    id: "payment-terms",
    build: (m) => {
      const s = m.paymentTerms;
      if (!s || !["Net 60", "Net 90", "Net 120+"].includes(s.value)) return null;
      return {
        id: "payment-terms",
        question:
          `Your standard terms appear to be ${s.value} — what would justify an exception, and who approves it?`,
        askOf: "Finance / Treasury",
        stage: "Negotiation",
        why: `${s.count} of ${s.total} sellers reported ${s.value} payment terms.`,
        reviewIds: [],
        priority: 50,
      };
    },
  },
  {
    id: "stakeholder-sprawl",
    build: (m) => {
      const s = m.stakeholderCount;
      if (!s || (s.value !== "6-10" && s.value !== "10+")) return null;
      return {
        id: "stakeholder-sprawl",
        question:
          "Who else needs to say yes that we have not met yet, and which of them can say no on their own?",
        askOf: "Executive Leadership (C-Suite)",
        stage: "Discovery",
        why: `Buying committees here typically run ${s.value} people (${s.count} of ${s.total} reports).`,
        reviewIds: [],
        priority: 65,
      };
    },
  },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run services/qualificationQuestions.test.ts`
Expected: PASS — 17 tests, including the cap test from Task 5

- [ ] **Step 5: Commit**

```bash
git add services/qualificationQuestions.ts services/qualificationQuestions.test.ts
git commit -m "feat(questions): complete the qualification rule bank"
```

---

## Task 7: Layer C — QuestionList with checkable state

**Files:**
- Create: `src/components/intel/QuestionList.tsx`
- Test: `src/components/intel/QuestionList.test.tsx`

Checked state lives in `localStorage` only. No Firestore writes, no rules change — YAGNI until the feature proves itself.

- [ ] **Step 1: Write the failing test**

Create `src/components/intel/QuestionList.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import QuestionList from "./QuestionList";
import { QualificationQuestion } from "../../../services/qualificationQuestions";

const questions: QualificationQuestion[] = [
  {
    id: "security-review",
    question: "Which security review tier applies at our contract size?",
    askOf: "Security / InfoSec",
    stage: "Discovery",
    why: "7 of 9 sellers hit a security questionnaire at this account.",
    reviewIds: ["a", "b"],
    priority: 90,
  },
  {
    id: "ghosting",
    question: "If we do not hear from you for two weeks, who should we contact?",
    askOf: "Procurement",
    stage: "Evaluation",
    why: "The buyer went silent mid-cycle in 4 of 9 reported deals.",
    reviewIds: ["c"],
    priority: 85,
  },
];

describe("QuestionList", () => {
  beforeEach(() => localStorage.clear());

  it("renders each question with who to ask, when, and why", () => {
    render(<QuestionList companyId="c1" questions={questions} />);
    expect(screen.getByText(/Which security review tier/)).toBeInTheDocument();
    expect(screen.getByText("Security / InfoSec")).toBeInTheDocument();
    expect(screen.getByText("Discovery")).toBeInTheDocument();
    expect(screen.getByText(/7 of 9 sellers/)).toBeInTheDocument();
  });

  it("shows a progress count that starts at zero", () => {
    render(<QuestionList companyId="c1" questions={questions} />);
    expect(screen.getByText("0 of 2 answered")).toBeInTheDocument();
  });

  it("persists a checked question to localStorage and updates progress", () => {
    render(<QuestionList companyId="c1" questions={questions} />);
    fireEvent.click(screen.getAllByRole("checkbox")[0]);
    expect(screen.getByText("1 of 2 answered")).toBeInTheDocument();
    expect(localStorage.getItem("dealecho_qq:c1")).toContain("security-review");
  });

  it("restores checked state from localStorage on mount", () => {
    localStorage.setItem("dealecho_qq:c1", JSON.stringify(["ghosting"]));
    render(<QuestionList companyId="c1" questions={questions} />);
    expect(screen.getByText("1 of 2 answered")).toBeInTheDocument();
    expect(screen.getAllByRole("checkbox")[1]).toBeChecked();
  });

  it("keeps state separate per company", () => {
    localStorage.setItem("dealecho_qq:other", JSON.stringify(["ghosting"]));
    render(<QuestionList companyId="c1" questions={questions} />);
    expect(screen.getByText("0 of 2 answered")).toBeInTheDocument();
  });

  it("renders nothing when there are no questions", () => {
    const { container } = render(<QuestionList companyId="c1" questions={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/intel/QuestionList.test.tsx`
Expected: FAIL — `Failed to resolve import "./QuestionList"`

- [ ] **Step 3: Write minimal implementation**

Create `src/components/intel/QuestionList.tsx`:

```tsx
import React, { useCallback, useState } from "react";
import { HelpCircle } from "lucide-react";
import { QualificationQuestion } from "../../../services/qualificationQuestions";

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
    // Fail silently if storage is blocked or full — the list still works in-session.
  }
};

interface Props {
  companyId: string;
  questions: QualificationQuestion[];
}

const QuestionList: React.FC<Props> = ({ companyId, questions }) => {
  const [checked, setChecked] = useState<string[]>(() => loadChecked(companyId));

  const toggle = useCallback(
    (id: string) => {
      setChecked((prev) => {
        const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
        saveChecked(companyId, next);
        return next;
      });
    },
    [companyId],
  );

  if (questions.length === 0) return null;

  const answered = questions.filter((q) => checked.includes(q.id)).length;

  return (
    <section
      aria-labelledby="questions-heading"
      className="bg-white border border-slate-200 rounded-card p-4 space-y-3"
    >
      <h2 id="questions-heading" className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        <HelpCircle size={15} className="text-accent" aria-hidden="true" />
        Ask this account
        <span className="ml-auto text-2xs font-normal text-slate-400">
          {answered} of {questions.length} answered
        </span>
      </h2>

      <ul className="space-y-3">
        {questions.map((q) => (
          <li key={q.id} className="flex gap-3">
            <input
              type="checkbox"
              id={`qq-${q.id}`}
              checked={checked.includes(q.id)}
              onChange={() => toggle(q.id)}
              className="mt-1 h-4 w-4 shrink-0 accent-accent"
            />
            <div className="min-w-0">
              <label
                htmlFor={`qq-${q.id}`}
                className={`block text-sm ${checked.includes(q.id) ? "text-slate-400 line-through" : "text-slate-900"}`}
              >
                {q.question}
              </label>
              <div className="mt-1 flex flex-wrap gap-2 text-2xs">
                <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-control">{q.askOf}</span>
                <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-control">{q.stage}</span>
              </div>
              <p className="mt-1 text-2xs text-slate-500">{q.why}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
};

export default QuestionList;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/intel/QuestionList.test.tsx`
Expected: PASS — 6 tests

- [ ] **Step 5: Commit**

```bash
git add src/components/intel/QuestionList.tsx src/components/intel/QuestionList.test.tsx
git commit -m "feat(questions): render checkable qualification question list"
```

---

## Task 8: Layer B — citation validation (pure function first)

**Files:**
- Create: `functions/src/accountThemes.ts`
- Test: `functions/src/accountThemes.test.ts`

The AI can and will invent review IDs. Validate before returning, always. Write the validator as a pure exported function so it is testable without hitting Gemini.

- [ ] **Step 1: Write the failing test**

Create `functions/src/accountThemes.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { validateThemes } from "./accountThemes";

describe("validateThemes", () => {
  const known = ["r1", "r2", "r3"];

  it("keeps themes whose citations all exist", () => {
    const out = validateThemes(
      [{ theme: "Champion had no budget authority", reviewIds: ["r1", "r2"] }],
      known,
    );
    expect(out).toEqual([{ theme: "Champion had no budget authority", reviewIds: ["r1", "r2"] }]);
  });

  it("drops hallucinated review ids but keeps the theme", () => {
    const out = validateThemes(
      [{ theme: "Legal moved slowly", reviewIds: ["r1", "r99"] }],
      known,
    );
    expect(out).toEqual([{ theme: "Legal moved slowly", reviewIds: ["r1"] }]);
  });

  it("drops a theme entirely when every citation is invented", () => {
    expect(validateThemes([{ theme: "Invented", reviewIds: ["r99"] }], known)).toEqual([]);
  });

  it("drops a theme with no citations at all", () => {
    expect(validateThemes([{ theme: "Uncited", reviewIds: [] }], known)).toEqual([]);
  });

  it("drops malformed entries without throwing", () => {
    const out = validateThemes(
      [
        null,
        { theme: "", reviewIds: ["r1"] },
        { theme: "Valid", reviewIds: ["r1"] },
        { reviewIds: ["r1"] },
        { theme: "No array", reviewIds: "r1" },
      ] as any,
      known,
    );
    expect(out).toEqual([{ theme: "Valid", reviewIds: ["r1"] }]);
  });

  it("caps the number of themes returned", () => {
    const many = Array.from({ length: 10 }, (_, i) => ({ theme: `T${i}`, reviewIds: ["r1"] }));
    expect(validateThemes(many, known)).toHaveLength(5);
  });

  it("deduplicates repeated review ids within a theme", () => {
    const out = validateThemes([{ theme: "Dupes", reviewIds: ["r1", "r1", "r2"] }], known);
    expect(out[0].reviewIds).toEqual(["r1", "r2"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run functions/src/accountThemes.test.ts`
Expected: FAIL — `Failed to resolve import "./accountThemes"`

- [ ] **Step 3: Write minimal implementation**

Create `functions/src/accountThemes.ts`:

```ts
/** One recurring theme across review free text, with the reviews that support it. */
export interface AccountTheme {
  theme: string;
  reviewIds: string[];
}

/** Sellers scan. More than this and the themes stop being read. */
export const MAX_THEMES = 5;

/**
 * Strip anything the model invented. A theme survives only if it has a
 * non-empty label and at least one review ID that actually exists in the input
 * corpus. This is the difference between "3 sellers reported X [R2, R5, R7]"
 * and an unfalsifiable claim.
 */
export function validateThemes(raw: unknown, knownIds: string[]): AccountTheme[] {
  if (!Array.isArray(raw)) return [];
  const known = new Set(knownIds);
  const out: AccountTheme[] = [];

  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const theme = (entry as any).theme;
    const ids = (entry as any).reviewIds;
    if (typeof theme !== "string" || theme.trim().length === 0) continue;
    if (!Array.isArray(ids)) continue;

    const valid = Array.from(new Set(ids.filter((id: unknown) => typeof id === "string" && known.has(id))));
    if (valid.length === 0) continue;

    out.push({ theme: theme.trim(), reviewIds: valid });
    if (out.length === MAX_THEMES) break;
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run functions/src/accountThemes.test.ts`
Expected: PASS — 7 tests

- [ ] **Step 5: Commit**

```bash
git add functions/src/accountThemes.ts functions/src/accountThemes.test.ts
git commit -m "feat(themes): validate AI theme citations against real review ids"
```

---

## Task 9: Layer B — getAccountThemes callable

**Files:**
- Modify: `functions/src/accountThemes.ts`
- Modify: `functions/src/index.ts:32`

Cache key is `companyId + reviewCount`, matching the existing extension pattern in `functions/src/extension/personaCache.ts`. Cached in Firestore at `account_themes/{companyId}` — written by the admin SDK, so no `firestore.rules` change is needed.

- [ ] **Step 1: Append the callable**

Append to `functions/src/accountThemes.ts`:

```ts
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { GoogleGenAI, Type } from "@google/genai";
import { db } from "./lib/firebaseAdmin";

const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");

/** Themes go stale slowly; the reviewCount check catches real change sooner. */
const THEMES_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Below this many reviews, themes are one person's opinion, not a pattern. */
const MIN_THEME_REVIEWS = 3;

interface ThemeInput {
  id: string;
  content: string;
}

export const getAccountThemes = onCall(
  { cors: true, secrets: [GEMINI_API_KEY], region: "australia-southeast1" },
  async (request) => {
    const { companyId, reviews } = request.data ?? {};
    if (!companyId || typeof companyId !== "string") {
      throw new HttpsError("invalid-argument", "companyId is required");
    }
    if (!Array.isArray(reviews)) {
      throw new HttpsError("invalid-argument", "reviews array is required");
    }

    const corpus: ThemeInput[] = reviews
      .filter((r: any) => r && typeof r.id === "string" && typeof r.content === "string" && r.content.trim())
      .map((r: any) => ({ id: r.id, content: String(r.content).trim() }));

    if (corpus.length < MIN_THEME_REVIEWS) return { themes: [] };

    const cacheRef = db.doc(`account_themes/${companyId}`);
    const snap = await cacheRef.get();
    const cached = snap.exists ? (snap.data() as any) : null;
    if (
      cached &&
      cached.reviewCount === corpus.length &&
      Date.now() - (cached.generatedAt ?? 0) < THEMES_TTL_MS
    ) {
      return { themes: cached.themes ?? [] };
    }

    const apiKey = GEMINI_API_KEY.value();
    if (!apiKey || apiKey.includes("PLACEHOLDER")) {
      console.warn("No valid GEMINI_API_KEY — returning no themes.");
      return { themes: [] };
    }

    const ai = new GoogleGenAI({ apiKey });
    const body = corpus.map((r) => `[${r.id}] ${r.content}`).join("\n\n");

    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents:
          `Below are ${corpus.length} reviews written by B2B sellers about their experience ` +
          `selling to this company. Each review is prefixed with its ID in square brackets.\n\n` +
          `Identify up to ${MAX_THEMES} recurring themes in the buyer's behaviour. A theme must ` +
          `appear in at least two reviews. For each theme, cite the exact review IDs that support ` +
          `it — use only IDs that appear in the text below, never invent one. Write each theme as ` +
          `a single factual sentence about the buyer, in Australian English. Do not give advice.\n\n` +
          `Reviews:\n${body}`,
        config: {
          systemInstruction:
            "You extract recurring, evidence-backed themes from seller-submitted reviews. " +
            "You never state a claim you cannot cite. If the evidence is thin, return fewer themes.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              themes: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    theme: { type: Type.STRING, description: "One factual sentence about the buyer." },
                    reviewIds: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                      description: "IDs of the reviews supporting this theme.",
                    },
                  },
                  required: ["theme", "reviewIds"],
                },
              },
            },
            required: ["themes"],
          },
        },
      });

      const text = (response.text ?? "").replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(text || "{}");
      const themes = validateThemes(parsed.themes, corpus.map((r) => r.id));

      await cacheRef.set(
        { themes, generatedAt: Date.now(), reviewCount: corpus.length },
        { merge: true },
      );
      return { themes };
    } catch (error: any) {
      console.error("Theme extraction failed:", error);
      // Degrade gracefully — Layers A and C still render without this.
      return { themes: [] };
    }
  },
);
```

- [ ] **Step 2: Export the callable**

In `functions/src/index.ts`, add below the existing line 32 export:

```ts
export { getAccountThemes } from "./accountThemes";
```

- [ ] **Step 3: Verify the functions workspace compiles**

Run: `npm run build -w functions`
Expected: exit 0, no TypeScript errors

- [ ] **Step 4: Confirm the firebaseAdmin export name matches**

Run: `grep -n "export" functions/src/lib/firebaseAdmin.ts`
Expected: a line exporting `db`. If the export is named differently, fix the import in `accountThemes.ts` to match — do not add a new export.

- [ ] **Step 5: Re-run the unit tests to confirm nothing regressed**

Run: `npx vitest run functions/src/accountThemes.test.ts`
Expected: PASS — 7 tests

- [ ] **Step 6: Commit**

```bash
git add functions/src/accountThemes.ts functions/src/index.ts
git commit -m "feat(themes): add cached getAccountThemes callable"
```

---

## Task 10: Layer B — add the new function to the CI deploy allowlist

**Files:**
- Modify: `.github/workflows/deploy-functions.yml:48`

**Critical:** CI deploys with explicit `--only functions:<name>` lists. A new function that is not in a list is never deployed, and the frontend call fails with what looks like a CORS error. There is no test for this — the check is reading the file.

- [ ] **Step 1: Add the function to the first deploy step**

In `.github/workflows/deploy-functions.yml`, change line 48 from:

```yaml
        run: firebase deploy --only functions:lookupCompanyReviews,functions:issueCustomToken --force
```

to:

```yaml
        run: firebase deploy --only functions:lookupCompanyReviews,functions:issueCustomToken,functions:getAccountThemes --force
```

- [ ] **Step 2: Verify the name matches the export exactly**

Run: `grep -n "getAccountThemes" functions/src/index.ts .github/workflows/deploy-functions.yml`
Expected: both files list `getAccountThemes`, spelled identically

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/deploy-functions.yml
git commit -m "ci: deploy getAccountThemes"
```

---

## Task 11: Layer B — client service and ThemeList

**Files:**
- Create: `services/accountThemes.ts`
- Create: `src/components/intel/ThemeList.tsx`
- Test: `src/components/intel/ThemeList.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/intel/ThemeList.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ThemeList from "./ThemeList";
import { AccountTheme } from "../../../services/accountThemes";

const themes: AccountTheme[] = [
  { theme: "The champion frequently lacked budget authority.", reviewIds: ["r2", "r5", "r7"] },
  { theme: "Security review began only after commercial agreement.", reviewIds: ["r1", "r3"] },
];

describe("ThemeList", () => {
  it("renders each theme with its report count", () => {
    render(<ThemeList themes={themes} />);
    expect(screen.getByText(/champion frequently lacked budget authority/)).toBeInTheDocument();
    expect(screen.getByText("3 reports")).toBeInTheDocument();
    expect(screen.getByText("2 reports")).toBeInTheDocument();
  });

  it("renders nothing when there are no themes", () => {
    const { container } = render(<ThemeList themes={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/intel/ThemeList.test.tsx`
Expected: FAIL — `Failed to resolve import "./ThemeList"`

- [ ] **Step 3: Write the client service**

Create `services/accountThemes.ts`:

```ts
import { getFunctions, httpsCallable } from "firebase/functions";
import { Review } from "../types";

export interface AccountTheme {
  theme: string;
  reviewIds: string[];
}

/**
 * Recurring themes across review free text, extracted server-side and cached
 * per company + review count. Returns [] on any failure — Layers A and C carry
 * the panel without this.
 */
export const getAccountThemes = async (
  companyId: string,
  reviews: Review[],
): Promise<AccountTheme[]> => {
  try {
    const functions = getFunctions(undefined, "australia-southeast1");
    const fn = httpsCallable<
      { companyId: string; reviews: { id: string; content: string }[] },
      { themes: AccountTheme[] }
    >(functions, "getAccountThemes");
    const result = await fn({
      companyId,
      reviews: reviews.map((r) => ({ id: r.id, content: r.content })),
    });
    return result.data.themes ?? [];
  } catch (error) {
    console.error("Theme extraction failed:", error);
    return [];
  }
};
```

- [ ] **Step 4: Write the component**

Create `src/components/intel/ThemeList.tsx`:

```tsx
import React from "react";
import { Sparkles } from "lucide-react";
import { AccountTheme } from "../../../services/accountThemes";

const ThemeList: React.FC<{ themes: AccountTheme[] }> = ({ themes }) => {
  if (themes.length === 0) return null;
  return (
    <section
      aria-labelledby="themes-heading"
      className="bg-white border border-slate-200 rounded-card p-4 space-y-3"
    >
      <h2 id="themes-heading" className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        <Sparkles size={15} className="text-accent" aria-hidden="true" />
        What sellers keep reporting
      </h2>
      <ul className="space-y-2">
        {themes.map((t) => (
          <li key={t.theme} className="flex items-start justify-between gap-3">
            <span className="text-sm text-slate-700">{t.theme}</span>
            <span className="shrink-0 text-2xs font-semibold text-slate-500 tabular-nums">
              {t.reviewIds.length} report{t.reviewIds.length !== 1 ? "s" : ""}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
};

export default ThemeList;
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/components/intel/ThemeList.test.tsx`
Expected: PASS — 2 tests

- [ ] **Step 6: Commit**

```bash
git add services/accountThemes.ts src/components/intel/ThemeList.tsx src/components/intel/ThemeList.test.tsx
git commit -m "feat(themes): add client service and theme list panel"
```

---

## Task 12: Wire the three layers into CompanyProfile and remove the persona

**Files:**
- Modify: `pages/CompanyProfile.tsx`
- Delete: `src/components/intel/Playbook.tsx`, `src/components/intel/Playbook.test.tsx`
- Test: `pages/CompanyProfile.test.tsx` (existing suite — it must still pass; no new cases added here, the three panels are covered by their own component tests)

- [ ] **Step 1: Read the existing profile test to match its setup**

Run: `sed -n 1,60p pages/CompanyProfile.test.tsx`
Expected: shows the render helper and mocks used by the existing tests — reuse them rather than inventing a new harness.

- [ ] **Step 2: Update the imports**

In `pages/CompanyProfile.tsx`, remove these two lines:

```tsx
import { getAICompanyPersona, CompanyPersona } from "../services/geminiService";
import Playbook from "../src/components/intel/Playbook";
```

and add:

```tsx
import DealMechanicsPanel from "../src/components/intel/DealMechanics";
import QuestionList from "../src/components/intel/QuestionList";
import ThemeList from "../src/components/intel/ThemeList";
import { getDealMechanics } from "../services/dealMechanics";
import { getQualificationQuestions } from "../services/qualificationQuestions";
import { getAccountThemes, AccountTheme } from "../services/accountThemes";
```

- [ ] **Step 3: Replace the persona state and effect**

Replace this state declaration (currently at `pages/CompanyProfile.tsx:43`):

```tsx
  const [aiPersona, setAiPersona] = useState<CompanyPersona | null>(null);
```

with:

```tsx
  const [themes, setThemes] = useState<AccountTheme[]>([]);
```

Then replace the entire persona effect (currently `pages/CompanyProfile.tsx:193-218`, the block starting `// Update AI Persona when the filtered set of reviews changes`) with:

```tsx
  // Layers A and C are pure derivations of the filtered review set — no network,
  // no loading state, recomputed synchronously whenever the filters change.
  const mechanics = useMemo(() => getDealMechanics(filteredReviews), [filteredReviews]);

  const questions = useMemo(
    () => (mechanics ? getQualificationQuestions(mechanics) : []),
    [mechanics],
  );

  // Layer B is the only AI call. Keyed on companyId, NOT on the filter state —
  // themes are a property of the account, and refetching per filter combination
  // is what made the old persona expensive and inconsistent between users.
  useEffect(() => {
    if (isPaid && company && companyReviews.length > 0) {
      getAccountThemes(company.id, companyReviews).then(setThemes);
    } else {
      setThemes([]);
    }
  }, [isPaid, company, companyReviews]);
```

- [ ] **Step 4: Replace the render block**

Replace the Playbook block (currently `pages/CompanyProfile.tsx:307-313`):

```tsx
      {isPro ? (
        aiPersona && <Playbook persona={aiPersona} />
      ) : (
        <Link to="/pricing" className="block bg-navy text-white rounded-card p-6 text-center">
          <span className="text-sm font-semibold">Unlock the AI playbook and full review evidence with Sales Pro</span>
        </Link>
      )}
```

with:

```tsx
      {isPro ? (
        <>
          {mechanics && <DealMechanicsPanel mechanics={mechanics} />}
          {company && <QuestionList companyId={company.id} questions={questions} />}
          <ThemeList themes={themes} />
        </>
      ) : (
        <Link to="/pricing" className="block bg-navy text-white rounded-card p-6 text-center">
          <span className="text-sm font-semibold">
            Unlock deal mechanics, account questions, and full review evidence with Sales Pro
          </span>
        </Link>
      )}
```

- [ ] **Step 5: Remove the now-unused loading state**

Search for `isAiLoading` in `pages/CompanyProfile.tsx`. Remove the `useState` declaration at line 45 and every remaining reference — Layers A and C are synchronous and Layer B degrades to an empty list, so there is nothing to spin on.

Run: `grep -n "isAiLoading\|aiPersona\|Playbook" pages/CompanyProfile.tsx`
Expected: no output

- [ ] **Step 6: Delete the Playbook component**

```bash
git rm src/components/intel/Playbook.tsx src/components/intel/Playbook.test.tsx
```

- [ ] **Step 7: Run the full suite and the type check**

Run: `npm test`
Expected: PASS — all suites, no reference to the deleted Playbook

Run: `npm run type-check`
Expected: exit 0

- [ ] **Step 8: Commit**

```bash
git add pages/CompanyProfile.tsx
git commit -m "feat(profile): replace MEDDPICC playbook with deal mechanics brief"
```

---

## Task 13: Remove the dead persona code paths

**Files:**
- Modify: `services/geminiService.ts:70-145`
- Modify: `functions/src/searchCompanies.ts:42-154`

The extension persona at `functions/src/extension/lookupCompanyReviews.ts:108` is a different feature. **Do not touch it.**

- [ ] **Step 1: Remove the client persona wrapper**

In `services/geminiService.ts`, delete everything from line 70 (`export interface TeamPlaybook {`) to the end of the file. Keep `searchCompanies`, `moderateReview`, `isGeminiAvailable`, and the `getSessionCache` / `setSessionCache` helpers.

- [ ] **Step 2: Confirm nothing still imports the removed symbols**

Run: `grep -rn "getAICompanyPersona\|CompanyPersona\|TeamPlaybook" --include="*.ts" --include="*.tsx" . | grep -v node_modules | grep -v .claude/worktrees`
Expected: only `functions/src/searchCompanies.ts` (removed in the next step) and `functions/src/index.ts:32`

- [ ] **Step 3: Remove the server callable**

In `functions/src/searchCompanies.ts`, delete the entire `getAICompanyPersona` export (lines 42 to the end of file). Keep `searchCompanyEntities` and the `GEMINI_API_KEY` / `GoogleGenAI` imports it uses. Remove `Type` from the `@google/genai` import — only the deleted function used it.

The import line becomes:

```ts
import { GoogleGenAI } from "@google/genai";
```

- [ ] **Step 4: Update the index export**

In `functions/src/index.ts`, change line 32 from:

```ts
export { searchCompanyEntities, getAICompanyPersona } from "./searchCompanies";
```

to:

```ts
export { searchCompanyEntities } from "./searchCompanies";
```

- [ ] **Step 5: Verify both workspaces build**

Run: `npm run type-check`
Expected: exit 0

Run: `npm run build -w functions`
Expected: exit 0

Run: `npm test`
Expected: PASS — all suites

- [ ] **Step 6: Commit**

```bash
git add services/geminiService.ts functions/src/searchCompanies.ts functions/src/index.ts
git commit -m "refactor: remove the MEDDPICC persona code paths"
```

**Note for the operator, not a code step:** the deployed `getAICompanyPersona` Cloud Function is not in any CI `--only` list, so removing the export will not delete it from Firebase. It will sit there unused. Deleting it requires `firebase functions:delete getAICompanyPersona` run manually. Do not chain that onto a deploy — per the project's deploy notes, rapid-fire function operations cause 409 conflicts.

---

## Task 14: Replace MEDDPICC positioning copy

**Files:**
- Modify: `pages/Pricing.tsx:21-25`, `pages/Pricing.tsx:177-179`, `pages/Pricing.tsx:260`
- Modify: `pages/Home.tsx:35-36`
- Modify: `pages/CompanyProfile.tsx:186-189`

Australian English, plain hyphens, "Dealecho" casing.

- [ ] **Step 1: Update the pricing feature list**

In `pages/Pricing.tsx`, replace lines 177-179:

```tsx
    "AI account persona intelligence",
    "Deep-dive MEDDPICC blueprints",
    "Departmental playbooks",
```

with:

```tsx
    "Deal mechanics - how this buyer actually buys",
    "Account-specific qualification questions",
    "Recurring themes cited to verified reports",
```

- [ ] **Step 2: Update the pricing SEO block**

In `pages/Pricing.tsx`, replace the `title`, `description`, and `keywords` values at lines 21-25 with:

```tsx
    title: "Dealecho Pricing - Unlock Deal Mechanics and Buyer Intelligence",
    description:
      "Scale your closing rate. Start a 30-day free trial of Sales Pro to access unlimited account tracking, deal mechanics on every account, and qualification questions built from verified seller reports.",
    keywords:
      "Sales Pro pricing, sales intelligence subscription, deal mechanics, procurement intelligence, B2B deal close rate, Dealecho",
```

- [ ] **Step 3: Update the pricing CTA**

In `pages/Pricing.tsx`, replace line 260:

```tsx
          Unlock deep-dive AI personas, MEDDPICC blueprints, and unlimited account tracking.
```

with:

```tsx
          Unlock deal mechanics, account-specific questions, and unlimited account tracking.
```

- [ ] **Step 4: Update the home SEO block**

In `pages/Home.tsx`, replace the `description` and `keywords` at lines 35-36 with:

```tsx
      "Know the buyer before the first call. Verified B2B buyer intelligence, red-flag analysis, and deal mechanics for elite tech accounts.",
    keywords: "B2B sales intelligence, deal mechanics, procurement intelligence, buying teams, account planning, Dealecho",
```

- [ ] **Step 5: Update the company profile SEO block**

In `pages/CompanyProfile.tsx`, replace the `description` and `keywords` at lines 186-189 with:

```tsx
    description: company
      ? `Access verified sales reviews, aggregate buyer responsiveness, negotiation scores, and deal mechanics for ${company.name}.`
      : "Access B2B sales cycle insights, deal mechanics, and buyer execution ratings for enterprise target accounts.",
    keywords: company
      ? `${company.name} sales, ${company.name} reviews, ${company.name} procurement, B2B sales intelligence`
      : "B2B sales intelligence, deal mechanics, account planning",
```

- [ ] **Step 6: Confirm no MEDDPICC copy survives**

Run: `grep -rni "meddpic\|meddic" --include="*.ts" --include="*.tsx" . | grep -v node_modules | grep -v .claude/worktrees`
Expected: no output

- [ ] **Step 7: Run the full suite and type check**

Run: `npm test`
Expected: PASS — all suites

Run: `npm run type-check`
Expected: exit 0

- [ ] **Step 8: Commit**

```bash
git add pages/Pricing.tsx pages/Home.tsx pages/CompanyProfile.tsx
git commit -m "copy: replace MEDDPICC positioning with deal mechanics"
```

---

## Task 15: Verify in the running app

**Files:** none — this is verification.

- [ ] **Step 1: Start the dev server**

Use the `preview_start` tool with `{name: "dev"}`. If `.claude/launch.json` does not exist, create it first:

```json
{
  "version": "0.0.1",
  "configurations": [
    { "name": "dev", "runtimeExecutable": "npm", "runtimeArgs": ["run", "dev"], "port": 5173 }
  ]
}
```

- [ ] **Step 2: Open a company profile with at least 3 reviews as a paid user**

Navigate to a company profile route. Confirm on screen:
- "How this buyer buys" panel renders with real counts
- "Ask this account" renders at most 6 questions, each with a department chip, a stage chip, and a `why` line containing a number
- No panel renders on an account with fewer than 3 reviews

- [ ] **Step 3: Check for console and network errors**

Use `read_console_messages` with `onlyErrors: true`.
Expected: no errors. A failed `getAccountThemes` call is acceptable locally (the function is not deployed to the emulator) — it must degrade to an empty theme list, not break the page.

- [ ] **Step 4: Confirm the checkbox state persists**

Tick a question, reload the page, confirm it is still ticked and the progress counter reads correctly.

- [ ] **Step 5: Screenshot the result**

Use `computer` with `{action: "screenshot"}` and share it.

- [ ] **Step 6: Push**

```bash
git push origin main
```

CI deploys `getAccountThemes` via the updated allowlist. Watch https://github.com/brendanreid-droid/DealEcho/actions — if the deploy 409s, wait for the run to finish before retrying rather than pushing again.

---

## Deferred (not in this plan)

- **Rewriting the `accountSignal.ts` flag rules.** The substring keyword rules at `services/accountSignal.ts:36` are noisy (`"freeze"` matches anything, `"legal"` fires on praise). Layer C deliberately does not depend on them, so this plan does not block on it. Worth a follow-up once the mechanics panel is live.
- **Copy questions to clipboard as markdown.** Obvious next step, no test coverage cost, but not needed to prove the feature.
- **Server-side persistence of answered questions.** `localStorage` is enough to learn whether anyone ticks them. Add Firestore only if the engagement data justifies it.
- **Deleting the orphaned `getAICompanyPersona` Cloud Function** from Firebase (see the note in Task 13).
