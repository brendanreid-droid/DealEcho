# Review Schema v2 — Richer, Less Subjective Reviews + Benchmark-Ready Data

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the Write a Review form and backend so reviews capture objective, benchmark-ready deal facts (deal type, region, deal period, seller context, procurement friction events, verbal-to-signature lag, slippage, payment terms) alongside the existing star ratings, and surface the new data in Global Trends.

**Architecture:** All new enum values live in `src/constants/dealData.ts` (single source of truth for the frontend) with a duplicated, comment-linked copy in `functions/src/lib/reviewSchema.ts` (functions workspace cannot import from `src/`). New reviews get `schemaVersion: 2` (set server-side). All new `Review` fields are optional in TypeScript so legacy (v1) docs keep working. Legacy bracket values (`"$1M+"`, `"12+ Months"`) are normalized at read time by `src/utils/reviewSchema.ts` — no Firestore migration. The `submitReview`/`resubmitReview` callables already exist and are already in the CI deploy allowlist, so no workflow change is needed.

**Tech Stack:** React 19 + Vite + TypeScript (frontend), Firebase Cloud Functions v2 (backend), Vitest (tests: `npm test`), type-check via `npm run type-check`.

**Key existing files (read these first if you lack context):**
- [pages/CreateReview.tsx](../pages/CreateReview.tsx) — the form
- [src/constants/dealData.ts](../src/constants/dealData.ts) — enums
- [types.ts](../types.ts) — `Review` interface
- [functions/src/reviewSubmission.ts](../functions/src/reviewSubmission.ts) — authoritative write path
- [pages/GlobalTrends.tsx](../pages/GlobalTrends.tsx) — analytics consumer
- [src/components/intel/ReviewCard.tsx](../src/components/intel/ReviewCard.tsx) — display

