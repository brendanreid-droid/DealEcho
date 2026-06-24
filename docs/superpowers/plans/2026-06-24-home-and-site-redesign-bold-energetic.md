# Home & Site Redesign "Bold & Energetic" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the home page as a bold, conversion-focused cold-traffic landing and roll a shared "bold" design system (Inter, vivid accent, reusable CTA/heading/stat/band components) across the site for a consistent feel.

**Architecture:** A small set of shared UI primitives under `src/components/ui/` become the single source of truth for buttons, headings, stats, and the closing CTA band. The home page and shell are rebuilt to use them; the company and pricing pages are aligned. Inter becomes the display face via one token change; the scrolling marquee (`IntelTicker`) is deleted.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind, `lucide-react`. Tests: Vitest + React Testing Library (already configured).

**Spec:** `docs/superpowers/specs/2026-06-24-home-and-site-redesign-bold-energetic-design.md`

**Decisions carried:** "Start trial" routes to `/pricing` (no Stripe changes). Benefit trio uses `lucide-react` icons.

---

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `src/test/setup.ts` | add `matchMedia` mock so count-up/motion code runs in jsdom | 1 |
| `tailwind.config.js` | Inter as the `display` face | 1 |
| `src/styles/index.css`, `index.html` | drop the now-unused Space Grotesk font load | 1 |
| `src/components/ui/CountUp.tsx` | reusable animated count-up (extracted from Home) | 2 |
| `src/components/ui/Button.tsx` | CTA button: `primary` / `dark` / `outline` variants | 3 |
| `src/components/ui/SectionHeading.tsx` | heading + optional LIVE pill | 4 |
| `src/components/ui/StatStrip.tsx` | count-up stat row | 5 |
| `src/components/ui/CtaBand.tsx` | dark navy closing CTA band | 6 |
| `pages/Home.tsx` | rebuilt landing IA; marquee removed | 7 |
| `src/components/IntelTicker.tsx` | **deleted** | 7 |
| `src/components/Shell.tsx` | logged-out marketing nav state (`Get Pro`) | 8 |
| `pages/CompanyProfile.tsx` | bold hero header aligned to the system | 9 |
| `pages/Pricing.tsx` | `CtaBand` + shared `Button` alignment | 9 |

---

## Task 1: Inter as display face + jsdom matchMedia + drop Space Grotesk

**Files:**
- Modify: `tailwind.config.js`
- Modify: `src/test/setup.ts`
- Modify: `src/styles/index.css`
- Modify: `index.html`

- [ ] **Step 1: Add a matchMedia mock to `src/test/setup.ts`**

Append to the file (after the existing jest-dom import):
```ts
if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
}
```

- [ ] **Step 2: Make Inter the display face in `tailwind.config.js`**

Replace the `fontFamily` block:
```js
      fontFamily: {
        // Inter is the single display + body face
        display: ["Inter", "system-ui", "sans-serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
        // Data: JetBrains Mono (scores, metric figures)
        mono: ["'JetBrains Mono'", "ui-monospace", "monospace"],
      },
```

- [ ] **Step 3: Drop Space Grotesk from the font loads**

In `src/styles/index.css` line 2, change the `@import` URL to remove the Space Grotesk family:
```css
@import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;600&display=swap");
```
In `index.html` line 12, change the stylesheet `href` identically (remove `&family=Space+Grotesk:wght@500;600;700`).

- [ ] **Step 4: Verify build + existing tests still pass**

Run: `PATH="/opt/homebrew/bin:$PATH" npm test && PATH="/opt/homebrew/bin:$PATH" npm run build`
Expected: all existing tests pass; build succeeds.

- [ ] **Step 5: Commit**

```bash
git add tailwind.config.js src/test/setup.ts src/styles/index.css index.html
git commit -m "feat: make Inter the display face; drop Space Grotesk"
```

---

## Task 2: `CountUp` shared component

Extract the count-up animation from `Home.tsx` into a reusable component.

**Files:**
- Create: `src/components/ui/CountUp.tsx`
- Test: `src/components/ui/CountUp.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import CountUp from "./CountUp";

describe("CountUp", () => {
  it("renders the final value (reduced motion path in jsdom)", () => {
    render(<CountUp end={1840} />);
    expect(screen.getByText("1,840")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `PATH="/opt/homebrew/bin:$PATH" npm test -- CountUp`
Expected: FAIL (cannot resolve import).

- [ ] **Step 3: Implement `src/components/ui/CountUp.tsx`**

```tsx
import React, { useEffect, useRef, useState } from "react";

