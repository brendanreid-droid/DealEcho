# Company Intelligence "Executive Briefing" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `pages/CompanyProfile.tsx` as an AI-led "Executive Briefing" — a verdict + red-flag spine above the fold, with playbook and raw reviews behind progressive disclosure.

**Architecture:** Frontend-first against a frozen `AccountSignal` contract fed by a derived heuristic stub (real Gemini extraction is a later spec). `CompanyProfile.tsx` is decomposed from one ~785-line file into a thin composition shell plus small single-purpose components under `src/components/intel/`. Radix headless primitives provide accessible accordions/tabs/tooltips, styled with existing Tailwind tokens.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind, `@radix-ui/*`, `lucide-react`. Tests: Vitest + React Testing Library + jsdom (added in Task 0).

**Spec:** `docs/superpowers/specs/2026-06-23-company-intelligence-executive-briefing-design.md`

---

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `vitest.config.ts`, `src/test/setup.ts` | Test harness | 0 |
| `services/accountSignal.ts` | `AccountSignal` contract + derived stub (the seam) | 1 |
| `services/accountSignal.test.ts` | Unit tests for the stub | 1 |
| `src/components/intel/TrendArrow.tsx` | Signal-colored ↑/→/↓ indicator | 2 |
| `src/components/intel/VerdictCard.tsx` | Health ring + trend delta + AI headline + identity | 3 |
| `src/components/intel/FlagCard.tsx` | One red flag, with Pro gate / blur | 4 |
| `src/components/intel/FlagList.tsx` | Severity-sorted flag list + free-tier teaser | 4 |
| `src/components/intel/TrendStrip.tsx` | 4 metric tiles with direction arrows | 5 |
| `src/components/intel/Playbook.tsx` | Radix Accordion + Tabs over existing `CompanyPersona.meddpicc` | 6 |
| `src/components/intel/EvidenceList.tsx` | Radix Accordion of review cards + sort/team filter | 7 |
| `src/components/intel/ReviewCard.tsx` | One review at corrected density; Radix Tooltip ratings | 7 |
| `pages/CompanyProfile.tsx` | Thin spine composing the above + gating | 8 |

---

## Task 0: Test harness + dependencies

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `src/test/setup.ts`

- [ ] **Step 1: Install dependencies**

Run:
```bash
npm install @radix-ui/react-accordion @radix-ui/react-tabs @radix-ui/react-tooltip @radix-ui/react-hover-card
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

- [ ] **Step 2: Add scripts to `package.json`**

In the `"scripts"` block, add:
```json
    "test": "vitest run",
    "test:watch": "vitest",
    "type-check": "tsc --noEmit"
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
  },
});
```

- [ ] **Step 4: Create `src/test/setup.ts`**

```ts
import "@testing-library/jest-dom";
```

- [ ] **Step 5: Add a smoke test to verify the harness**

Create `src/test/smoke.test.ts`:
```ts
import { describe, it, expect } from "vitest";

