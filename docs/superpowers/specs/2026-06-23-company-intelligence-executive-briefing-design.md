# Company Intelligence Page — "Executive Briefing" Redesign (Option B)

**Date:** 2026-06-23
**Status:** Design — pending implementation plan
**Surface:** `pages/CompanyProfile.tsx` (the core Company Intelligence / Review page)
**Author:** Design session with Brendan

---

## 1. Overview

Redesign the Company Intelligence page from its current low-density, hover-dependent
layout into an **AI-led executive brief**: a rep gets a verdict and the red flags
*above the fold*, then drills into a playbook and the raw review evidence only if they
choose to. The page reads top-to-bottom as a single priority spine.

This is the "Option B — Executive Briefing" direction chosen over "Option A — Bloomberg
Terminal" and the A+B hybrid. It best fits the confirmed product context: the highest-value
first glance is **red flags + buyer health/trend**, and the page must stay clean while still
being dense with meaning.

### Goals
- Surface the decision (verdict + red flags) before any interaction.
- Make "what will hurt me on this account?" the loudest thing on the page.
- Show whether the account is getting easier or harder to sell into (trend).
- Demote raw reviews to citations behind the AI summary.
- Fix the accessibility and density problems in the current page along the way.

### Non-goals (this spec)
- Building the real server-side Gemini extraction. We build to a **frozen contract**
  fed by a derived/mock stub; real extraction is a follow-up spec (see §4).
- Option A (data grid) and the hybrid. Documented in chat history; not built.
- Changes to `CreateReview` / the review submission flow or the data schema in `types.ts`.

---

## 2. Locked decisions

| Decision | Choice | Rationale |
|---|---|---|
| Direction | Option B — Executive Briefing | Matches "flags + health/trend first", clean card layout |
| Primary device | Desktop power use, mobile-graceful | Critical path identical on both (single column spine) |
| Component library | Add `@radix-ui` primitives | Accessibility (focus, aria, keyboard) for free; small bundle add |
| Signal layer scope | **Frontend-first against a frozen `AccountSignal` contract**, fed by a derived/mock stub | AI extraction is the riskiest, least-deterministic piece; don't block UI on prompt tuning. Contract is the seam for parallel work. |
| Free-tier experience | **Verdict + flags teaser**, gate playbook/evidence/flag-details | "Aha then upgrade" converts better than a hard wall; preserves the JSON-LD SEO payoff already built in |

---

## 3. Information architecture — the priority spine

A single centered column. Sections render in strict priority order, top to bottom:

1. **Verdict card** *(always visible, incl. free + crawlers)*
   - Reuses existing `ScoreRing` (`src/components/ScoreRing.tsx`) for buyer health 0–100.
   - Health value + **trend delta** (e.g. "↓ 8 this quarter") with a signal-color chip.
   - One-line AI take (`AccountSignal.headline`) — the "how to win this account" sentence.
   - Company identity (logo, name, industry · country · N reports) — currently in the
     oversized header; folded in here.

2. **Red flags** *(teased to free, full to Pro)*
   - Cards, severity-sorted, **critical pinned first**.
   - Each card: flag label, severity, report count, and the supporting `evidence` quote.
   - Left accent border in signal color (`risk` = critical, `caution` = caution).
   - **Free users:** see the count and labels with evidence quotes blurred + an
     "Unlock N flags" CTA. **Pro users:** full cards.

3. **Trend strip** *(Pro)*
   - 4 metric tiles (Responsiveness, Negotiation Ease, Buyer Intent, Scope Maturity).
   - Each: current average + a direction arrow (↑/→/↓) colored by signal palette.
   - Source: existing 4 ratings bucketed by `createdAt` quarter — no new input data.