interface CountUpProps {
  end: number;
  className?: string;
  suffix?: string;
}

/** Animated count-up. Respects reduced motion by jumping to the final value. */
const CountUp: React.FC<CountUpProps> = ({ end, className, suffix = "" }) => {
  const [val, setVal] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if (reduce) {
      setVal(end);
      return;
    }
    const t0 = performance.now();
    const dur = 1400;
    const step = (t: number) => {
      const p = Math.min((t - t0) / dur, 1);
      setVal(Math.round(end * (1 - Math.pow(1 - p, 3))));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [end]);

  return (
    <span className={className}>
      {val.toLocaleString()}
      {suffix}
    </span>
  );
};

export default CountUp;
```

Note: jsdom's `requestAnimationFrame` does not auto-run in tests, so `val` stays at the synchronously-set value. The test asserts the reduced-motion jump; to make it deterministic, the mock in Task 1 returns `matches: false`, so add `suffix` rendering and assert below. (The test above passes because in jsdom rAF never fires and the component must show the end value — see Step 4 adjustment.)

- [ ] **Step 4: Make the test deterministic**

Update `src/components/ui/CountUp.test.tsx` to force the reduced-motion path:
```tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import CountUp from "./CountUp";

beforeEach(() => {
  window.matchMedia = ((q: string) =>
    ({ matches: true, media: q, addEventListener() {}, removeEventListener() {},
       addListener() {}, removeListener() {}, onchange: null,
       dispatchEvent: () => false })) as unknown as typeof window.matchMedia;
});

describe("CountUp", () => {
  it("jumps to the final value with reduced motion", () => {
    render(<CountUp end={1840} suffix="" />);
    expect(screen.getByText("1,840")).toBeInTheDocument();
  });
});
```

- [ ] **Step 5: Run test to verify it passes**

Run: `PATH="/opt/homebrew/bin:$PATH" npm test -- CountUp`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/CountUp.tsx src/components/ui/CountUp.test.tsx
git commit -m "feat: add reusable CountUp component"
```

---

## Task 3: `Button` component

**Files:**
- Create: `src/components/ui/Button.tsx`
- Test: `src/components/ui/Button.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import Button from "./Button";

describe("Button", () => {
  it("fires onClick when used as a button", async () => {
    const onClick = vi.fn();
    render(<Button variant="primary" onClick={onClick}>Get Pro</Button>);
    await userEvent.click(screen.getByRole("button", { name: "Get Pro" }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("renders as a link when `to` is provided", () => {
    render(
      <MemoryRouter>
        <Button variant="primary" to="/pricing">Start trial</Button>
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: "Start trial" })).toHaveAttribute("href", "/pricing");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `PATH="/opt/homebrew/bin:$PATH" npm test -- Button`
Expected: FAIL (cannot resolve import).

- [ ] **Step 3: Implement `src/components/ui/Button.tsx`**

```tsx
import React from "react";
import { Link } from "react-router-dom";

type Variant = "primary" | "dark" | "outline";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-white hover:bg-accent-700",
  dark: "bg-navy text-white hover:bg-black",
  outline: "bg-transparent text-slate-900 border border-slate-300 hover:border-slate-400",
};

interface BaseProps {
  variant: Variant;
  children: React.ReactNode;
  className?: string;
  to?: string;
  onClick?: () => void;
}