describe("test harness", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 6: Run it**

Run: `npm test`
Expected: PASS (1 test passed).

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json vitest.config.ts src/test/
git commit -m "chore: add vitest + RTL test harness and radix deps"
```

---

## Task 1: `AccountSignal` contract + derived stub

This is the seam. Everything downstream consumes this interface.

**Files:**
- Create: `services/accountSignal.ts`
- Test: `services/accountSignal.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `services/accountSignal.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { getAccountSignal } from "./accountSignal";
import { Review } from "../types";

const base: Review = {
  id: "r1", companyId: "c1", companyName: "Acme", userId: "u1",
  userName: "Verified", currency: "USD", tcvBracket: "$50k - $100k",
  cycleDuration: "3-6 Months", status: "Won", isTender: false,
  buyingTeam: ["Procurement"], location: "US",
  communicationRating: 5, negotiationLevel: 5, timeWasterLevel: 5,
  clarityOfScope: 5, industry: "SaaS", country: "US",
  content: "Smooth deal.", createdAt: "2026-03-01T00:00:00.000Z",
};

const r = (over: Partial<Review>): Review => ({ ...base, ...over });

describe("getAccountSignal", () => {
  it("returns negative sentiment when ratings are low", async () => {
    const sig = await getAccountSignal("Acme", [
      r({ id: "a", status: "Lost", communicationRating: 1, negotiationLevel: 1, timeWasterLevel: 1, clarityOfScope: 1 }),
    ]);
    expect(sig.sentiment).toBe("negative");
    expect(sig.headline.length).toBeGreaterThan(0);
  });

  it("raises a ghosting flag for very low responsiveness", async () => {
    const sig = await getAccountSignal("Acme", [
      r({ id: "g", communicationRating: 1, content: "They ghosted us after the POC." }),
    ]);
    const ghost = sig.flags.find((f) => f.type === "ghosting");
    expect(ghost).toBeDefined();
    expect(ghost!.reviewIds).toContain("g");
    expect(ghost!.evidence).toContain("ghosted");
  });

  it("sorts critical flags before caution flags", async () => {
    const sig = await getAccountSignal("Acme", [
      r({ id: "x", negotiationLevel: 2, content: "Procurement opened at a 40% discount demand." }),
      r({ id: "y", content: "The champion left the company two weeks before signature." }),
    ]);
    expect(sig.flags.length).toBeGreaterThanOrEqual(2);
    expect(sig.flags[0].severity).toBe("critical");
  });

  it("computes a downward trend when later reviews score worse", async () => {
    const sig = await getAccountSignal("Acme", [
      r({ id: "old", createdAt: "2025-01-01T00:00:00.000Z", communicationRating: 5 }),
      r({ id: "new", createdAt: "2026-03-01T00:00:00.000Z", communicationRating: 1 }),
    ]);
    const resp = sig.trend.find((t) => t.metric === "responsiveness");
    expect(resp!.direction).toBe("down");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- accountSignal`
Expected: FAIL with "Failed to resolve import './accountSignal'".

- [ ] **Step 3: Implement `services/accountSignal.ts`**

```ts
import { Review } from "../types";

export type FlagType =
  | "ghosting" | "tire_kicker" | "ip_risk" | "brutal_procurement"
  | "champion_loss" | "scope_creep" | "legal_friction" | "budget_freeze";

export interface Flag {
  type: FlagType;
  severity: "critical" | "caution";
  evidence: string;
  reviewIds: string[];
}

export interface MetricTrend {
  metric: "responsiveness" | "negotiation" | "intent" | "scope";
  current: number;
  direction: "up" | "down" | "flat";
  points: number[];
}

export interface AccountSignal {
  headline: string;
  sentiment: "positive" | "neutral" | "negative";
  flags: Flag[];
  trend: MetricTrend[];
}

const CRITICAL_TYPES: FlagType[] = ["champion_loss", "ip_risk", "budget_freeze"];

interface FlagRule {
  type: FlagType;
  keywords: string[];
  rating?: (r: Review) => boolean;
}

const RULES: FlagRule[] = [
  { type: "ghosting", keywords: ["ghost"], rating: (r) => r.communicationRating <= 2 },
  { type: "tire_kicker", keywords: ["tire kicker", "tire-kicker", "benchmark"], rating: (r) => r.timeWasterLevel <= 2 },
  { type: "brutal_procurement", keywords: ["procurement", "discount", "reverse-auction"], rating: (r) => r.negotiationLevel <= 2 },
  { type: "scope_creep", keywords: ["scope creep", "scope"], rating: (r) => r.clarityOfScope <= 2 },
  { type: "champion_loss", keywords: ["champion left", "champion was", "lost the deal", "vetoed"] },
  { type: "ip_risk", keywords: ["build a basic version", "internally", "implementation logic"] },
  { type: "legal_friction", keywords: ["msa", "legal", "indemnity", "liability"] },
  { type: "budget_freeze", keywords: ["budget freeze", "freeze", "merger"] },
];

function healthIndex(reviews: Review[]): number {
  if (reviews.length === 0) return 0;
  const total = reviews.reduce(
    (a, r) => a + r.communicationRating + r.negotiationLevel + r.timeWasterLevel + (r.clarityOfScope || 3),
    0,
  );
  return Math.round((total / (reviews.length * 20)) * 100);
}

function buildFlags(reviews: Review[]): Flag[] {
  const byType = new Map<FlagType, Flag>();
  for (const r of reviews) {
    const text = r.content.toLowerCase();
    for (const rule of RULES) {
      const kw = rule.keywords.find((k) => text.includes(k));
      const ratingHit = rule.rating ? rule.rating(r) : false;
      if (!kw && !ratingHit) continue;
      const existing = byType.get(rule.type);
      if (existing) {
        existing.reviewIds.push(r.id);
        if (!existing.evidence && kw) existing.evidence = r.content;
      } else {
        byType.set(rule.type, {
          type: rule.type,
          severity: CRITICAL_TYPES.includes(rule.type) ? "critical" : "caution",
          evidence: kw ? r.content : "",
          reviewIds: [r.id],
        });
      }
    }
  }
  return Array.from(byType.values()).sort(
    (a, b) => Number(b.severity === "critical") - Number(a.severity === "critical"),
  );
}

function quarter(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}-Q${Math.floor(d.getUTCMonth() / 3) + 1}`;
}

function buildTrend(reviews: Review[]): MetricTrend[] {
  const metrics: { metric: MetricTrend["metric"]; pick: (r: Review) => number }[] = [
    { metric: "responsiveness", pick: (r) => r.communicationRating },
    { metric: "negotiation", pick: (r) => r.negotiationLevel },
    { metric: "intent", pick: (r) => r.timeWasterLevel },
    { metric: "scope", pick: (r) => r.clarityOfScope || 3 },
  ];
  const quarters = Array.from(new Set(reviews.map((r) => quarter(r.createdAt)))).sort();
  return metrics.map(({ metric, pick }) => {
    const points = quarters.map((q) => {
      const inQ = reviews.filter((r) => quarter(r.createdAt) === q);
      return inQ.length ? inQ.reduce((a, r) => a + pick(r), 0) / inQ.length : 0;
    });
    const current = points.length ? points[points.length - 1] : 0;
    const prev = points.length > 1 ? points[points.length - 2] : current;
    const diff = current - prev;
    const direction: MetricTrend["direction"] = diff > 0.2 ? "up" : diff < -0.2 ? "down" : "flat";
    return { metric, current: Number(current.toFixed(1)), direction, points };
  });
}