4. **AI playbook** *(Pro, collapsible)*
   - Radix `Accordion`. Renders the existing `CompanyPersona.meddpicc` blueprint
     (`services/geminiService.ts` — already produced by `getAICompanyPersona`).
   - Per-buying-team switching via Radix `Tabs` (formalizes today's `selectedTeam` filter).

5. **Evidence** *(Pro, lazy, below fold)*
   - The raw review cards, demoted. Radix `Accordion` ("show all N verified reports").
   - Keeps current per-review detail (ratings, TCV, duration, tender, buying team, content)
     but at corrected density (see §6).
   - Retains existing sort + buying-team filter controls.

### F-pattern / scan order
On desktop the spine *is* the F-pattern collapsed to a vertical priority stroke: verdict →
flags → trend, all before raw data. On mobile the same order holds unchanged — the critical
path is device-independent, which is the structural advantage of B.

---

## 4. The `AccountSignal` contract (the seam)

This is the single interface that decouples the UI from the AI backend. Frozen first;
both sides build against it.

```ts
// services/accountSignal.ts (new)
export type FlagType =
  | 'ghosting' | 'tire_kicker' | 'ip_risk' | 'brutal_procurement'
  | 'champion_loss' | 'scope_creep' | 'legal_friction' | 'budget_freeze';

export interface Flag {
  type: FlagType;
  severity: 'critical' | 'caution';
  evidence: string;        // supporting quote/source from review content
  reviewIds: string[];     // reviews that triggered this flag
}

export interface MetricTrend {
  metric: 'responsiveness' | 'negotiation' | 'intent' | 'scope';
  current: number;                 // 1–5 average, latest window
  direction: 'up' | 'down' | 'flat';
  points: number[];                // per-quarter averages, oldest → newest
}

export interface AccountSignal {
  headline: string;                // one-line AI take for the verdict card
  sentiment: 'positive' | 'neutral' | 'negative';
  flags: Flag[];                   // severity-sorted, critical first
  trend: MetricTrend[];
}

// Frontend-first: derived stub. Same sessionStorage cache pattern as getAICompanyPersona.
export const getAccountSignal = async (
  companyName: string,
  reviews: Review[],
): Promise<AccountSignal> => { /* derived heuristics for now; Gemini later */ };
```

### Stub behaviour (ships in this spec)
Derive a believable signal from existing fields so the UI is fully functional without the
backend:
- `headline` / `sentiment`: from aggregate health band + win/loss ratio.
- `flags`: heuristics on existing data — e.g. `status === 'Lost'` clusters → relevant flag;
  `timeWasterLevel <= 2` → `tire_kicker`; `communicationRating <= 2` → `ghosting`;
  `negotiationLevel <= 2` → `brutal_procurement`. `evidence` pulls the matching review's
  `content`. (Heuristic only — clearly marked TODO for AI replacement.)
- `trend`: bucket the 4 ratings by `createdAt` quarter, compare last two windows.

### Follow-up (separate spec, out of scope here)
Replace the stub body with a Gemini Cloud Function in `functions/` that extracts structured
flags + sentiment from review `content` server-side and stores them on the review. The
contract and all UI stay unchanged — only the function body swaps.

---

## 5. Component strategy

New deps: `@radix-ui/react-accordion`, `@radix-ui/react-tabs`,
`@radix-ui/react-tooltip`, `@radix-ui/react-hover-card`. Headless — styled entirely with
existing Tailwind tokens (`tailwind.config.js`: `navy`, `accent`, `signal`, `font-display`,
`font-mono`, `rounded-card`/`-control`).

| Section | Component | Notes |
|---|---|---|
| Verdict ring | reuse `ScoreRing` | no change |
| Trend arrow | new `TrendArrow` | tiny; signal-colored ↑/→/↓ |
| Sparkline (optional) | inline SVG `polyline` | ~30 lines, no chart lib |
| Flag card | new `FlagCard` | severity accent border, evidence quote, Pro gate |
| Flag drill-down | Radix `HoverCard` / `Popover` | source reviews on focus or hover (accessible both) |
| Playbook | Radix `Accordion` + `Tabs` | renders existing `CompanyPersona.meddpicc` |
| Evidence list | Radix `Accordion` | lazy; reuses review-card markup at fixed density |
| Rating definitions | Radix `Tooltip` | **replaces** the broken hover-only tooltip in `TacticalStars` |

### File plan
- `pages/CompanyProfile.tsx` — recompose into the spine; extract sub-components below.
- `src/components/intel/VerdictCard.tsx`, `FlagCard.tsx`, `TrendStrip.tsx`,
  `Playbook.tsx`, `EvidenceList.tsx` — new, one purpose each.
- `services/accountSignal.ts` — the contract + stub.
- `CompanyProfile.tsx` drops from ~785 lines to a thin composition shell. Each sub-component
  is independently understandable and testable.

---

## 6. Design requirements (apply across all sections)

### Density without noise
- Remove the oversized aesthetic: replace `rounded-[48px]`/`rounded-[40px]` with
  `rounded-card` (16px); drop `p-12`/`p-16` to ≤ `p-6`. Goal: more than one meaningful
  unit per viewport.

### Accessibility — WCAG 2.1 AA (hard rules)
- **No type below 11px.** Retire all `text-[8px]`/`text-[9px]`/`text-[10px]`; honor the
  theme's own minimum. Body labels at `slate-600`+ for ≥ 4.5:1 contrast.
- **Color is never the only signal.** Every `signal`-colored element (flag severity, trend
  direction) pairs color with an icon and/or text label — color-blind safe.
- **All tooltips focus-triggered and dismissible** via Radix `Tooltip` (satisfies 1.4.13);
  remove `onMouseEnter/Leave`-only patterns.
- Radix gives focus-trapping, `aria-*`, and keyboard semantics for accordions/tabs/dialogs.

### Mobile-responsive critical path
- Single-column spine is the mobile layout by default; verdict → flags → trend stay first.
- Trend strip: 4-up on desktop, 2×2 on mobile. Flag/evidence cards full-width stacked.

---

## 7. Free vs Pro gating

| Section | Free | Pro |
|---|---|---|
| Verdict card (health, trend delta, headline) | ✅ visible (also for SEO/crawlers) | ✅ |
| Red flags | Count + labels; **evidence blurred** + "Unlock N flags" CTA | ✅ full cards |
| Trend strip | Gated (upgrade prompt) | ✅ |
| AI playbook | Gated (existing upgrade card pattern) | ✅ |
| Evidence / reviews | Gated (existing pattern) | ✅ |

The verdict + flag teaser is the upgrade hook and the crawlable content that preserves the
JSON-LD `aggregateRating` SEO investment already in `CompanyProfile.tsx`.

---

## 8. Testing

- **Contract:** unit-test the `getAccountSignal` stub — given fixture reviews, asserts
  expected flags, severities, sentiment, and trend directions.
- **Gating:** render tests for free vs Pro across each section.
- **A11y:** keyboard-only walkthrough (tab order, accordion/tab operation, tooltip
  dismiss); automated axe check; contrast verification on signal colors + labels.
- **Responsive:** verify spine order and trend-strip reflow at mobile width.

---

## 9. Open items for the implementation plan
- Confirm exact `@radix-ui` package set / versions and bundle impact.
- Decide whether the optional verdict sparkline ships in v1 or is deferred.
- Define the blur treatment for free-tier flag evidence (CSS blur vs redacted text).