const Button: React.FC<BaseProps> = ({ variant, children, className = "", to, onClick }) => {
  const cls = `inline-flex items-center justify-center gap-2 font-semibold rounded-control px-6 py-3 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${VARIANTS[variant]} ${className}`;
  if (to) {
    return (
      <Link to={to} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={cls}>
      {children}
    </button>
  );
};

export default Button;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `PATH="/opt/homebrew/bin:$PATH" npm test -- Button`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/Button.tsx src/components/ui/Button.test.tsx
git commit -m "feat: add shared Button component"
```

---

## Task 4: `SectionHeading` component

**Files:**
- Create: `src/components/ui/SectionHeading.tsx`
- Test: `src/components/ui/SectionHeading.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import SectionHeading from "./SectionHeading";

describe("SectionHeading", () => {
  it("renders the title and the LIVE pill when live", () => {
    render(<SectionHeading title="Recent intelligence" live />);
    expect(screen.getByRole("heading", { name: /Recent intelligence/ })).toBeInTheDocument();
    expect(screen.getByText("LIVE")).toBeInTheDocument();
  });

  it("omits the pill when not live", () => {
    render(<SectionHeading title="Pricing" />);
    expect(screen.queryByText("LIVE")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `PATH="/opt/homebrew/bin:$PATH" npm test -- SectionHeading`
Expected: FAIL (cannot resolve import).

- [ ] **Step 3: Implement `src/components/ui/SectionHeading.tsx`**

```tsx
import React from "react";

interface SectionHeadingProps {
  title: string;
  live?: boolean;
  className?: string;
}

const SectionHeading: React.FC<SectionHeadingProps> = ({ title, live, className = "" }) => (
  <h2 className={`font-bold text-2xl md:text-[26px] tracking-tight text-slate-900 flex items-center gap-3 ${className}`}>
    {title}
    {live && (
      <span className="font-mono text-2xs text-signal-healthy border border-emerald-200 bg-emerald-50 rounded-md px-2 py-0.5 tracking-[0.1em] inline-flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-signal-healthy animate-pulse-soft" />
        LIVE
      </span>
    )}
  </h2>
);

export default SectionHeading;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `PATH="/opt/homebrew/bin:$PATH" npm test -- SectionHeading`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/SectionHeading.tsx src/components/ui/SectionHeading.test.tsx
git commit -m "feat: add SectionHeading component"
```

---

## Task 5: `StatStrip` component

**Files:**
- Create: `src/components/ui/StatStrip.tsx`
- Test: `src/components/ui/StatStrip.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import StatStrip from "./StatStrip";

beforeEach(() => {
  window.matchMedia = ((q: string) =>
    ({ matches: true, media: q, addEventListener() {}, removeEventListener() {},
       addListener() {}, removeListener() {}, onchange: null,
       dispatchEvent: () => false })) as unknown as typeof window.matchMedia;
});

describe("StatStrip", () => {
  it("renders each stat label and value", () => {
    render(<StatStrip stats={[{ n: 420, l: "Accounts" }, { n: 38, l: "Industries" }]} />);
    expect(screen.getByText("420")).toBeInTheDocument();
    expect(screen.getByText("Accounts")).toBeInTheDocument();
    expect(screen.getByText("Industries")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `PATH="/opt/homebrew/bin:$PATH" npm test -- StatStrip`
Expected: FAIL (cannot resolve import).

- [ ] **Step 3: Implement `src/components/ui/StatStrip.tsx`**

```tsx
import React from "react";
import CountUp from "./CountUp";

export interface Stat {
  n: number;
  l: string;
  suffix?: string;
}

const StatStrip: React.FC<{ stats: Stat[]; dark?: boolean; className?: string }> = ({
  stats,
  dark,
  className = "",
}) => (
  <div className={`flex flex-wrap justify-center gap-x-12 gap-y-6 ${className}`}>
    {stats.map((s) => (
      <div key={s.l} className="text-center">
        <CountUp
          end={s.n}
          suffix={s.suffix}
          className={`font-bold text-3xl ${dark ? "text-white" : "text-slate-900"}`}
        />
        <div className={`text-xs mt-1 font-medium ${dark ? "text-slate-400" : "text-slate-500"}`}>
          {s.l}
        </div>
      </div>
    ))}
  </div>
);

export default StatStrip;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `PATH="/opt/homebrew/bin:$PATH" npm test -- StatStrip`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/StatStrip.tsx src/components/ui/StatStrip.test.tsx
git commit -m "feat: add StatStrip component"
```

---

## Task 6: `CtaBand` component

**Files:**
- Create: `src/components/ui/CtaBand.tsx`
- Test: `src/components/ui/CtaBand.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import CtaBand from "./CtaBand";

describe("CtaBand", () => {
  it("renders the headline and a CTA link", () => {
    render(
      <MemoryRouter>
        <CtaBand headline="Stop walking into deals blind." subtext="Cancel anytime." ctaLabel="Start your 7-day trial" to="/pricing" />
      </MemoryRouter>,
    );
    expect(screen.getByText("Stop walking into deals blind.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Start your 7-day trial/ })).toHaveAttribute("href", "/pricing");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `PATH="/opt/homebrew/bin:$PATH" npm test -- CtaBand`
Expected: FAIL (cannot resolve import).

- [ ] **Step 3: Implement `src/components/ui/CtaBand.tsx`**

```tsx
import React from "react";
import Button from "./Button";

interface CtaBandProps {
  headline: string;
  subtext?: string;
  ctaLabel: string;
  to: string;
}

const CtaBand: React.FC<CtaBandProps> = ({ headline, subtext, ctaLabel, to }) => (
  <section className="bg-navy text-center px-6 py-14">
    <h2 className="text-white font-extrabold text-2xl md:text-3xl tracking-tight">{headline}</h2>
    {subtext && <p className="text-slate-400 text-sm mt-3 max-w-md mx-auto">{subtext}</p>}
    <div className="mt-7 flex justify-center">
      <Button variant="primary" to={to}>
        {ctaLabel} →
      </Button>
    </div>
  </section>
);

export default CtaBand;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `PATH="/opt/homebrew/bin:$PATH" npm test -- CtaBand`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/CtaBand.tsx src/components/ui/CtaBand.test.tsx
git commit -m "feat: add CtaBand component"
```

---

## Task 7: Rebuild `Home.tsx`; delete the marquee

**Files:**
- Modify: `pages/Home.tsx`
- Delete: `src/components/IntelTicker.tsx`
- Test: `pages/Home.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `pages/Home.test.tsx`:
```tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Home from "./Home";
import { ReviewSummary } from "../src/hooks/useReviewSummaries";

beforeEach(() => {
  window.matchMedia = ((q: string) =>
    ({ matches: true, media: q, addEventListener() {}, removeEventListener() {},
       addListener() {}, removeListener() {}, onchange: null,
       dispatchEvent: () => false })) as unknown as typeof window.matchMedia;
});

const summary: ReviewSummary = {
  id: "s1", companyId: "comp-1", companyName: "Snowflake", industry: "Data",
  location: "US", country: "US", status: "Won", createdAt: "2026-03-01T00:00:00.000Z",
  excerpt: "Technical-led, procurement-heavy.", communicationRating: 4,
  negotiationLevel: 3, timeWasterLevel: 5, clarityOfScope: 4,
} as ReviewSummary;

describe("Home", () => {
  it("renders the hero headline and primary CTA, and lists a company", () => {
    render(
      <MemoryRouter>
        <Home user={null} isPaid={false} onSignInClick={() => {}} reviewSummaries={[summary]} trackedIds={[]} onToggleTrack={() => {}} />
      </MemoryRouter>,
    );
    expect(screen.getByText(/Know the buyer/)).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Start 7-day Pro trial/ }).length).toBeGreaterThan(0);
    expect(screen.getByText("Snowflake")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `PATH="/opt/homebrew/bin:$PATH" npm test -- Home`
Expected: FAIL (no "Start 7-day Pro trial" CTA in the current Home).

- [ ] **Step 3: Delete the marquee**

```bash
git rm src/components/IntelTicker.tsx
```

- [ ] **Step 4: Replace `pages/Home.tsx`**

Replace the whole file with:
```tsx
import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useSEO } from "../src/hooks/useSEO";
import { ReviewSummary } from "../src/hooks/useReviewSummaries";
import CompanyCard, { CompanyCardData } from "../src/components/CompanyCard";
import { CardGridSkeleton } from "../src/components/Skeleton";
import { companyLogoUrl, guessDomainFromName } from "../src/utils/companyLogo";
import { MappedUser } from "../src/hooks/useAuth";
import Button from "../src/components/ui/Button";
import SectionHeading from "../src/components/ui/SectionHeading";
import StatStrip from "../src/components/ui/StatStrip";
import CtaBand from "../src/components/ui/CtaBand";
import { Eye, Flag, Zap } from "lucide-react";

interface HomeProps {
  user: MappedUser | null;
  isPaid: boolean;
  onSignInClick: () => void;
  reviewSummaries: ReviewSummary[];
  trackedIds: string[];
  onToggleTrack: (id: string) => void;
  isLoading?: boolean;
}

const BENEFITS = [
  { Icon: Eye, title: "See how they buy", body: "Responsiveness, negotiation style, and decision process — before your first call." },
  { Icon: Flag, title: "Spot red flags early", body: "Ghosting, brutal procurement, champion risk — surfaced from real seller reports." },
  { Icon: Zap, title: "Win faster", body: "Walk in with the playbook instead of spending a quarter discovering it." },
];

const Home: React.FC<HomeProps> = ({ isPaid, reviewSummaries, isLoading }) => {
  useSEO({
    title: "DealEcho - Crowdsourced B2B Sales Intelligence & Account Insights",
    description:
      "Know the buyer before the first call. Verified B2B buyer intelligence, red-flag analysis, and buying-team personas for elite tech accounts.",
    keywords: "B2B sales intelligence, MEDDPICC, buying teams, account planning, DealEcho",
  });

  const [search, setSearch] = useState("");
  const navigate = useNavigate();
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (search.trim()) navigate(`/search?q=${encodeURIComponent(search)}`);
  };

  const companies: CompanyCardData[] = useMemo(() => {
    const stats: Record<string, any> = {};
    reviewSummaries.forEach((s) => {
      const name = s.companyName;
      if (!stats[name]) {
        stats[name] = { id: s.companyId, name: s.companyName, industry: s.industry, location: s.location, count: 0, respTotal: 0, negTotal: 0, wasteTotal: 0, scopeTotal: 0, lastDate: s.createdAt, excerpt: s.excerpt };
      }
      stats[name].count++;
      stats[name].respTotal += s.communicationRating;
      stats[name].negTotal += s.negotiationLevel;
      stats[name].wasteTotal += s.timeWasterLevel;
      stats[name].scopeTotal += s.clarityOfScope || 3;
      if (new Date(s.createdAt) > new Date(stats[name].lastDate)) {
        stats[name].lastDate = s.createdAt;
        stats[name].excerpt = s.excerpt;
      }
    });
    return Object.values(stats)
      .sort((a, b) => new Date(b.lastDate).getTime() - new Date(a.lastDate).getTime())
      .map((c) => {
        const avgResp = c.respTotal / c.count, avgNeg = c.negTotal / c.count, avgWaste = c.wasteTotal / c.count, avgScope = c.scopeTotal / c.count;
        return {
          id: c.id, name: c.name, industry: c.industry, location: c.location, reports: c.count, excerpt: c.excerpt,
          logoUrl: companyLogoUrl({ name: c.name, domain: guessDomainFromName(c.name) }),
          healthIndex: Math.round(((avgResp + avgNeg + avgWaste + avgScope) / 20) * 100),
          responsiveness: Math.round(avgResp * 20), negotiation: Math.round(avgNeg * 20),
          buyerIntent: Math.round(avgWaste * 20), scopeClarity: Math.round(avgScope * 20),
        };
      });
  }, [reviewSummaries]);

  const accountsCovered = companies.length;

  return (
    <div className="bg-slate-50 min-h-screen">
      {/* Hero */}
      <section className="bg-navy text-white pt-20 pb-16 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 font-mono text-2xs uppercase tracking-[0.16em] text-signal-healthy-bright mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-signal-healthy-bright animate-pulse-soft" />
            Live · {reviewSummaries.length.toLocaleString()} verified deal reports
          </div>
          <h1 className="font-extrabold text-4xl md:text-6xl leading-[1.04] tracking-tight mb-5">
            Know the buyer before
            <br className="hidden sm:block" /> the <span className="text-accent-soft">first call.</span>
          </h1>
          <p className="text-lg text-slate-300 max-w-xl mx-auto mb-9 leading-relaxed">
            Crowdsourced intelligence from real enterprise sales cycles. See how target accounts actually buy — before you spend a quarter finding out.
          </p>
          <div className="flex flex-wrap gap-3 justify-center mb-10">
            <Button variant="primary" to="/pricing">Start 7-day Pro trial</Button>
            <Button variant="outline" to="/search" className="!text-white !border-white/25 hover:!border-white/50">Search an account</Button>
          </div>
          <StatStrip
            dark
            stats={[
              { n: reviewSummaries.length, l: "Verified reports" },
              { n: accountsCovered, l: "Accounts covered" },
              { n: 38, l: "Industries" },
              { n: 92, l: "Seller-verified", suffix: "%" },
            ]}
          />
        </div>
      </section>

      {/* Live feed */}
      <section className="max-w-7xl mx-auto px-6 py-14">
        <SectionHeading title="Recent intelligence" live />
        <p className="text-slate-500 text-sm mt-2 mb-7">Freshly analysed accounts from the seller community.</p>
        {isLoading ? (
          <CardGridSkeleton count={6} />
        ) : companies.length === 0 ? (
          <div className="de-card p-12 text-center">
            <p className="text-slate-600 font-medium">No accounts yet. Be the first to share intel.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {companies.map((c) => (
              <CompanyCard key={c.id} company={c} isPro={isPaid} />
            ))}
          </div>
        )}
      </section>

      {/* Benefits */}
      <section className="max-w-7xl mx-auto px-6 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {BENEFITS.map(({ Icon, title, body }) => (
            <div key={title} className="de-card p-7">
              <div className="w-11 h-11 rounded-control bg-accent-50 text-accent flex items-center justify-center mb-4">
                <Icon size={20} aria-hidden="true" />
              </div>
              <h3 className="font-bold text-lg text-slate-900 mb-1.5">{title}</h3>
              <p className="text-slate-500 text-sm leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Closing CTA */}
      <CtaBand
        headline="Stop walking into deals blind."
        subtext="Full red-flag analysis, buyer personas, and deal mechanics on every account. Cancel anytime."
        ctaLabel="Start your 7-day trial"
        to="/pricing"
      />
    </div>
  );
};

export default Home;
```

- [ ] **Step 5: Run the Home test + full suite**

Run: `PATH="/opt/homebrew/bin:$PATH" npm test -- Home && PATH="/opt/homebrew/bin:$PATH" npm test`
Expected: Home test passes; full suite green.

- [ ] **Step 6: Commit**

```bash
git add pages/Home.tsx pages/Home.test.tsx
git rm src/components/IntelTicker.tsx
git commit -m "feat: rebuild home as bold landing; remove marquee"
```

---

## Task 8: Shell nav — logged-out marketing state

Add a `Get Pro →` CTA and marketing links to the logged-out nav, keeping the logged-in app nav intact.

**Files:**
- Modify: `src/components/Shell.tsx`
- Test: `src/components/Shell.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Navigation } from "./Shell";

const noop = () => {};

describe("Navigation", () => {
  it("shows Get Pro CTA for logged-out visitors", () => {
    render(
      <MemoryRouter>
        <Navigation user={null} isAdmin={false} isPaid={false} onSignInClick={noop} onLogout={noop} notificationCount={0} />
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: /Get Pro/ })).toHaveAttribute("href", "/pricing");
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });

  it("shows the app nav for logged-in users", () => {
    render(
      <MemoryRouter>
        <Navigation user={{ name: "Sam", avatar: "" } as any} isAdmin={false} isPaid={true} onSignInClick={noop} onLogout={noop} notificationCount={0} />
      </MemoryRouter>,
    );
    expect(screen.getByText("My intel")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Get Pro/ })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `PATH="/opt/homebrew/bin:$PATH" npm test -- Shell`
Expected: FAIL (no "Get Pro" link).

- [ ] **Step 3: Implement the logged-out nav in `src/components/Shell.tsx`**

In the `Navigation` component, replace the `<nav className="hidden lg:flex ...">` links block so the link set depends on auth, and add the `Get Pro` CTA in the logged-out action area. Specifically:

Replace the desktop `<nav>` block (lines ~49-68) with:
```tsx
          <nav className="hidden lg:flex items-center gap-7">
            {(user
              ? navLinks
              : [
                  { name: "Product", path: "/search", icon: "fa-search" },
                  { name: "Pricing", path: "/pricing", icon: "fa-tags" },
                ]
            ).map((link) => (
              <Link
                key={link.name}
                to={link.path}
                className={`relative text-sm font-medium transition-colors ${
                  isActive(link.path) ? "text-accent" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                {link.name}
                {link.path === "/my-intel" && notificationCount > 0 && (
                  <span className="absolute -top-1.5 -right-3 bg-signal-risk text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center border-2 border-white">
                    {notificationCount}
                  </span>
                )}
              </Link>
            ))}
          </nav>
```

In the right-hand action area, in the `else` branch where the `Sign in` button is rendered (currently `<button onClick={onSignInClick} className="de-btn-primary text-sm">Sign in</button>`), replace it with:
```tsx
            <div className="flex items-center gap-3">
              <button onClick={onSignInClick} className="text-sm font-medium text-slate-500 hover:text-slate-900 hidden sm:block">
                Sign in
              </button>
              <Link to="/pricing" className="de-btn-accent text-sm">
                Get Pro →
              </Link>
            </div>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `PATH="/opt/homebrew/bin:$PATH" npm test -- Shell`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/Shell.tsx src/components/Shell.test.tsx
git commit -m "feat: logged-out marketing nav with Get Pro CTA"
```

---

## Task 9: Align company-page hero + Pricing to the system

**Files:**
- Modify: `pages/CompanyProfile.tsx`
- Modify: `pages/Pricing.tsx`

- [ ] **Step 1: Company hero — verify current header, then bolden**

Read `pages/CompanyProfile.tsx`. In the `VerdictCard` usage / page header area, ensure the company name uses `font-extrabold tracking-tight` and the primary actions use the shared `Button` (`variant="primary"` for Track when active intent, `variant="outline"` for secondary). Import `Button` from `../src/components/ui/Button` and replace the two inline action buttons added previously (Track / Leave review) with:
```tsx
<Button variant="primary" onClick={handleTrackToggle}>{isTracking ? "Tracking account" : "Track account"}</Button>
<Button variant="outline" onClick={handleLeaveReview}>Leave review</Button>
```

- [ ] **Step 2: Pricing — add the closing CtaBand and align the primary button**

Read `pages/Pricing.tsx`. Import `CtaBand` from `../src/components/ui/CtaBand` and render `<CtaBand headline="Ready to stop guessing?" subtext="Start your 7-day Pro trial. Cancel anytime." ctaLabel="Start free trial" to="/pricing" />` at the bottom of the page's returned markup (above any footer slot). Ensure the Pro plan's primary action uses `bg-accent` styling consistent with the shared Button (if it already uses `de-btn-accent`, leave it).

- [ ] **Step 3: Run full suite + build**

Run: `PATH="/opt/homebrew/bin:$PATH" npm test && PATH="/opt/homebrew/bin:$PATH" npm run build`
Expected: all tests pass; build succeeds.

- [ ] **Step 4: Commit**

```bash
git add pages/CompanyProfile.tsx pages/Pricing.tsx
git commit -m "feat: align company hero and pricing to bold system"
```

---

## Task 10: Accessibility, responsive & visual verification

**Files:** none (verification; fix forward if needed).

- [ ] **Step 1: Contrast + no sub-11px grep**

Run: `grep -rn "text-\[\(8\|9\|10\)px\]" pages/Home.tsx src/components/ui src/components/Shell.tsx`
Expected: no matches. Fix any with `text-2xs` or larger.

- [ ] **Step 2: Local visual check (dev server)**

Run: `PATH="/opt/homebrew/bin:$PATH" npm run dev` and open the local URL. Confirm: hero renders on navy with readable text, no marquee, stat count-up runs, feed grid responsive (resize to mobile → 1 col), `Get Pro` in nav, closing band visible. Note issues and fix forward.

- [ ] **Step 3: Reduced-motion check**

In the browser dev tools, emulate `prefers-reduced-motion: reduce` and reload. Confirm count-up jumps to final values and no infinite animations distract.

- [ ] **Step 4: Final commit (if fixes were made)**

```bash
git add -A
git commit -m "fix: accessibility and responsive corrections for home redesign"
```

---

## Notes for the executor
- Frontend-only; no auto-deploy (CI deploys `functions/**` only).
- npm is invoked as `/opt/homebrew/bin/node /opt/homebrew/bin/npm`, or prefix commands with `PATH="/opt/homebrew/bin:$PATH"`.
- `lucide-react` is already a dependency.
- The 3 pre-existing `tsc` errors (admin/adminConfig.ts, dealData.ts, useReviewSummaries.ts) are unrelated; introduce no new ones.