function headlineFor(sentiment: AccountSignal["sentiment"]): string {
  switch (sentiment) {
    case "positive": return "Receptive account with healthy momentum — lead with value and move quickly.";
    case "neutral": return "Mixed signals — qualify hard and secure a strong champion before investing.";
    case "negative": return "High-friction account — expect procurement and stakeholder risk; protect your terms.";
  }
}

// Frontend-first derived stub. Replace body with Gemini extraction in a later spec; contract stays fixed.
export const getAccountSignal = async (
  _companyName: string,
  reviews: Review[],
): Promise<AccountSignal> => {
  const health = healthIndex(reviews);
  const sentiment: AccountSignal["sentiment"] =
    health >= 67 ? "positive" : health >= 45 ? "neutral" : "negative";
  return {
    headline: headlineFor(sentiment),
    sentiment,
    flags: buildFlags(reviews),
    trend: buildTrend(reviews),
  };
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- accountSignal`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add services/accountSignal.ts services/accountSignal.test.ts
git commit -m "feat: add AccountSignal contract with derived heuristic stub"
```

---

## Task 2: `TrendArrow` component

**Files:**
- Create: `src/components/intel/TrendArrow.tsx`
- Test: `src/components/intel/TrendArrow.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import TrendArrow from "./TrendArrow";

describe("TrendArrow", () => {
  it("labels direction for screen readers", () => {
    render(<TrendArrow direction="down" />);
    expect(screen.getByLabelText(/declining/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- TrendArrow`
Expected: FAIL (cannot resolve import).

- [ ] **Step 3: Implement `src/components/intel/TrendArrow.tsx`**

```tsx
import React from "react";
import { ArrowUp, ArrowRight, ArrowDown } from "lucide-react";

type Direction = "up" | "down" | "flat";

const CONFIG: Record<Direction, { Icon: typeof ArrowUp; className: string; label: string }> = {
  up: { Icon: ArrowUp, className: "text-signal-healthy", label: "improving" },
  flat: { Icon: ArrowRight, className: "text-slate-400", label: "steady" },
  down: { Icon: ArrowDown, className: "text-signal-risk", label: "declining" },
};

const TrendArrow: React.FC<{ direction: Direction; size?: number }> = ({ direction, size = 14 }) => {
  const { Icon, className, label } = CONFIG[direction];
  return (
    <span className={`inline-flex items-center ${className}`} role="img" aria-label={label}>
      <Icon size={size} aria-hidden="true" />
    </span>
  );
};

export default TrendArrow;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- TrendArrow`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/intel/TrendArrow.tsx src/components/intel/TrendArrow.test.tsx
git commit -m "feat: add TrendArrow component"
```

---

## Task 3: `VerdictCard` component

**Files:**
- Create: `src/components/intel/VerdictCard.tsx`
- Test: `src/components/intel/VerdictCard.test.tsx`

Reuses existing `src/components/ScoreRing.tsx`.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import VerdictCard from "./VerdictCard";

describe("VerdictCard", () => {
  it("shows health, trend delta, headline and report count", () => {
    render(
      <VerdictCard
        name="Snowflake"
        meta="Data warehousing · United States"
        health={62}
        healthDelta={-8}
        headline="High-friction account."
        reportCount={14}
      />,
    );
    expect(screen.getByText("Snowflake")).toBeInTheDocument();
    expect(screen.getByText("High-friction account.")).toBeInTheDocument();
    expect(screen.getByText(/14 reports/i)).toBeInTheDocument();
    expect(screen.getByText(/8/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- VerdictCard`
Expected: FAIL (cannot resolve import).

- [ ] **Step 3: Implement `src/components/intel/VerdictCard.tsx`**

```tsx
import React from "react";
import ScoreRing from "../ScoreRing";

interface VerdictCardProps {
  name: string;
  meta: string;
  health: number;
  healthDelta: number;
  headline: string;
  reportCount: number;
}

const VerdictCard: React.FC<VerdictCardProps> = ({
  name, meta, health, healthDelta, headline, reportCount,
}) => {
  const declining = healthDelta < 0;
  return (
    <div className="bg-white border border-slate-200 rounded-card p-6 flex items-center gap-6">
      <ScoreRing score={health} size={72} showLabel />
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{name}</h1>
          {healthDelta !== 0 && (
            <span
              className={`text-2xs font-semibold rounded-control px-2 py-1 ${
                declining
                  ? "bg-rose-50 text-signal-risk"
                  : "bg-emerald-50 text-signal-healthy"
              }`}
            >
              health {declining ? "↓" : "↑"} {Math.abs(healthDelta)} this quarter
            </span>
          )}
        </div>
        <p className="text-2xs text-slate-500 uppercase tracking-wider mt-1">
          {meta} · {reportCount} reports
        </p>
        <p className="text-slate-600 text-base leading-relaxed mt-2 max-w-2xl">{headline}</p>
      </div>
    </div>
  );
};

export default VerdictCard;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- VerdictCard`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/intel/VerdictCard.tsx src/components/intel/VerdictCard.test.tsx
git commit -m "feat: add VerdictCard component"
```

---

## Task 4: `FlagCard` + `FlagList` with free-tier teaser

**Files:**
- Create: `src/components/intel/FlagCard.tsx`
- Create: `src/components/intel/FlagList.tsx`
- Test: `src/components/intel/FlagList.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import FlagList from "./FlagList";
import { Flag } from "../../../services/accountSignal";

const flags: Flag[] = [
  { type: "champion_loss", severity: "critical", evidence: "The champion left.", reviewIds: ["a", "b", "c"] },
  { type: "brutal_procurement", severity: "caution", evidence: "40% discount demand.", reviewIds: ["d"] },
];

describe("FlagList", () => {
  it("shows evidence quotes for Pro users", () => {
    render(<FlagList flags={flags} isPro={true} />);
    expect(screen.getByText(/The champion left\./)).toBeInTheDocument();
  });

  it("hides evidence and shows an unlock CTA for free users", () => {
    render(<FlagList flags={flags} isPro={false} />);
    expect(screen.queryByText(/The champion left\./)).not.toBeInTheDocument();
    expect(screen.getByText(/unlock 2 flags/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- FlagList`
Expected: FAIL (cannot resolve import).

- [ ] **Step 3: Implement `src/components/intel/FlagCard.tsx`**

```tsx
import React from "react";
import { Flag, FlagType } from "../../../services/accountSignal";

const LABELS: Record<FlagType, string> = {
  ghosting: "Ghosting",
  tire_kicker: "Tire kicker",
  ip_risk: "IP risk",
  brutal_procurement: "Brutal procurement",
  champion_loss: "Champion loss",
  scope_creep: "Scope creep",
  legal_friction: "Legal friction",
  budget_freeze: "Budget freeze",
};

const FlagCard: React.FC<{ flag: Flag; showEvidence: boolean }> = ({ flag, showEvidence }) => {
  const critical = flag.severity === "critical";
  const accent = critical ? "border-l-signal-risk" : "border-l-signal-caution";
  const text = critical ? "text-signal-risk" : "text-signal-caution";
  return (
    <div className={`bg-white border border-slate-200 border-l-[3px] ${accent} rounded-none p-4`}>
      <div className={`text-sm font-semibold ${text}`}>
        {LABELS[flag.type]} · {flag.severity} · {flag.reviewIds.length} report
        {flag.reviewIds.length !== 1 ? "s" : ""}
      </div>
      {showEvidence ? (
        flag.evidence && (
          <p className="text-2xs text-slate-500 italic mt-1">"{flag.evidence}"</p>
        )
      ) : (
        <p className="text-2xs text-slate-300 italic mt-1 select-none" aria-hidden="true">
          ░░░░░░░ ░░░░░ ░░░░░░░░░ ░░░░ ░░░░░░░
        </p>
      )}
    </div>
  );
};

export default FlagCard;
```

- [ ] **Step 4: Implement `src/components/intel/FlagList.tsx`**

```tsx
import React from "react";
import { Link } from "react-router-dom";
import { Flag } from "../../../services/accountSignal";
import FlagCard from "./FlagCard";

const FlagList: React.FC<{ flags: Flag[]; isPro: boolean }> = ({ flags, isPro }) => {
  if (flags.length === 0) {
    return <p className="text-sm text-slate-400">No red flags detected across recent reports.</p>;
  }
  return (
    <div className="space-y-2">
      {flags.map((f) => (
        <FlagCard key={f.type} flag={f} showEvidence={isPro} />
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

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- FlagList`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add src/components/intel/FlagCard.tsx src/components/intel/FlagList.tsx src/components/intel/FlagList.test.tsx
git commit -m "feat: add FlagCard and FlagList with free-tier teaser"
```

---

## Task 5: `TrendStrip` component

**Files:**
- Create: `src/components/intel/TrendStrip.tsx`
- Test: `src/components/intel/TrendStrip.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import TrendStrip from "./TrendStrip";
import { MetricTrend } from "../../../services/accountSignal";

const trend: MetricTrend[] = [
  { metric: "responsiveness", current: 2.8, direction: "down", points: [4, 2.8] },
  { metric: "negotiation", current: 3.2, direction: "up", points: [3, 3.2] },
  { metric: "intent", current: 3.0, direction: "flat", points: [3, 3] },
  { metric: "scope", current: 3.6, direction: "up", points: [3.2, 3.6] },
];

describe("TrendStrip", () => {
  it("renders one tile per metric with its current value", () => {
    render(<TrendStrip trend={trend} />);
    expect(screen.getByText("2.8")).toBeInTheDocument();
    expect(screen.getByText("Responsiveness")).toBeInTheDocument();
    expect(screen.getAllByLabelText(/improving|declining|steady/).length).toBe(4);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- TrendStrip`
Expected: FAIL (cannot resolve import).

- [ ] **Step 3: Implement `src/components/intel/TrendStrip.tsx`**

```tsx
import React from "react";
import { MetricTrend } from "../../../services/accountSignal";
import TrendArrow from "./TrendArrow";

const LABELS: Record<MetricTrend["metric"], string> = {
  responsiveness: "Responsiveness",
  negotiation: "Negotiation Ease",
  intent: "Buyer Intent",
  scope: "Scope Maturity",
};

const TrendStrip: React.FC<{ trend: MetricTrend[] }> = ({ trend }) => (
  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
    {trend.map((t) => (
      <div key={t.metric} className="bg-navy-50 rounded-card p-4">
        <div className="text-2xs text-slate-500 flex items-center gap-1">
          {LABELS[t.metric]} <TrendArrow direction={t.direction} />
        </div>
        <div className="text-xl font-bold font-mono text-slate-900 mt-1">
          {t.current.toFixed(1)}
        </div>
      </div>
    ))}
  </div>
);

export default TrendStrip;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- TrendStrip`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/intel/TrendStrip.tsx src/components/intel/TrendStrip.test.tsx
git commit -m "feat: add TrendStrip component"
```

---

## Task 6: `Playbook` component (Radix Accordion + Tabs)

Renders the existing `CompanyPersona.meddpicc` (from `services/geminiService.ts`) — no new AI call; the page already fetches it.

**Files:**
- Create: `src/components/intel/Playbook.tsx`
- Test: `src/components/intel/Playbook.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Playbook from "./Playbook";
import { CompanyPersona } from "../../../services/geminiService";

const persona: CompanyPersona = {
  summary: "Technical-led account.",
  keyTraits: [],
  strategicAdvice: "Win the architect.",
  teamPlaybooks: [],
  meddpicc: {
    metrics: "ROI on infra spend", economicBuyer: "CFO holds veto",
    decisionCriteria: "Security", decisionProcess: "Committee",
    paperProcess: "Custom MSA", identifyPain: "Cost overruns",
    champion: "VP Eng", competition: "Incumbent",
  },
};

describe("Playbook", () => {
  it("renders the MEDDPICC fields", () => {
    render(<Playbook persona={persona} />);
    expect(screen.getByText("CFO holds veto")).toBeInTheDocument();
    expect(screen.getByText("VP Eng")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- Playbook`
Expected: FAIL (cannot resolve import).

- [ ] **Step 3: Implement `src/components/intel/Playbook.tsx`**

```tsx
import React from "react";
import * as Accordion from "@radix-ui/react-accordion";
import { ChevronDown, Sparkles } from "lucide-react";
import { CompanyPersona } from "../../../services/geminiService";

const FIELDS: { key: keyof CompanyPersona["meddpicc"]; label: string }[] = [
  { key: "metrics", label: "Metrics" },
  { key: "economicBuyer", label: "Economic Buyer" },
  { key: "decisionCriteria", label: "Decision Criteria" },
  { key: "decisionProcess", label: "Decision Process" },
  { key: "paperProcess", label: "Paper Process" },
  { key: "identifyPain", label: "Identify Pain" },
  { key: "champion", label: "Champion" },
  { key: "competition", label: "Competition" },
];

const Playbook: React.FC<{ persona: CompanyPersona }> = ({ persona }) => (
  <Accordion.Root type="single" collapsible defaultValue="playbook">
    <Accordion.Item value="playbook" className="bg-white border border-slate-200 rounded-card">
      <Accordion.Header>
        <Accordion.Trigger className="group w-full flex items-center justify-between p-4 text-sm font-semibold text-slate-900">
          <span className="flex items-center gap-2">
            <Sparkles size={15} className="text-accent" aria-hidden="true" />
            AI playbook — MEDDPICC blueprint
          </span>
          <ChevronDown
            size={16}
            className="text-slate-400 transition-transform group-data-[state=open]:rotate-180"
            aria-hidden="true"
          />
        </Accordion.Trigger>
      </Accordion.Header>
      <Accordion.Content className="px-4 pb-4 border-t border-slate-100">
        <p className="text-sm text-slate-600 italic py-3">{persona.summary}</p>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {FIELDS.map(({ key, label }) => (
            <div key={key}>
              <dt className="text-2xs font-semibold text-slate-400 uppercase tracking-wider">{label}</dt>
              <dd className="text-sm text-slate-700">{persona.meddpicc[key]}</dd>
            </div>
          ))}
        </dl>
      </Accordion.Content>
    </Accordion.Item>
  </Accordion.Root>
);

export default Playbook;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- Playbook`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/intel/Playbook.tsx src/components/intel/Playbook.test.tsx
git commit -m "feat: add Playbook component with Radix accordion"
```

---

## Task 7: `ReviewCard` + `EvidenceList`

Demoted raw reviews at corrected density, with a Radix `Tooltip` replacing the current hover-only rating tooltip.

**Files:**
- Create: `src/components/intel/ReviewCard.tsx`
- Create: `src/components/intel/EvidenceList.tsx`
- Test: `src/components/intel/EvidenceList.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import EvidenceList from "./EvidenceList";
import { Review } from "../../../types";

const review: Review = {
  id: "r1", companyId: "c1", companyName: "Acme", userId: "u1",
  userName: "Verified", currency: "USD", tcvBracket: "$50k - $100k",
  cycleDuration: "3-6 Months", status: "Won", isTender: false,
  buyingTeam: ["Procurement"], location: "US",
  communicationRating: 4, negotiationLevel: 3, timeWasterLevel: 5,
  clarityOfScope: 4, industry: "SaaS", country: "US",
  content: "Smooth, technical-led deal.", createdAt: "2026-03-01T00:00:00.000Z",
};

describe("EvidenceList", () => {
  it("renders review content and the count", () => {
    render(<EvidenceList reviews={[review]} />);
    expect(screen.getByText(/Smooth, technical-led deal\./)).toBeInTheDocument();
    expect(screen.getByText(/1 verified report/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- EvidenceList`
Expected: FAIL (cannot resolve import).

- [ ] **Step 3: Implement `src/components/intel/ReviewCard.tsx`**

```tsx
import React from "react";
import * as Tooltip from "@radix-ui/react-tooltip";
import { Star } from "lucide-react";
import { Review } from "../../../types";

const RATING_DEFINITIONS: Record<string, string[]> = {
  Responsiveness: ["Ghosting", "Poor", "Average", "Good", "Elite"],
  "Negotiation Ease": ["Brutal", "Difficult", "Fair", "Smooth", "Instant"],
  "Buyer Intent": ["Tire Kicker", "Exploratory", "Validated", "Strategic", "Critical"],
  "Scope Maturity": ["Volatile", "Vague", "Consistent", "Structured", "Crystal"],
};

const Rating: React.FC<{ label: string; value: number; color: string }> = ({ label, value, color }) => (
  <Tooltip.Root>
    <Tooltip.Trigger asChild>
      <button type="button" className="flex flex-col items-start text-left focus:outline-none focus:ring-2 focus:ring-accent rounded-control">
        <span className="text-2xs font-semibold uppercase tracking-wider text-slate-400 border-b border-dashed border-slate-300">
          {label}
        </span>
        <span className="flex items-center gap-0.5 mt-1">
          {[1, 2, 3, 4, 5].map((s) => (
            <Star key={s} size={14} className={s <= value ? color : "text-slate-200"} aria-hidden="true" />
          ))}
          <span className="text-2xs font-bold text-slate-900 ml-1">{value}/5</span>
        </span>
      </button>
    </Tooltip.Trigger>
    <Tooltip.Portal>
      <Tooltip.Content className="bg-navy text-white rounded-card p-3 text-2xs max-w-xs z-50" sideOffset={6}>
        <span className="font-semibold">{label}:</span> {RATING_DEFINITIONS[label]?.[value - 1]}
        <Tooltip.Arrow className="fill-navy" />
      </Tooltip.Content>
    </Tooltip.Portal>
  </Tooltip.Root>
);

const ReviewCard: React.FC<{ review: Review }> = ({ review: r }) => (
  <div className="bg-white border border-slate-200 rounded-card p-6 space-y-4">
    <div className="flex justify-between items-center">
      <span className="text-2xs font-bold text-slate-400 uppercase tracking-wider">
        {new Date(r.createdAt).toLocaleDateString()}
      </span>
      <span
        className={`text-2xs font-semibold rounded-control px-3 py-1 ${
          r.status === "Won"
            ? "bg-emerald-50 text-signal-healthy"
            : r.status === "Lost"
              ? "bg-rose-50 text-signal-risk"
              : "bg-navy-50 text-accent"
        }`}
      >
        {r.status}
      </span>
    </div>
    <p className="text-slate-600 text-base italic leading-relaxed">"{r.content}"</p>
    <div className="grid grid-cols-2 gap-x-8 gap-y-4">
      <Rating label="Responsiveness" value={r.communicationRating} color="text-signal-healthy" />
      <Rating label="Negotiation Ease" value={r.negotiationLevel} color="text-signal-caution" />
      <Rating label="Buyer Intent" value={r.timeWasterLevel} color="text-signal-risk" />
      <Rating label="Scope Maturity" value={r.clarityOfScope || 3} color="text-accent" />
    </div>
    <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100 text-2xs font-semibold text-slate-500">
      <span>{r.tcvBracket}</span>
      <span>· {r.cycleDuration}</span>
      <span>· {r.isTender ? "Tender" : "Direct"}</span>
      {r.buyingTeam.map((t) => (
        <span key={t} className="text-accent bg-navy-50 rounded px-1.5">{t}</span>
      ))}
    </div>
  </div>
);

export default ReviewCard;
```

- [ ] **Step 4: Implement `src/components/intel/EvidenceList.tsx`**

```tsx
import React from "react";
import * as Tooltip from "@radix-ui/react-tooltip";
import { Review } from "../../../types";
import ReviewCard from "./ReviewCard";

const EvidenceList: React.FC<{ reviews: Review[] }> = ({ reviews }) => (
  <Tooltip.Provider delayDuration={150}>
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        {reviews.length} verified report{reviews.length !== 1 ? "s" : ""}
      </p>
      {reviews.map((r) => (
        <ReviewCard key={r.id} review={r} />
      ))}
    </div>
  </Tooltip.Provider>
);

export default EvidenceList;
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- EvidenceList`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/intel/ReviewCard.tsx src/components/intel/EvidenceList.tsx src/components/intel/EvidenceList.test.tsx
git commit -m "feat: add ReviewCard and EvidenceList with accessible Radix tooltips"
```

---

## Task 8: Recompose `CompanyProfile.tsx` into the spine

Replace the body of the existing page with the new spine. Keep existing data fetching
(`getAICompanyPersona`, review filtering, `useSEO`, tracking/review handlers); swap the
presentation. Add the `getAccountSignal` fetch alongside the persona fetch.

**Files:**
- Modify: `pages/CompanyProfile.tsx`
- Test: `pages/CompanyProfile.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `pages/CompanyProfile.test.tsx`:
```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import CompanyProfile from "./CompanyProfile";
import { Review } from "../types";

vi.mock("../services/geminiService", () => ({
  getAICompanyPersona: vi.fn().mockResolvedValue({
    summary: "Technical-led account.", keyTraits: [], strategicAdvice: "", teamPlaybooks: [],
    meddpicc: { metrics: "m", economicBuyer: "CFO veto", decisionCriteria: "c", decisionProcess: "p",
      paperProcess: "MSA", identifyPain: "pain", champion: "VP Eng", competition: "incumbent" },
  }),
}));

const review: Review = {
  id: "r1", companyId: "comp-1", companyName: "Snowflake", userId: "u1", userName: "Verified",
  currency: "USD", tcvBracket: "$50k - $100k", cycleDuration: "3-6 Months", status: "Lost",
  isTender: false, buyingTeam: ["Procurement"], location: "US",
  communicationRating: 1, negotiationLevel: 2, timeWasterLevel: 2, clarityOfScope: 2,
  industry: "Data", country: "US", content: "They ghosted us after the POC.",
  createdAt: "2026-03-01T00:00:00.000Z",
};

const company = { id: "comp-1", name: "Snowflake", industry: "Data", country: "US" };

function renderPage(isPaid: boolean) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: "/company/comp-1", state: { company } }]}>
      <CompanyProfile
        user={{ id: "u1" } as any}
        isPaid={isPaid}
        onSignInClick={() => {}}
        reviews={[review]}
        allTrackedIds={[]}
        onToggleTrack={() => {}}
      />
    </MemoryRouter>,
  );
}

describe("CompanyProfile spine", () => {
  it("shows the verdict and flags to free users but gates evidence", async () => {
    renderPage(false);
    expect(await screen.findByText("Snowflake")).toBeInTheDocument();
    expect(screen.getByText(/unlock/i)).toBeInTheDocument();
    expect(screen.queryByText(/They ghosted us/)).not.toBeInTheDocument();
  });

  it("shows evidence and playbook to Pro users", async () => {
    renderPage(true);
    expect(await screen.findByText(/They ghosted us/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("CFO veto")).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- CompanyProfile`
Expected: FAIL (old layout has no "unlock" flag teaser / structure).

- [ ] **Step 3: Replace the `return (...)` block and add the signal fetch**

In `pages/CompanyProfile.tsx`, add imports near the existing ones:
```tsx
import VerdictCard from "../src/components/intel/VerdictCard";
import FlagList from "../src/components/intel/FlagList";
import TrendStrip from "../src/components/intel/TrendStrip";
import Playbook from "../src/components/intel/Playbook";
import EvidenceList from "../src/components/intel/EvidenceList";
import { getAccountSignal, AccountSignal } from "../services/accountSignal";
```

Add state next to the existing `aiPersona` state:
```tsx
const [signal, setSignal] = useState<AccountSignal | null>(null);
```

Add a fetch effect after the existing persona effect:
```tsx
useEffect(() => {
  if (company && companyReviews.length > 0) {
    getAccountSignal(company.name, companyReviews).then(setSignal);
  } else {
    setSignal(null);
  }
}, [company, companyReviews]);
```

Compute a health delta from the signal trend (most recent vs previous window) near the other memos:
```tsx
const healthDelta = useMemo(() => {
  if (!signal || signal.trend.length === 0) return 0;
  const avg = (i: number) =>
    signal.trend.reduce((a, t) => a + (t.points[t.points.length - 1 - i] || 0), 0) / signal.trend.length;
  const latest = avg(0);
  const prev = avg(1);
  if (!prev) return 0;
  return Math.round(((latest - prev) / 20) * 100);
}, [signal]);
```

Replace the entire `return (...)` JSX (from `return (` after the handlers down to the closing of the modal block) with the spine:
```tsx
return (
  <div className="max-w-3xl mx-auto px-6 py-10 space-y-6">
    <VerdictCard
      name={company.name}
      meta={`${company.industry} · ${company.country}`}
      health={hasReviews ? statsSummary.healthIndex : 0}
      healthDelta={healthDelta}
      headline={signal?.headline ?? company.description ?? ""}
      reportCount={companyReviews.length}
    />

    <section aria-labelledby="flags-heading" className="space-y-2">
      <h2 id="flags-heading" className="text-sm font-semibold text-slate-500">Red flags</h2>
      <FlagList flags={signal?.flags ?? []} isPro={isPro} />
    </section>

    {isPro && signal && (
      <section aria-labelledby="trend-heading" className="space-y-2">
        <h2 id="trend-heading" className="text-sm font-semibold text-slate-500">Recent trend</h2>
        <TrendStrip trend={signal.trend} />
      </section>
    )}

    {isPro ? (
      aiPersona && <Playbook persona={aiPersona} />
    ) : (
      <Link to="/pricing" className="block bg-navy text-white rounded-card p-6 text-center">
        <span className="text-sm font-semibold">Unlock the AI playbook and full review evidence with Sales Pro</span>
      </Link>
    )}

    {isPro && hasReviews && (
      <section aria-labelledby="evidence-heading" className="space-y-3">
        <h2 id="evidence-heading" className="text-sm font-semibold text-slate-500">Evidence</h2>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedTeam("all")}
            className={`px-3 py-1.5 rounded-control text-2xs font-semibold uppercase tracking-wider ${
              selectedTeam === "all" ? "bg-accent text-white" : "bg-white text-slate-500 border border-slate-200"
            }`}
          >
            All stakeholders
          </button>
          {availableTeams.map((team) => (
            <button
              key={team}
              onClick={() => setSelectedTeam(team)}
              className={`px-3 py-1.5 rounded-control text-2xs font-semibold uppercase tracking-wider ${
                selectedTeam === team ? "bg-accent text-white" : "bg-white text-slate-500 border border-slate-200"
              }`}
            >
              {team}
            </button>
          ))}
        </div>
        <EvidenceList reviews={sortedReviews} />
      </section>
    )}

    {showReviewRuleModal && (
      <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-slate-900/60">
        <div className="bg-white rounded-card p-10 max-w-md w-full text-center space-y-6">
          <h3 className="text-xl font-bold text-slate-900">Review policy</h3>
          <p className="text-slate-500">
            Users can leave one review per company every 6 months. Your last review for {company.name} was recent.
          </p>
          <button
            onClick={() => setShowReviewRuleModal(false)}
            className="w-full bg-navy text-white py-4 rounded-control font-semibold uppercase tracking-widest"
          >
            Understood
          </button>
        </div>
      </div>
    )}
  </div>
);
```

Delete the now-unused `HeaderStat` and `TacticalStars` components and the `RATING_DEFINITIONS` const at the bottom of the file (ratings now live in `ReviewCard`).

- [ ] **Step 4: Run the page tests**

Run: `npm test -- CompanyProfile`
Expected: PASS (2 tests).

- [ ] **Step 5: Run the full suite + type-check + build**

Run: `npm test && npm run type-check && npm run build`
Expected: all tests PASS, no type errors, build succeeds.

- [ ] **Step 6: Commit**

```bash
git add pages/CompanyProfile.tsx pages/CompanyProfile.test.tsx
git commit -m "feat: recompose Company Intelligence page into Executive Briefing spine"
```

---

## Task 9: Accessibility + density verification pass

**Files:**
- Modify (as needed): any `src/components/intel/*.tsx`

- [ ] **Step 1: Grep for sub-11px type in the new components**

Run: `grep -rn "text-\[\(8\|9\|10\)px\]" src/components/intel pages/CompanyProfile.tsx`
Expected: no matches. If any found, replace with `text-2xs` (11px) or larger and commit.

- [ ] **Step 2: Verify color is never the only signal**

Read each of `FlagCard.tsx`, `TrendStrip.tsx`, `TrendArrow.tsx`. Confirm every signal-colored
element also carries text (severity word, metric value) or an `aria-label`. `TrendArrow`
already exposes `aria-label`; confirm flag severity text is present. Fix any gaps, commit.

- [ ] **Step 3: Manual keyboard walkthrough**

Run: `npm run dev`, open a company page, and using keyboard only:
- Tab to each rating in a review card → tooltip appears on focus, Escape dismisses it.
- Tab to the playbook accordion trigger → Enter toggles it.
- Tab to flag "Unlock" CTA (free mode) → activates.
Expected: full operability without a mouse. Note any failures and fix.

- [ ] **Step 4: Final commit (if any fixes were made)**

```bash
git add -A
git commit -m "fix: accessibility and density corrections for intel components"
```

---

## Notes for the executor
- **Do not commit/push to deploy concerns:** these changes touch only frontend (`src/`, `pages/`, `services/`). Per repo CI, deploys trigger on `functions/` changes only, so this work does not auto-deploy.
- **The AI signal is a stub.** `getAccountSignal` uses heuristics on existing fields. The real Gemini extraction is a separate, later spec; the contract in `services/accountSignal.ts` must not change shape when that lands.
- **Health math reuse:** `statsSummary.healthIndex` already exists in `CompanyProfile.tsx`; the spine reuses it directly rather than recomputing.