**Product decisions locked in (do not relitigate during implementation):**
0. **Reviewer time budget is the top constraint.** The required path must stay ≈3 minutes: it adds only TWO new required inputs vs today (Deal Type, Region — both single-click dropdowns, Region auto-derived from the selected company's country). ALL other v2 fields live in a collapsed, explicitly optional "Deal Details" section with safe defaults; skipping it entirely still produces a valid v2 review. Seller category / size / currency are remembered in `localStorage` and prefilled on the next review, so repeat reviewers never re-answer them. Deal period defaults to the current quarter.
1. Outcomes become `Won | Lost | No Decision | Withdrew | Ongoing`. "No Decision" = buyer stalled / status quo won. "Withdrew" = seller disqualified the account.
2. TCV brackets extend past $1M: `$1M - $2.5M`, `$2.5M - $5M`, `$5M - $10M`, `$10M+`. Legacy `"$1M+"` normalizes to `$1M - $2.5M` at read time (conservative bucketing, commented in code).
3. Duration brackets extend past 12 months: `12-18 Months`, `18-24 Months`, `24+ Months`. Legacy `"12+ Months"` normalizes to `12-18 Months`.
4. TCV brackets stay USD-denominated; label changes to "TCV Range (USD equiv.)". A `currency` selector records the deal's native currency.
5. New objective fields default to `"Unknown"`-style values where honest ignorance is plausible (verbal-to-signature, slippage, payment terms, procurement entry); analytics excludes Unknowns.
6. The 50-word minimum (already enforced server-side) becomes enforced client-side too (submit button disabled until met).
7. No win-rate-by-company anywhere. Industry-level win rate stays as-is in GlobalTrends.
8. Friction Index = per-review 0–100 score from friction events + slippage + ghosting + verbal-to-signature lag; only computed for `schemaVersion >= 2` reviews.

---

### Task 1: Constants v2 in `dealData.ts`

**Files:**
- Modify: `src/constants/dealData.ts`
- Create: `src/constants/dealData.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/constants/dealData.test.ts`:

```ts
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
    const periods = recentDealPeriods(new Date("2026-07-22"));
    expect(periods[0]).toBe("Q3 2026");
    expect(periods[1]).toBe("Q2 2026");
    expect(periods[7]).toBe("Q4 2024");
    expect(periods[8]).toBe("Older");
    expect(periods).toHaveLength(9);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/constants/dealData.test.ts`
Expected: FAIL — `OUTCOMES`, `DEAL_TYPES`, etc. are not exported.

- [ ] **Step 3: Implement**

In `src/constants/dealData.ts`, replace the existing `TCV_BRACKETS` and `DURATION_BRACKETS` blocks and append the new constants (keep `DEPARTMENT_VALUES`, `DEPARTMENTS`, `CHROME_EXTENSION_URL` unchanged):

```ts
/** Ordered smallest → largest. USD-denominated. Used in forms and analytics matrix. */
export const TCV_BRACKETS = [
  "< $10k",
  "$10k - $25k",
  "$25k - $50k",
  "$50k - $100k",
  "$100k - $250k",
  "$250k - $500k",
  "$500k - $750k",
  "$750k - $1M",
  "$1M - $2.5M",
  "$2.5M - $5M",
  "$5M - $10M",
  "$10M+",
] as const;

export type TcvBracket = (typeof TCV_BRACKETS)[number];

/** Stored by schema v1 reviews; normalized at read time (see src/utils/reviewSchema.ts). */
export const LEGACY_TCV_BRACKET = "$1M+";

/** Ordered shortest → longest. Used in forms and analytics matrix. */
export const DURATION_BRACKETS = [
  "< 1 Month",
  "1-3 Months",
  "3-6 Months",
  "6-12 Months",
  "12-18 Months",
  "18-24 Months",
  "24+ Months",
] as const;

export type DurationBracket = (typeof DURATION_BRACKETS)[number];

/** Stored by schema v1 reviews; normalized at read time (see src/utils/reviewSchema.ts). */
export const LEGACY_DURATION_BRACKET = "12+ Months";

// ---------------------------------------------------------------------------
// Schema v2 enums. Server-side copy lives in functions/src/lib/reviewSchema.ts
// — keep the two files in sync when editing.
// ---------------------------------------------------------------------------

export const OUTCOMES = ["Won", "Lost", "No Decision", "Withdrew", "Ongoing"] as const;
export type Outcome = (typeof OUTCOMES)[number];

export const DEAL_TYPES = [
  "New Business",
  "Renewal",
  "Expansion / Upsell",
  "Channel / Partner-led",
] as const;

export const DEAL_REGIONS = [
  "North America",
  "Latin America",
  "UK & Ireland",
  "Europe",
  "Middle East & Africa",
  "Asia",
  "Australia & NZ",
  "Global / Multi-region",
] as const;

export const CURRENCIES = ["USD", "AUD", "EUR", "GBP", "Other"] as const;

export const SELLER_CATEGORIES = [
  "Software / SaaS",
  "IT Services / Consulting",
  "Hardware / Equipment",
  "Financial Services",
  "Telco / Infrastructure",
  "Other",
] as const;

export const SELLER_SIZES = ["1-10", "11-50", "51-200", "201-1000", "1000+"] as const;

/** Objective procurement-gauntlet events observed during the deal. */
export const FRICTION_EVENTS = [
  "Security questionnaire",
  "SOC 2 / pen test required",
  "Legal redlines on MSA",
  "Pilot / POC required",
  "Reference calls required",
  "Vendor onboarding portal",
  "Reverse auction / e-procurement",
] as const;

export const VERBAL_TO_SIGNATURE = [
  "< 1 Week",
  "1-4 Weeks",
  "1-3 Months",
  "3+ Months",
  "No verbal commit",
  "Unknown",
] as const;

export const CLOSE_SLIPPAGE = [
  "Never pushed",
  "Pushed once",
  "Pushed twice",
  "Pushed 3+ times",
  "Unknown",
] as const;

export const PAYMENT_TERMS = ["Net 30", "Net 60", "Net 90", "Net 120+", "Unknown / N/A"] as const;

export const PROCUREMENT_ENTRY = [
  "Early (before shortlist)",
  "Mid-cycle",
  "After verbal commit",
  "Never involved",
  "Unknown",
] as const;

export const STAKEHOLDER_COUNTS = ["1-2", "3-5", "6-10", "10+"] as const;

/** Last 8 quarters, newest first, plus "Older". `now` injectable for tests. */
export function recentDealPeriods(now: Date = new Date()): string[] {
  const out: string[] = [];
  let q = Math.floor(now.getMonth() / 3) + 1;
  let y = now.getFullYear();
  for (let i = 0; i < 8; i++) {
    out.push(`Q${q} ${y}`);
    q--;
    if (q === 0) {
      q = 4;
      y--;
    }
  }
  out.push("Older");
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/constants/dealData.test.ts`
Expected: PASS (all 5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/constants/dealData.ts src/constants/dealData.test.ts
git commit -m "feat(review): schema v2 constants - extended brackets, outcomes, deal context, friction enums"
```

Note: `npm run type-check` will FAIL at this point (GlobalTrends matrix and CreateReview still reference old bracket unions is fine — they use strings — but nothing references removed values by literal type; if type-check passes, fine; if it flags anything, the failures are fixed by Tasks 3–7). Do not push until Task 8.

---

### Task 2: `Review` type v2 + read-time normalization utils

**Files:**
- Modify: `types.ts`
- Create: `src/utils/reviewSchema.ts`
- Create: `src/utils/reviewSchema.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/utils/reviewSchema.test.ts`:

```ts
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
    ).toBe(Math.round((1 / 15) * 100));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/utils/reviewSchema.test.ts`
Expected: FAIL — module `src/utils/reviewSchema.ts` does not exist, and `Review` lacks `schemaVersion`.

- [ ] **Step 3: Extend `Review` in `types.ts`**

Replace the `status` line and append the v2 fields (all optional — legacy docs lack them). The full interface after the edit:

```ts
export interface Review {
  id: string;
  companyId: string;
  companyName: string;
  userId: string;
  userName: string;
  currency: string;
  tcvBracket: string;
  cycleDuration: string;
  status: 'Won' | 'Lost' | 'No Decision' | 'Withdrew' | 'Ongoing';
  isTender: boolean;
  buyingTeam: string[];
  location: string;
  communicationRating: number; // Responsiveness: 1 (Ghosting) → 5 (Instant). Higher = better.
  negotiationLevel: number; // Negotiation Ease: 1 (Brutal) → 5 (Instant). Higher = better.
  timeWasterLevel: number; // Buyer Intent: 1 (Tire Kicker) → 5 (Critical). Higher = better.
  // NOTE: negotiationLevel / timeWasterLevel are legacy field names whose stored
  // semantics are HIGH-IS-GOOD (see CreateReview star tooltips). Do NOT invert
  // them when aggregating into health scores.
  clarityOfScope: number; // Scope Maturity: 1 (Vague) → 5 (Crystal Clear). Higher = better.
  industry: string;
  country: string;
  content: string;
  logoUrl?: string;
  createdAt: string;

  // --- Schema v2 (2026-07). Absent on legacy reviews; set server-side. ---
  schemaVersion?: number;
  dealType?: string; // DEAL_TYPES
  dealRegion?: string; // DEAL_REGIONS — region sold INTO (buying entity), not company HQ
  dealPeriod?: string; // e.g. "Q3 2026" or "Older" — when the deal concluded/stalled
  sellerCategory?: string; // SELLER_CATEGORIES — what the reviewer sells
  sellerSize?: string; // SELLER_SIZES — reviewer's company headcount
  frictionEvents?: string[]; // FRICTION_EVENTS subset; empty array = none observed
  verbalToSignature?: string; // VERBAL_TO_SIGNATURE
  closeSlippage?: string; // CLOSE_SLIPPAGE
  wentDark?: boolean; // buyer went silent >2 weeks mid-cycle
  paymentTerms?: string; // PAYMENT_TERMS
  procurementEntry?: string; // PROCUREMENT_ENTRY
  stakeholderCount?: string; // STAKEHOLDER_COUNTS
}
```

- [ ] **Step 4: Create `src/utils/reviewSchema.ts`**

```ts
import {
  TCV_BRACKETS,
  DURATION_BRACKETS,
  LEGACY_TCV_BRACKET,
  LEGACY_DURATION_BRACKET,
  DEAL_REGIONS,
  TcvBracket,
  DurationBracket,
} from "../constants/dealData";
import { Review } from "../../types";

/**
 * Read-time normalization for bracket values. Schema v1 reviews stored the
 * catch-all "$1M+" / "12+ Months"; v2 split those into finer brackets. Legacy
 * values are bucketed CONSERVATIVELY into the lowest matching new bracket so
 * aggregates never overstate deal size or cycle length. No Firestore migration.
 */
export function normalizeTcvBracket(b: string): TcvBracket | null {
  if ((TCV_BRACKETS as readonly string[]).includes(b)) return b as TcvBracket;
  if (b === LEGACY_TCV_BRACKET) return "$1M - $2.5M";
  return null;
}

export function normalizeDurationBracket(b: string): DurationBracket | null {
  if ((DURATION_BRACKETS as readonly string[]).includes(b)) return b as DurationBracket;
  if (b === LEGACY_DURATION_BRACKET) return "12-18 Months";
  return null;
}

const SLIPPAGE_POINTS: Record<string, number> = {
  "Never pushed": 0,
  "Pushed once": 1,
  "Pushed twice": 2,
  "Pushed 3+ times": 3,
};

const V2S_POINTS: Record<string, number> = {
  "< 1 Week": 0,
  "1-4 Weeks": 1,
  "1-3 Months": 2,
  "3+ Months": 3,
};

/**
 * Best-effort default for the "Region Sold Into" select from the verified
 * company's country. Editable by the reviewer; unknown countries fall back to
 * "Global / Multi-region" (an honest "unspecified", never a wrong guess).
 */
const COUNTRY_REGION_MAP: Record<string, (typeof DEAL_REGIONS)[number]> = {
  usa: "North America",
  "united states": "North America",
  us: "North America",
  canada: "North America",
  mexico: "Latin America",
  brazil: "Latin America",
  argentina: "Latin America",
  chile: "Latin America",
  colombia: "Latin America",
  uk: "UK & Ireland",
  "united kingdom": "UK & Ireland",
  ireland: "UK & Ireland",
  germany: "Europe",
  france: "Europe",
  netherlands: "Europe",
  spain: "Europe",
  italy: "Europe",
  sweden: "Europe",
  switzerland: "Europe",
  poland: "Europe",
  israel: "Middle East & Africa",
  uae: "Middle East & Africa",
  "united arab emirates": "Middle East & Africa",
  "saudi arabia": "Middle East & Africa",
  "south africa": "Middle East & Africa",
  india: "Asia",
  singapore: "Asia",
  japan: "Asia",
  china: "Asia",
  "south korea": "Asia",
  "hong kong": "Asia",
  australia: "Australia & NZ",
  "new zealand": "Australia & NZ",
};

export function countryToRegion(country: string): (typeof DEAL_REGIONS)[number] {
  return COUNTRY_REGION_MAP[country.trim().toLowerCase()] ?? "Global / Multi-region";
}

const MAX_FRICTION_POINTS = 15; // 7 events + 3 slippage + 2 ghosting + 3 verbal lag

/**
 * 0–100 composite of objective friction signals. Null for schema v1 reviews
 * (fields absent → score would be meaningless, not zero). "Unknown" answers
 * contribute 0 rather than excluding the review, so partial answers still count.
 */
export function frictionScore(r: Review): number | null {
  if ((r.schemaVersion ?? 1) < 2) return null;
  let pts = Math.min(r.frictionEvents?.length ?? 0, 7);
  pts += SLIPPAGE_POINTS[r.closeSlippage ?? ""] ?? 0;
  if (r.wentDark) pts += 2;
  pts += V2S_POINTS[r.verbalToSignature ?? ""] ?? 0;
  return Math.round((pts / MAX_FRICTION_POINTS) * 100);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/utils/reviewSchema.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 6: Commit**

```bash
git add types.ts src/utils/reviewSchema.ts src/utils/reviewSchema.test.ts
git commit -m "feat(review): Review v2 type, legacy bracket normalization, friction score util"
```

---

### Task 3: CreateReview — required core additions (Deal Type + Region only)

**Files:**
- Modify: `pages/CreateReview.tsx`

No new test file for this task — form wiring is verified by type-check plus the manual browser check in Task 8. Existing star/section behavior unchanged.

**Friction guard:** the required path gains exactly TWO inputs (Deal Type, Region). Region is auto-defaulted from the selected company's country, so for most reviewers it is zero clicks. Everything else goes into Task 4's collapsed optional section.

- [ ] **Step 1: Extend imports and state**

In `pages/CreateReview.tsx`, replace the `dealData` import (line 10) with:

```ts
import {
  DEPARTMENTS,
  TCV_BRACKETS,
  DURATION_BRACKETS,
  OUTCOMES,
  Outcome,
  DEAL_TYPES,
  DEAL_REGIONS,
  CURRENCIES,
  SELLER_CATEGORIES,
  SELLER_SIZES,
  FRICTION_EVENTS,
  VERBAL_TO_SIGNATURE,
  CLOSE_SLIPPAGE,
  PAYMENT_TERMS,
  PROCUREMENT_ENTRY,
  STAKEHOLDER_COUNTS,
  recentDealPeriods,
} from "../src/constants/dealData";
import { countryToRegion } from "../src/utils/reviewSchema";
```

Replace the `status` state line (`const [status, setStatus] = useState<"Won" | "Lost" | "Ongoing">("Won");`) and add new state directly below the existing `isTender` state:

```ts
const [status, setStatus] = useState<Outcome>("Won");
const [dealType, setDealType] = useState<string>(DEAL_TYPES[0]);
const [dealRegion, setDealRegion] = useState<string>(DEAL_REGIONS[0]);
const [regionTouched, setRegionTouched] = useState(false);
```

Add an effect (below the existing search debounce effect) that derives the region default whenever a company is picked, unless the reviewer has manually chosen one:

```ts
useEffect(() => {
  if (selectedCompany && !regionTouched) {
    setDealRegion(countryToRegion(selectedCompany.country));
  }
}, [selectedCompany, regionTouched]);
```

- [ ] **Step 2: Replace the Outcome select options and TCV label**

In the Outcome card, replace the hardcoded `<option>` list and the `as` cast:

```tsx
<select
  value={status}
  onChange={(e) => setStatus(e.target.value as Outcome)}
  className="w-full bg-white border border-slate-200 rounded-control px-4 py-4 text-sm font-bold text-slate-700 outline-none shadow-sm cursor-pointer hover:border-accent/30 transition-colors"
>
  {OUTCOMES.map((o) => (
    <option key={o} value={o}>
      {o}
    </option>
  ))}
</select>
```

Change the TCV card label text from `TCV Range` to `TCV Range (USD equiv.)`.

- [ ] **Step 3: Add two new cards to the Deal Logistics grid**

Immediately after the RFx / Tender card's closing `</div>` (still inside the `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8` container — grid grows from 4 to 6 cards), add:

```tsx
<DealSelectCard label="Deal Type" value={dealType} onChange={setDealType} options={DEAL_TYPES} />
<DealSelectCard
  label="Region Sold Into"
  value={dealRegion}
  onChange={(v) => {
    setRegionTouched(true);
    setDealRegion(v);
  }}
  options={DEAL_REGIONS}
/>
```

And add the shared card component at the bottom of the file, above `ScorecardCard`:

```tsx
const DealSelectCard: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
}> = ({ label, value, onChange, options }) => (
  <div className="p-8 bg-slate-50/80 border border-slate-200 rounded-card space-y-4 shadow-sm">
    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
      {label}
    </label>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-white border border-slate-200 rounded-control px-4 py-4 text-sm font-bold text-slate-700 outline-none shadow-sm cursor-pointer hover:border-accent/30"
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  </div>
);
```

- [ ] **Step 4: Refactor the four existing selects to use `DealSelectCard`** *(optional DRY pass — Outcome, TCV, Cycle can each become `DealSelectCard` calls; keep the RFx toggle bespoke. Skip if it fights the type of `status`.)*

- [ ] **Step 5: Type-check**

Run: `npm run type-check`
Expected: PASS (or only pre-existing errors unrelated to CreateReview — there should be none).

- [ ] **Step 6: Commit**

```bash
git add pages/CreateReview.tsx
git commit -m "feat(review): deal type and region in required core, region auto-derived from company"
```

---

### Task 4: CreateReview — optional collapsed "Deal Details" section + payload + 50-word enforcement

**Files:**
- Modify: `pages/CreateReview.tsx`

**Friction guard:** this entire section is optional, collapsed by default, and every field has a safe default (`"Unknown"`-style values, current quarter, `localStorage`-remembered seller prefs). A reviewer who never opens it still submits a complete v2 review. Nothing in it participates in submit validation or the button's `disabled` gate.

- [ ] **Step 1: Add optional-section state + localStorage prefill**

Below the state from Task 3:

```ts
const PREFS_KEY = "dealecho.reviewerPrefs";

const readPrefs = (): { sellerCategory?: string; sellerSize?: string; currency?: string } => {
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}");
  } catch {
    return {};
  }
};

const [showDetails, setShowDetails] = useState(false);
const prefs = useRef(readPrefs()).current;
const dealPeriods = recentDealPeriods();
const [dealPeriod, setDealPeriod] = useState<string>(dealPeriods[0]); // defaults to current quarter
const [currency, setCurrency] = useState<string>(prefs.currency ?? CURRENCIES[0]);
const [sellerCategory, setSellerCategory] = useState<string>(prefs.sellerCategory ?? SELLER_CATEGORIES[0]);
const [sellerSize, setSellerSize] = useState<string>(prefs.sellerSize ?? SELLER_SIZES[0]);
const [frictionEvents, setFrictionEvents] = useState<string[]>([]);
const [verbalToSignature, setVerbalToSignature] = useState<string>("Unknown");
const [closeSlippage, setCloseSlippage] = useState<string>("Unknown");
const [wentDark, setWentDark] = useState(false);
const [paymentTerms, setPaymentTerms] = useState<string>("Unknown / N/A");
const [procurementEntry, setProcurementEntry] = useState<string>("Unknown");
const [stakeholderCount, setStakeholderCount] = useState<string>(STAKEHOLDER_COUNTS[0]);

const toggleFriction = (ev: string) =>
  setFrictionEvents((prev) =>
    prev.includes(ev) ? prev.filter((e) => e !== ev) : [...prev, ev],
  );
```

(`useRef` is already imported at the top of the file.)

- [ ] **Step 2: Insert the collapsed optional section**

Between the Deal Logistics section's closing `</section>` and the Scorecard section, insert. Collapsed: a single full-width expander row selling the benefit. Expanded: gauntlet toggles + selects. Explicitly labeled optional in the header AND the expander copy.

```tsx
{/* Optional: Deal Details — objective events, not opinions. Collapsed by default
    to keep the required path fast; every field has a safe default. */}
<section className="space-y-6">
  <button
    type="button"
    onClick={() => setShowDetails((s) => !s)}
    className="w-full flex items-center justify-between p-6 md:p-8 bg-slate-50 border-2 border-dashed border-slate-200 rounded-card hover:border-accent/30 transition-all text-left group"
  >
    <div className="flex items-center space-x-4">
      <div className="w-10 h-10 rounded-2xl bg-white text-accent flex items-center justify-center border border-slate-200 shadow-sm">
        <Icon name={showDetails ? "fa-chevron-up" : "fa-plus"} size={14} />
      </div>
      <div>
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-[0.2em]">
          Deal Details <span className="text-slate-400 normal-case tracking-normal font-medium">(optional, ~60 seconds)</span>
        </h3>
        <p className="text-slate-400 text-[10px] font-medium uppercase tracking-wider mt-1">
          Powers the benchmarks you get back. Skip freely - defaults are fine.
        </p>
      </div>
    </div>
  </button>

  {showDetails && (
    <div className="p-10 bg-slate-50/50 border border-slate-200 rounded-card space-y-8 shadow-inner">
      <div>
        <label className="text-[11px] font-bold text-slate-900 uppercase tracking-widest block mb-1">
          Procurement Gauntlet
        </label>
        <p className="text-slate-400 text-[10px] font-medium uppercase tracking-wider mb-6">
          Select everything the buyer required. Leave empty if none applied.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {FRICTION_EVENTS.map((ev) => (
            <button
              key={ev}
              type="button"
              onClick={() => toggleFriction(ev)}
              className={`px-4 py-3.5 rounded-control border-2 text-[11px] font-bold uppercase tracking-widest text-left transition-all ${
                frictionEvents.includes(ev)
                  ? "bg-accent text-white border-accent shadow-lg"
                  : "bg-white text-slate-500 border-slate-200 hover:border-accent/30"
              }`}
            >
              {ev}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        <DealSelectCard
          label="Verbal Yes → Signature"
          value={verbalToSignature}
          onChange={setVerbalToSignature}
          options={VERBAL_TO_SIGNATURE}
        />
        <DealSelectCard
          label="Close Date Slippage"
          value={closeSlippage}
          onChange={setCloseSlippage}
          options={CLOSE_SLIPPAGE}
        />
        <DealSelectCard
          label="Payment Terms Demanded"
          value={paymentTerms}
          onChange={setPaymentTerms}
          options={PAYMENT_TERMS}
        />
        <DealSelectCard
          label="Procurement Entered"
          value={procurementEntry}
          onChange={setProcurementEntry}
          options={PROCUREMENT_ENTRY}
        />
        <DealSelectCard
          label="Stakeholders Involved"
          value={stakeholderCount}
          onChange={setStakeholderCount}
          options={STAKEHOLDER_COUNTS}
        />
        <div className="p-8 bg-slate-50/80 border border-slate-200 rounded-card flex flex-col space-y-4 shadow-sm">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            Buyer Went Dark &gt;2 Weeks?
          </label>
          <div className="grid grid-cols-2 bg-white p-1.5 rounded-control border border-slate-200 shadow-sm">
            <button
              type="button"
              onClick={() => setWentDark(true)}
              className={`py-3 rounded-xl text-[11px] font-bold uppercase tracking-widest transition-all ${wentDark ? "bg-accent text-white shadow-lg" : "text-slate-400 hover:text-slate-600"}`}
            >
              Yes
            </button>
            <button
              type="button"
              onClick={() => setWentDark(false)}
              className={`py-3 rounded-xl text-[11px] font-bold uppercase tracking-widest transition-all ${!wentDark ? "bg-slate-900 text-white shadow-lg" : "text-slate-400 hover:text-slate-600"}`}
            >
              No
            </button>
          </div>
        </div>
        <DealSelectCard label="Deal Period" value={dealPeriod} onChange={setDealPeriod} options={dealPeriods} />
        <DealSelectCard label="Deal Currency" value={currency} onChange={setCurrency} options={CURRENCIES} />
        <DealSelectCard label="What You Sell" value={sellerCategory} onChange={setSellerCategory} options={SELLER_CATEGORIES} />
        <DealSelectCard label="Your Company Size" value={sellerSize} onChange={setSellerSize} options={SELLER_SIZES} />
      </div>
    </div>
  )}
</section>
```

- [ ] **Step 3: Section numbering**

Section badges stay `1` (Target Account), `2` (Deal Logistics), `3` (Scorecard), `4` (Strategic Context) — the optional expander deliberately carries NO number so the required path still reads as 4 steps. No renumbering needed.

- [ ] **Step 4: Enforce the 50-word minimum client-side**

Add a derived value above `handleSubmit`:

```ts
const wordCount = content.trim().split(/\s+/).filter((w) => w).length;
```

In `handleSubmit`'s validation, change `!content` to `wordCount < 50` and extend the error copy:

```ts
if (
  !selectedCompany ||
  wordCount < 50 ||
  commRating === 0 ||
  negotiation === 0 ||
  timeWaster === 0 ||
  clarityScope === 0 ||
  buyingTeam.length === 0
) {
  setError(
    "Please complete all sections - at least one Buying Team department, all four scorecard ratings, and a Strategic Context write-up of 50+ words.",
  );
  errorRef.current?.scrollIntoView({ behavior: "smooth" });
  return;
}
```

In the submit button's `disabled` expression, change `!content` to `wordCount < 50`.

Replace both inline `content.trim().split(/\s+/)...` expressions in the word-counter UI with `wordCount` (the counter and the "Ready to submit" flip already key off 50 — they now match the actual gate).

- [ ] **Step 5: Extend the submitted payload**

In `handleSubmit`, extend `newReview` — after the `isTender` line add:

```ts
schemaVersion: 2,
dealType,
dealRegion,
dealPeriod,
sellerCategory,
sellerSize,
frictionEvents,
verbalToSignature,
closeSlippage,
wentDark,
paymentTerms,
procurementEntry,
stakeholderCount,
```

And change the hardcoded `currency: "USD",` to `currency,`.

In the submit success branch (inside `if (success) { ... }`), persist the remembered prefs so the next review prefills them:

```ts
try {
  localStorage.setItem(PREFS_KEY, JSON.stringify({ sellerCategory, sellerSize, currency }));
} catch {
  // storage unavailable (private mode) — prefill is best-effort
}
```

- [ ] **Step 6: Type-check**

Run: `npm run type-check`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add pages/CreateReview.tsx
git commit -m "feat(review): optional deal details section, 50-word gate, v2 payload, seller prefs prefill"
```

---

### Task 5: Backend — sanitize + validate v2 fields in `submitReview`

**Files:**
- Create: `functions/src/lib/reviewSchema.ts`
- Modify: `functions/src/reviewSubmission.ts`

- [ ] **Step 1: Create `functions/src/lib/reviewSchema.ts`**

```ts
/**
 * Server-side copy of the review schema v2 enums.
 * SOURCE OF TRUTH for the frontend is src/constants/dealData.ts — the functions
 * workspace cannot import across workspaces, so keep this file in sync by hand.
 */

export const TCV_BRACKETS = [
  "< $10k",
  "$10k - $25k",
  "$25k - $50k",
  "$50k - $100k",
  "$100k - $250k",
  "$250k - $500k",
  "$500k - $750k",
  "$750k - $1M",
  "$1M - $2.5M",
  "$2.5M - $5M",
  "$5M - $10M",
  "$10M+",
  // Legacy v1 value — accepted on resubmit of old rejected reviews so we never
  // silently rewrite a legacy bracket into a wrong one.
  "$1M+",
] as const;

export const DURATION_BRACKETS = [
  "< 1 Month",
  "1-3 Months",
  "3-6 Months",
  "6-12 Months",
  "12-18 Months",
  "18-24 Months",
  "24+ Months",
  "12+ Months", // legacy v1, accepted on resubmit
] as const;

export const OUTCOMES = ["Won", "Lost", "No Decision", "Withdrew", "Ongoing"] as const;

export const DEAL_TYPES = [
  "New Business",
  "Renewal",
  "Expansion / Upsell",
  "Channel / Partner-led",
] as const;

export const DEAL_REGIONS = [
  "North America",
  "Latin America",
  "UK & Ireland",
  "Europe",
  "Middle East & Africa",
  "Asia",
  "Australia & NZ",
  "Global / Multi-region",
] as const;

export const CURRENCIES = ["USD", "AUD", "EUR", "GBP", "Other"] as const;

export const SELLER_CATEGORIES = [
  "Software / SaaS",
  "IT Services / Consulting",
  "Hardware / Equipment",
  "Financial Services",
  "Telco / Infrastructure",
  "Other",
] as const;

export const SELLER_SIZES = ["1-10", "11-50", "51-200", "201-1000", "1000+"] as const;

export const FRICTION_EVENTS = [
  "Security questionnaire",
  "SOC 2 / pen test required",
  "Legal redlines on MSA",
  "Pilot / POC required",
  "Reference calls required",
  "Vendor onboarding portal",
  "Reverse auction / e-procurement",
] as const;

export const VERBAL_TO_SIGNATURE = [
  "< 1 Week",
  "1-4 Weeks",
  "1-3 Months",
  "3+ Months",
  "No verbal commit",
  "Unknown",
] as const;

export const CLOSE_SLIPPAGE = [
  "Never pushed",
  "Pushed once",
  "Pushed twice",
  "Pushed 3+ times",
  "Unknown",
] as const;

export const PAYMENT_TERMS = ["Net 30", "Net 60", "Net 90", "Net 120+", "Unknown / N/A"] as const;

export const PROCUREMENT_ENTRY = [
  "Early (before shortlist)",
  "Mid-cycle",
  "After verbal commit",
  "Never involved",
  "Unknown",
] as const;

export const STAKEHOLDER_COUNTS = ["1-2", "3-5", "6-10", "10+"] as const;

/** Coerce `v` to a member of `list`, else `fallback`. */
export function enumOr(list: readonly string[], v: unknown, fallback: string): string {
  return typeof v === "string" && list.includes(v) ? v : fallback;
}
```

- [ ] **Step 2: Extend `ReviewPayload` and `sanitize` in `reviewSubmission.ts`**

Add the import at the top:

```ts
import {
  TCV_BRACKETS,
  DURATION_BRACKETS,
  OUTCOMES,
  DEAL_TYPES,
  DEAL_REGIONS,
  CURRENCIES,
  SELLER_CATEGORIES,
  SELLER_SIZES,
  FRICTION_EVENTS,
  VERBAL_TO_SIGNATURE,
  CLOSE_SLIPPAGE,
  PAYMENT_TERMS,
  PROCUREMENT_ENTRY,
  STAKEHOLDER_COUNTS,
  enumOr,
} from "./lib/reviewSchema";
```

Extend the `ReviewPayload` interface — change `status` and append the v2 fields:

```ts
  status: "Won" | "Lost" | "No Decision" | "Withdrew" | "Ongoing";
  // ... existing fields unchanged ...
  schemaVersion: number;
  dealType: string;
  dealRegion: string;
  dealPeriod: string;
  sellerCategory: string;
  sellerSize: string;
  frictionEvents: string[];
  verbalToSignature: string;
  closeSlippage: string;
  wentDark: boolean;
  paymentTerms: string;
  procurementEntry: string;
  stakeholderCount: string;
```

In `sanitize`, replace the `outcome` line:

```ts
const outcome = enumOr(OUTCOMES, data?.status, "Ongoing") as ReviewPayload["status"];
```

Add above the `return`:

```ts
// Deal period is client-generated ("Q3 2026" / "Older") — validate shape, not membership.
const dealPeriodRaw = str(data?.dealPeriod).trim();
const dealPeriod =
  /^Q[1-4] 20\d{2}$/.test(dealPeriodRaw) || dealPeriodRaw === "Older" ? dealPeriodRaw : "Older";

const frictionEvents = Array.isArray(data?.frictionEvents)
  ? data.frictionEvents.filter((e: unknown) => typeof e === "string" && (FRICTION_EVENTS as readonly string[]).includes(e))
  : [];
```

And extend the returned object — change `currency` and `tcvBracket`/`cycleDuration` to validated versions, and append the v2 fields:

```ts
  currency: enumOr(CURRENCIES, data?.currency, "USD"),
  tcvBracket: enumOr(TCV_BRACKETS, data?.tcvBracket, TCV_BRACKETS[0]),
  cycleDuration: enumOr(DURATION_BRACKETS, data?.cycleDuration, DURATION_BRACKETS[0]),
  // ... existing fields ...
  schemaVersion: 2,
  dealType: enumOr(DEAL_TYPES, data?.dealType, DEAL_TYPES[0]),
  dealRegion: enumOr(DEAL_REGIONS, data?.dealRegion, "Global / Multi-region"),
  dealPeriod,
  sellerCategory: enumOr(SELLER_CATEGORIES, data?.sellerCategory, "Other"),
  sellerSize: enumOr(SELLER_SIZES, data?.sellerSize, SELLER_SIZES[0]),
  frictionEvents,
  verbalToSignature: enumOr(VERBAL_TO_SIGNATURE, data?.verbalToSignature, "Unknown"),
  closeSlippage: enumOr(CLOSE_SLIPPAGE, data?.closeSlippage, "Unknown"),
  wentDark: !!data?.wentDark,
  paymentTerms: enumOr(PAYMENT_TERMS, data?.paymentTerms, "Unknown / N/A"),
  procurementEntry: enumOr(PROCUREMENT_ENTRY, data?.procurementEntry, "Unknown"),
  stakeholderCount: enumOr(STAKEHOLDER_COUNTS, data?.stakeholderCount, STAKEHOLDER_COUNTS[0]),
```

Note: `resubmitReview` calls `sanitize({ ...existing, ...request.data })`, so a resubmitted legacy review passes its old `"$1M+"` bracket through — that's why the legacy values are in the server-side accept lists. A resubmitted v1 review gets stamped `schemaVersion: 2` with `Unknown`-default friction fields; acceptable (rejected reviews are re-edited through the new form anyway).

- [ ] **Step 3: Build functions**

Run: `npm run build -w functions`
Expected: compiles clean.

- [ ] **Step 4: Commit**

```bash
git add functions/src/lib/reviewSchema.ts functions/src/reviewSubmission.ts
git commit -m "feat(functions): validate and persist review schema v2 fields"
```

No CI workflow change: `submitReview` and `resubmitReview` are already in the `--only` allowlist in `.github/workflows/deploy-functions.yml` (line 54). No firestore.rules change: clients cannot create reviews directly; all writes flow through the callables.

---

### Task 6: ReviewCard — display v2 context chips

**Files:**
- Modify: `src/components/intel/ReviewCard.tsx`

- [ ] **Step 1: Add chips**

In the footer chip row (the `div` containing `{r.tcvBracket}`), after the `isTender` span and before the `buyingTeam` map, add:

```tsx
{r.dealType && <span>· {r.dealType}</span>}
{r.dealRegion && <span>· {r.dealRegion}</span>}
{r.dealPeriod && <span>· {r.dealPeriod}</span>}
```

Also update the status badge class logic so the new outcomes get styling — replace the ternary:

```tsx
className={`text-2xs font-semibold rounded-control px-3 py-1 ${
  r.status === "Won"
    ? "bg-emerald-50 text-signal-healthy"
    : r.status === "Lost" || r.status === "No Decision"
      ? "bg-rose-50 text-signal-risk"
      : r.status === "Withdrew"
        ? "bg-amber-50 text-signal-caution"
        : "bg-navy-50 text-accent"
}`}
```

(If `text-signal-caution` is not a defined Tailwind token in this project, use `text-amber-600` — check `tailwind.config` before choosing.)

- [ ] **Step 2: Run existing component tests + type-check**

Run: `npx vitest run src/components/intel && npm run type-check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/intel/ReviewCard.tsx
git commit -m "feat(review): show deal type, region, period on review cards"
```

---

### Task 7: GlobalTrends — normalization, No Decision rate, Friction Index, new filters

**Files:**
- Modify: `pages/GlobalTrends.tsx`

- [ ] **Step 1: Imports**

Add to the existing imports:

```ts
import { DEAL_TYPES, DEAL_REGIONS } from "../src/constants/dealData";
import { normalizeTcvBracket, normalizeDurationBracket, frictionScore } from "../src/utils/reviewSchema";
```

- [ ] **Step 2: New filters**

Add state next to the existing filters:

```ts
const [filterDealType, setFilterDealType] = useState('all');
const [filterRegion, setFilterRegion] = useState('all');
```

Extend `filteredReviews`:

```ts
const filteredReviews = useMemo(() => {
  return reviews.filter(r => {
    const matchIndustry = filterIndustry === 'all' || r.industry === filterIndustry;
    const matchTeam = filterTeam === 'all' || r.buyingTeam.includes(filterTeam);
    const matchDealType = filterDealType === 'all' || r.dealType === filterDealType;
    const matchRegion = filterRegion === 'all' || r.dealRegion === filterRegion;
    return matchIndustry && matchTeam && matchDealType && matchRegion;
  });
}, [reviews, filterIndustry, filterTeam, filterDealType, filterRegion]);
```

In the filter bar JSX, after the Department Persona select, add two more selects using the identical wrapper/label/select classes:

```tsx
<div className="flex-1 min-w-[200px]">
  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Deal Type</label>
  <select value={filterDealType} onChange={(e) => setFilterDealType(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 focus:border-accent/30 focus:bg-white rounded-xl px-5 py-4 text-sm font-bold text-slate-700 outline-none transition-all cursor-pointer">
    <option value="all">All Deal Types</option>
    {DEAL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
  </select>
</div>
<div className="flex-1 min-w-[200px]">
  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Region</label>
  <select value={filterRegion} onChange={(e) => setFilterRegion(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 focus:border-accent/30 focus:bg-white rounded-xl px-5 py-4 text-sm font-bold text-slate-700 outline-none transition-all cursor-pointer">
    <option value="all">All Regions</option>
    {DEAL_REGIONS.map(t => <option key={t} value={t}>{t}</option>)}
  </select>
</div>
```

Note: v1 reviews have no `dealType`/`dealRegion`, so any non-`all` selection on those filters excludes legacy reviews. Intended.

- [ ] **Step 3: Stats — No Decision rate and Friction Index**

Inside the `stats` memo, after the `wins` line add:

```ts
const noDecisions = filteredReviews.filter(r => r.status === 'No Decision').length;

const frictionScores = filteredReviews
  .map(frictionScore)
  .filter((n): n is number => n !== null);
const frictionIndex = frictionScores.length
  ? Math.round(frictionScores.reduce((a, b) => a + b, 0) / frictionScores.length)
  : null;
```

Change the matrix fill loop to normalize legacy brackets:

```ts
filteredReviews.forEach(r => {
  const d = normalizeDurationBracket(r.cycleDuration);
  const t = normalizeTcvBracket(r.tcvBracket);
  if (d && t) {
    matrix[d][t].count++;
    if (r.status === 'Won') matrix[d][t].wins++;
  }
});
```

Extend the memo's return:

```ts
return {
  total: filteredReviews.length,
  winRate: Math.round((wins / total) * 100),
  noDecisionRate: Math.round((noDecisions / total) * 100),
  frictionIndex,
  frictionSample: frictionScores.length,
  topIndustries,
  matrix,
  departments,
};
```

- [ ] **Step 4: Stat cards row**

Replace the four `StatSummaryCard`s in the paid view with:

```tsx
<StatSummaryCard label="Verified Reports" value={stats.total} icon="fa-fingerprint" />
<StatSummaryCard label="Global Win Rate" value={`${stats.winRate}%`} icon="fa-trophy" color="text-emerald-500" />
<StatSummaryCard label="No Decision Rate" value={`${stats.noDecisionRate}%`} icon="fa-hourglass-half" color="text-amber-500" />
<StatSummaryCard
  label="Friction Index"
  value={stats.frictionIndex !== null ? `${stats.frictionIndex}` : "—"}
  icon="fa-gauge-high"
  color="text-rose-500"
/>
```

(The "Legal Friction" and "Markets" cards are replaced; department friction stays visible in the Friction Map panel below.)

- [ ] **Step 5: Type-check + full test suite**

Run: `npm run type-check && npm test`
Expected: PASS. If `pages/CompanyProfile.test.tsx` or `src/components/intel/EvidenceList.test.tsx` construct `Review` fixtures with `"$1M+"` / `"12+ Months"` / a 3-value `status` union, those fixtures still type-check (fields are strings / union widened) — fix only if failures appear.

- [ ] **Step 6: Commit**

```bash
git add pages/GlobalTrends.tsx
git commit -m "feat(trends): no-decision rate, friction index, deal-type and region filters, legacy bracket normalization"
```

---

### Task 8: Full verification + deploy

**Files:** none (verification only)

- [ ] **Step 1: Full local gate**

Run: `npm run type-check && npm test && npm run build && npm run build -w functions`
Expected: all PASS.

- [ ] **Step 2: Manual browser verification (dev server)**

Start the frontend dev server (Browser-pane preview, not Bash) and on `/create-review` (route per app router — find the route path via `grep -n "CreateReview" App.tsx` if unsure) verify:
1. Deal Logistics shows 6 cards (Outcome, TCV, Cycle, RFx, Deal Type, Region Sold Into); TCV dropdown reaches `$10M+`; Cycle dropdown reaches `24+ Months`; Outcome dropdown shows all 5 outcomes. Selecting a US company auto-sets Region to "North America"; changing Region manually then re-picking a company does NOT overwrite it.
2. **Reviewer speed check (the point of the redesign):** the "Deal Details (optional, ~60 seconds)" expander is COLLAPSED by default, carries no section number, and the form is fully submittable without ever opening it. Sections still read 1–4. Expanding shows 7 gauntlet toggles, 9 selects, and the went-dark toggle.
3. Submit button stays disabled until the write-up hits 50 words (type 49 words → disabled; 50 → enabled, assuming everything else filled). Word counter and gate agree.
4. Submit a review with the optional section untouched → succeeds; then revisit `/create-review` and confirm Deal Currency / What You Sell / Your Company Size are prefilled from the previous submission (localStorage).
5. GlobalTrends renders with the 4 new/changed stat cards and 4 filters, no console errors (v1 data shows "—" Friction Index).

- [ ] **Step 3: Emulator smoke test of `submitReview`** *(optional but recommended)*

Run: `npm run serve -w functions`, point the frontend at the emulator if the project supports it, submit a review, confirm the Firestore doc contains `schemaVersion: 2` and the friction fields. If emulator wiring is not already set up in the frontend, skip — the sanitize path is exercised in prod on first submission and defaults are safe.

- [ ] **Step 4: Push (deploys via GitHub Actions)**

```bash
git push origin main
```

Watch https://github.com/brendanreid-droid/DealEcho/actions — the reviews deploy step (`functions:submitReview,functions:resubmitReview,functions:onReviewWritten`) must go green. Per project memory: if a 409 conflict appears, wait and re-run the job; do not rapid-fire redeploys.

- [ ] **Step 5: Post-deploy prod check**

Submit one real review on dealecho.io against a test company; confirm it lands in Firestore with `schemaVersion: 2` and appears in the admin moderation queue.

---

## Out of scope (explicitly deferred)

- **Firestore migration of legacy reviews** — handled by read-time normalization; revisit only if legacy volume ever matters.
- **Verbal-to-signature league table / stakeholder inflation curves** — needs v2 data volume first; build once ≥50 v2 reviews exist.
- **Per-company Friction Index on CompanyProfile** — same data-volume gate; the `frictionScore` util is ready for it.
- **Moderation prompt changes** — `onReviewWritten` moderates `content` only; new enum fields are server-validated and need no AI moderation.
- **Currency-localized TCV brackets** — brackets stay USD-denominated by design; `currency` field records native currency for future use.
