# Pre-Launch Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all pre-marketing-campaign gaps found in the 2026-07-10 UX audit: broken social share image, missing analytics, conversion funnel dead ends, gating inconsistencies, design-system split, and cost leaks.

**Architecture:** Pure frontend + static-asset changes to the existing React 19 / Vite / Firebase SPA. No Cloud Function changes. Analytics via Firebase Analytics (GA4 under the hood — `measurementId` already exists in `.env.local`). Each task is independently shippable and committed separately; push at the end (push auto-deploys via CI).

**Tech Stack:** React 19, TypeScript, Tailwind, react-router-dom v6+, Firebase JS SDK v12 (`firebase/analytics`), Vitest + Testing Library, sharp-cli (one-off, via npx) for OG image generation.

**Out of scope (explicitly deferred by Brendan):**
- Browser extension placeholder URL / post-checkout "Add to Chrome" prompt — extension ships separately today; page updated later.
- SSR / prerendering of company pages for SEO — separate project.

**Brand tokens for reference** (from `tailwind.config.js`): `navy` = `#0e1426`, `accent` = `#4f46e5`, `accent-soft` = `#818cf8`, `accent-50` = `#eef2ff`. Radii: `rounded-card`, `rounded-control`.

**UI copy rule:** plain hyphens only, never em dashes (standing preference).

**Baseline (verified 2026-07-10):** `npx vitest run` = 7 failed files / 23 passed. Failures: 5 compiled `functions/lib/extension/*.test.js` files (should never be collected by the root runner) + stale assertions in `src/components/Shell.test.tsx` (2) and `pages/Home.test.tsx` (1). Task 1 makes the suite green before anything else.

---

### Task 1: Repair the test baseline

**Files:**
- Modify: `vitest.config.ts`
- Modify: `src/components/Shell.test.tsx`
- Modify: `pages/Home.test.tsx`

- [ ] **Step 1: Exclude the functions workspace from the root vitest run**

Replace the `test` block in `vitest.config.ts` with:

```ts
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    exclude: ["**/node_modules/**", "functions/**", "dist/**"],
  },
```

- [ ] **Step 2: Update Shell.test.tsx to match the current Navigation UI**

The old test expects "Get Pro" and "My Intel", which no longer exist. Replace the entire `describe` block content with:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Navigation } from "./Shell";

const noop = () => {};

describe("Navigation", () => {
  it("shows Sign up and Pricing for logged-out visitors", () => {
    render(
      <MemoryRouter>
        <Navigation user={null} isAdmin={false} isPaid={false} onSignInClick={noop} onSignUpClick={noop} onLogout={noop} notificationCount={0} />
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: "Pricing" })).toHaveAttribute("href", "/pricing");
    expect(screen.getByRole("button", { name: "Sign up" })).toBeInTheDocument();
  });

  it("shows the app nav for logged-in users", () => {
    render(
      <MemoryRouter>
        <Navigation user={{ name: "Sam", avatar: "" } as any} isAdmin={false} isPaid={true} onSignInClick={noop} onSignUpClick={noop} onLogout={noop} notificationCount={0} />
      </MemoryRouter>,
    );
    expect(screen.getByText("Control Centre")).toBeInTheDocument();
    expect(screen.getByText("Write Review")).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Update Home.test.tsx CTA assertion to current copy**

In `pages/Home.test.tsx` line 29, replace:

```tsx
    expect(screen.getAllByRole("link", { name: /Start 30-day Pro trial/ }).length).toBeGreaterThan(0);
```

with:

```tsx
    expect(screen.getAllByRole("link", { name: /Start your 30-day trial/ }).length).toBeGreaterThan(0);
```

- [ ] **Step 4: Run the full suite, expect green**

Run: `npx vitest run`
Expected: 0 failed. If any file still fails, fix before proceeding — every later task assumes a green baseline.

- [ ] **Step 5: Commit**

```bash
git add vitest.config.ts src/components/Shell.test.tsx pages/Home.test.tsx
git commit -m "test: exclude functions workspace from root run, refresh stale Shell/Home assertions"
```

---

### Task 2: Fix hero copy grammar

**Files:**
- Modify: `pages/Home.tsx:86-92`
- Test: `pages/Home.test.tsx`

- [ ] **Step 1: Write the failing test**

Add inside the existing `describe("Home", ...)` block in `pages/Home.test.tsx`:

```tsx
  it("uses the corrected hero copy", () => {
    render(
      <MemoryRouter>
        <Home user={null} isPaid={false} onSignInClick={() => {}} reviewSummaries={[summary]} trackedIds={[]} onToggleTrack={() => {}} />
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "An intelligence layer for your sales cycle",
    );
    expect(
      screen.getByText(/Real intelligence from enterprise sales cycles/),
    ).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run pages/Home.test.tsx`
Expected: FAIL — heading currently reads "to your sales cycle" and subtext starts "Purveyor of intelligence".

- [ ] **Step 3: Fix the copy in Home.tsx**

In `pages/Home.tsx`, replace the `<h1>` block (lines 86-89):

```tsx
          <h1 className="font-extrabold text-4xl md:text-6xl leading-[1.04] tracking-tight mb-5">
            An intelligence layer
            <br className="hidden sm:block" /> for your <span className="text-accent-soft">sales cycle</span>
          </h1>
```

And replace the subtext paragraph (lines 90-92):

```tsx
          <p className="text-lg text-slate-300 max-w-xl mx-auto mb-9 leading-relaxed">
            Real intelligence from enterprise sales cycles. See how target accounts actually buy, before you spend a quarter finding out.
          </p>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run pages/Home.test.tsx`
Expected: PASS (all tests in file).

- [ ] **Step 5: Commit**

```bash
git add pages/Home.tsx pages/Home.test.tsx
git commit -m "copy(home): fix hero grammar, replace purveyor line"
```

---

### Task 3: Create OG image and fix social meta tags

LinkedIn/Twitter crawlers require an absolute `og:image` URL, and `public/og-image.png` does not exist at all today — every campaign share renders imageless.

**Files:**
- Create: `scripts/og-image.svg`
- Create: `public/og-image.png` (generated)
- Modify: `index.html:23,30`

- [ ] **Step 1: Create the SVG source**

Create `scripts/og-image.svg` (1200x630, brand navy + accent, system fonts for reliable rasterisation):

```svg
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="630" fill="#0e1426"/>
  <rect x="0" y="0" width="1200" height="6" fill="#4f46e5"/>
  <circle cx="1020" cy="500" r="260" fill="#4f46e5" opacity="0.12"/>
  <circle cx="90" cy="120" r="7" fill="#34d399"/>
  <text x="112" y="128" font-family="Menlo, Consolas, monospace" font-size="22" letter-spacing="4" fill="#34d399">DEAL INTELLIGENCE</text>
  <text x="86" y="270" font-family="Helvetica, Arial, sans-serif" font-size="104" font-weight="800" fill="#ffffff">dealecho</text>
  <text x="86" y="360" font-family="Helvetica, Arial, sans-serif" font-size="40" fill="#cbd5e1">Know the buyer before the first call.</text>
  <text x="86" y="420" font-family="Helvetica, Arial, sans-serif" font-size="28" fill="#94a3b8">Real intelligence from enterprise sales cycles.</text>
  <text x="86" y="560" font-family="Helvetica, Arial, sans-serif" font-size="26" font-weight="700" fill="#818cf8">dealecho.io</text>
</svg>
```

- [ ] **Step 2: Rasterise to PNG**

Run: `npx --yes sharp-cli -i scripts/og-image.svg -o public/og-image.png`
(If sharp-cli argument style differs in the installed version, `npx sharp-cli --help` — the goal is a 1200x630 PNG at `public/og-image.png`.)

- [ ] **Step 3: Verify dimensions and eyeball it**

Run: `sips -g pixelWidth -g pixelHeight public/og-image.png`
Expected: `pixelWidth: 1200`, `pixelHeight: 630`.
Then open the PNG with the Read tool and confirm text renders (no missing-font tofu). If fonts failed, adjust `font-family` fallbacks in the SVG and regenerate.

- [ ] **Step 4: Fix meta tags in index.html**

Replace line 23:

```html
  <meta property="og:image" content="https://dealecho.io/og-image.png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="dealecho - Know the buyer before the first call" />
```

Replace line 30 (twitter:image):

```html
  <meta name="twitter:image" content="https://dealecho.io/og-image.png" />
```

- [ ] **Step 5: Commit**

```bash
git add scripts/og-image.svg public/og-image.png index.html
git commit -m "fix(seo): add og-image asset, use absolute social image URLs"
```

**Post-deploy manual check (note for Brendan):** run https://www.linkedin.com/post-inspector/ against https://dealecho.io after the deploy goes live to flush LinkedIn's cache.

---

### Task 4: Add a 404 page and catch-all route

**Files:**
- Create: `pages/NotFound.tsx`
- Create: `pages/NotFound.test.tsx`
- Modify: `App.tsx` (lazy import + `path="*"` route)

- [ ] **Step 1: Write the failing test**

Create `pages/NotFound.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import NotFound from "./NotFound";

describe("NotFound", () => {
  it("renders the 404 message with recovery links", () => {
    render(
      <MemoryRouter>
        <NotFound />
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { name: /Page not found/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Back to home/ })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: /Search accounts/ })).toHaveAttribute("href", "/search");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run pages/NotFound.test.tsx`
Expected: FAIL — module `./NotFound` not found.

- [ ] **Step 3: Create the page**

First read `src/hooks/useSEO.ts` to confirm the options shape (Home passes `title`/`description`/`keywords`; assume `keywords` optional — if it is required, pass `keywords: ""`). Then create `pages/NotFound.tsx`:

```tsx
import React from "react";
import { useSEO } from "../src/hooks/useSEO";
import Button from "../src/components/ui/Button";

const NotFound: React.FC = () => {
  useSEO({
    title: "Page not found - Dealecho",
    description: "The page you were looking for does not exist.",
  });
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-6 text-center bg-slate-50">
      <p className="font-mono text-2xs uppercase tracking-[0.16em] text-slate-400 mb-3">404</p>
      <h1 className="font-extrabold text-3xl text-slate-900 mb-2">Page not found</h1>
      <p className="text-slate-500 text-sm mb-8 max-w-sm">
        The page you were looking for does not exist or may have moved.
      </p>
      <div className="flex gap-3">
        <Button variant="primary" to="/">Back to home</Button>
        <Button variant="outline" to="/search">Search accounts</Button>
      </div>
    </div>
  );
};

export default NotFound;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run pages/NotFound.test.tsx`
Expected: PASS.

- [ ] **Step 5: Wire the route in App.tsx**

Add with the other lazy imports:

```tsx
const NotFound = lazy(() => import("./pages/NotFound"));
```

Add as the LAST route inside `<Routes>` (after the `/company/:companyId` route):

```tsx
              <Route path="*" element={<NotFound />} />
```

- [ ] **Step 6: Type-check and run suite**

Run: `npm run type-check && npx vitest run`
Expected: both clean.

- [ ] **Step 7: Commit**

```bash
git add pages/NotFound.tsx pages/NotFound.test.tsx App.tsx
git commit -m "feat: add 404 page with catch-all route"
```

---

### Task 5: Fix navigation links (logged-in Search/Pricing, logged-out Search path)

**Files:**
- Modify: `src/components/Shell.tsx:25-46`
- Test: `src/components/Shell.test.tsx`

- [ ] **Step 1: Write the failing tests**

Add to `src/components/Shell.test.tsx`:

```tsx
  it("gives logged-in users Search, and Pricing when not paid", () => {
    render(
      <MemoryRouter>
        <Navigation user={{ name: "Sam", avatar: "" } as any} isAdmin={false} isPaid={false} onSignInClick={noop} onSignUpClick={noop} onLogout={noop} notificationCount={0} />
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: "Search" })).toHaveAttribute("href", "/search");
    expect(screen.getByRole("link", { name: "Pricing" })).toHaveAttribute("href", "/pricing");
  });

  it("points the logged-out Search link at /search", () => {
    render(
      <MemoryRouter>
        <Navigation user={null} isAdmin={false} isPaid={false} onSignInClick={noop} onSignUpClick={noop} onLogout={noop} notificationCount={0} />
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: "Search" })).toHaveAttribute("href", "/search");
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/Shell.test.tsx`
Expected: 2 new tests FAIL (no Search link for logged-in; logged-out Search href is "/").

- [ ] **Step 3: Update Shell.tsx nav link construction**

Replace lines 25-34 (`const navLinks = [...]` through the `isAdmin` push) with:

```tsx
  const navLinks = [
    { name: "Search", path: "/search", icon: "fa-search" },
    { name: "Write Review", path: "/review/new", icon: "fa-pen-nib" },
    { name: "Control Centre", path: "/control-centre", icon: "fa-user-circle" },
  ];
  if (!isPaid) {
    navLinks.push({ name: "Pricing", path: "/pricing", icon: "fa-tags" });
  }
  if (isEnterprise) {
    navLinks.push({ name: "Team", path: "/settings/team", icon: "fa-users" });
  }
  if (isAdmin) {
    navLinks.push({ name: "Admin", path: "/admin", icon: "fa-shield-alt" });
  }
```

Then fix the two logged-out link arrays (desktop, line ~60, and `mobileLinks`, line ~44): change `{ name: "Search", path: "/", icon: "fa-search" }` to `{ name: "Search", path: "/search", icon: "fa-search" }` in both.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/Shell.test.tsx`
Expected: PASS (all).

- [ ] **Step 5: Commit**

```bash
git add src/components/Shell.tsx src/components/Shell.test.tsx
git commit -m "fix(nav): add Search/Pricing to signed-in nav, point Search link at /search"
```

---

### Task 6: Open sign-in modal on protected-route bounce + redirect new signups to /search

Today `ProtectedRoute` silently dumps logged-out users on the home page (footer "Write Review" / "Analytics" / "Control Centre" all do this), and after signup the modal just closes with no direction.

**Files:**
- Create: `src/components/AuthRedirectBridge.tsx`
- Create: `src/components/AuthRedirectBridge.test.tsx`
- Modify: `components/ProtectedRoute.tsx:34-36`
- Modify: `App.tsx` (state, handlers, mount bridge)

- [ ] **Step 1: Write the failing tests**

Create `src/components/AuthRedirectBridge.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import AuthRedirectBridge from "./AuthRedirectBridge";

describe("AuthRedirectBridge", () => {
  it("opens the sign-in modal when routed with openSignIn state", () => {
    const onOpenSignIn = vi.fn();
    render(
      <MemoryRouter initialEntries={[{ pathname: "/", state: { openSignIn: true } }]}>
        <AuthRedirectBridge onOpenSignIn={onOpenSignIn} postAuthPath={null} onConsumePostAuth={() => {}} />
      </MemoryRouter>,
    );
    expect(onOpenSignIn).toHaveBeenCalledTimes(1);
  });

  it("navigates to postAuthPath and consumes it", () => {
    const onConsume = vi.fn();
    render(
      <MemoryRouter initialEntries={["/"]}>
        <AuthRedirectBridge onOpenSignIn={() => {}} postAuthPath="/search" onConsumePostAuth={onConsume} />
        <Routes>
          <Route path="/" element={<div>home</div>} />
          <Route path="/search" element={<div>search page</div>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText("search page")).toBeInTheDocument();
    expect(onConsume).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/AuthRedirectBridge.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Create the bridge component**

Create `src/components/AuthRedirectBridge.tsx`:

```tsx
import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

interface AuthRedirectBridgeProps {
  /** Called when a route was reached with { openSignIn: true } location state (ProtectedRoute bounce). */
  onOpenSignIn: () => void;
  /** When set (e.g. "/search" after a fresh signup), navigate there once and consume. */
  postAuthPath: string | null;
  onConsumePostAuth: () => void;
}

const AuthRedirectBridge: React.FC<AuthRedirectBridgeProps> = ({
  onOpenSignIn,
  postAuthPath,
  onConsumePostAuth,
}) => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if ((location.state as { openSignIn?: boolean } | null)?.openSignIn) {
      onOpenSignIn();
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location, navigate, onOpenSignIn]);

  useEffect(() => {
    if (postAuthPath) {
      navigate(postAuthPath);
      onConsumePostAuth();
    }
  }, [postAuthPath, navigate, onConsumePostAuth]);

  return null;
};

export default AuthRedirectBridge;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/AuthRedirectBridge.test.tsx`
Expected: PASS.

- [ ] **Step 5: Make ProtectedRoute signal the modal**

In `components/ProtectedRoute.tsx`, replace the `requireAuth` branch:

```tsx
  if (requireAuth && !user) {
    return <Navigate to="/" replace state={{ openSignIn: true }} />;
  }
```

(Leave the admin and paid branches as they are.)

- [ ] **Step 6: Wire into App.tsx**

a. Imports — add `getAdditionalUserInfo` to the `firebase/auth` import list, and:

```tsx
import AuthRedirectBridge from "./src/components/AuthRedirectBridge";
```

b. State — next to the other `useState` calls in `App`:

```tsx
  const [postAuthPath, setPostAuthPath] = useState<string | null>(null);
```

c. Replace `onGoogleLogin` so new Google users get redirected:

```tsx
  const onGoogleLogin = async () => {
    try {
      const res = await signInWithPopup(auth, googleProvider);
      if (getAdditionalUserInfo(res)?.isNewUser) setPostAuthPath("/search");
    } catch (err: any) {
      if (err?.code !== "auth/popup-closed-by-user")
        console.error("Login error:", err);
    }
    setIsAuthModalOpen(false);
  };
```

d. In `onEmailLogin`, inside the `if (isNew)` branch after `updateProfile`, add:

```tsx
      setPostAuthPath("/search");
```

e. Mount the bridge directly under `<ScrollToTop />`:

```tsx
      <AuthRedirectBridge
        onOpenSignIn={triggerSignIn}
        postAuthPath={postAuthPath}
        onConsumePostAuth={() => setPostAuthPath(null)}
      />
```

- [ ] **Step 7: Type-check and full suite**

Run: `npm run type-check && npx vitest run`
Expected: clean.

- [ ] **Step 8: Commit**

```bash
git add src/components/AuthRedirectBridge.tsx src/components/AuthRedirectBridge.test.tsx components/ProtectedRoute.tsx App.tsx
git commit -m "feat(auth): open sign-in modal on protected bounce, send new signups to /search"
```

---

### Task 7: Pricing page conversion fixes

Four fixes: free-tier signup CTA, self-linking bottom CtaBand, silent-disabled Enterprise button for Pro users, currency consistency.

**Files:**
- Modify: `src/components/ui/CtaBand.tsx`
- Test: `src/components/ui/CtaBand.test.tsx`
- Modify: `pages/Pricing.tsx`

- [ ] **Step 1: Write the failing CtaBand onClick test**

Add to `src/components/ui/CtaBand.test.tsx` (add `vi` and `fireEvent` to imports):

```tsx
  it("renders a button and fires onClick when no route is given", () => {
    const spy = vi.fn();
    render(
      <MemoryRouter>
        <CtaBand headline="Ready?" ctaLabel="Start free trial" onClick={spy} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: /Start free trial/ }));
    expect(spy).toHaveBeenCalledTimes(1);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/ui/CtaBand.test.tsx`
Expected: FAIL — `to` is required, no button rendered.

- [ ] **Step 3: Make CtaBand accept onClick / optional to**

Replace the props interface and destructure in `src/components/ui/CtaBand.tsx`:

```tsx
interface CtaBandProps {
  headline: string;
  subtext?: string;
  ctaLabel: string;
  to?: string;
  onClick?: () => void;
}

const CtaBand: React.FC<CtaBandProps> = ({ headline, subtext, ctaLabel, to, onClick }) => (
```

and pass both through to Button:

```tsx
      <Button variant="primary" to={to} onClick={onClick}>
        {ctaLabel} →
      </Button>
```

(`Button` already renders a `<Link>` when `to` is set, otherwise a `<button>` with `onClick` — no Button changes needed.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/ui/CtaBand.test.tsx`
Expected: PASS.

- [ ] **Step 5: Fix the free "Pioneer" card CTA in Pricing.tsx**

Replace the dead button (lines 295-297):

```tsx
          {!user ? (
            <button
              onClick={onSignUpClick}
              className="w-full py-4 rounded-control border-2 border-navy text-navy font-bold text-sm hover:bg-navy hover:text-white transition-colors"
            >
              Sign up free
            </button>
          ) : (
            <button className="w-full py-4 rounded-control border-2 border-slate-100 text-slate-400 font-semibold text-sm cursor-not-allowed">
              {isPaid ? "Free tier" : "Current plan"}
            </button>
          )}
```

- [ ] **Step 6: Fix the self-linking bottom CtaBand in Pricing.tsx**

Replace the closing CtaBand (lines 395-400):

```tsx
        <CtaBand
          headline="Ready to stop guessing?"
          subtext="Start your 30-day Pro trial. Cancel anytime."
          ctaLabel="Start free trial"
          onClick={handleSubscribe}
        />
```

(`handleSubscribe` already opens the signup modal for logged-out users and Stripe checkout for logged-in ones.)

- [ ] **Step 7: Explain the disabled Enterprise button for Pro users**

Replace the Enterprise button block (lines 379-391):

```tsx
          {tier === 'enterprise' ? (
            <button className="w-full py-4 rounded-control border-2 border-slate-100 text-slate-400 font-semibold text-sm cursor-not-allowed">
              Active plan
            </button>
          ) : isPaid ? (
            <div className="space-y-2">
              <button
                disabled
                className="w-full py-4 rounded-control border-2 border-slate-100 text-slate-400 font-semibold text-sm cursor-not-allowed"
              >
                Get Enterprise
              </button>
              <p className="text-2xs text-slate-400 text-center leading-normal">
                On Pro? Cancel your Pro plan via the Control Centre billing portal first, then upgrade to Enterprise here.
              </p>
            </div>
          ) : (
            <button
              onClick={handleEnterpriseSubscribe}
              disabled={isProcessing}
              className="w-full py-4 rounded-control bg-accent hover:bg-accent-700 text-white font-bold text-sm uppercase tracking-wider transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? "Processing…" : "Get Enterprise"}
            </button>
          )}
```

- [ ] **Step 8: Currency consistency**

a. Add state next to `annualAmount` (line ~34):

```tsx
  const [enterpriseAmount, setEnterpriseAmount] = useState(65);
  const [enterpriseSeatAmount, setEnterpriseSeatAmount] = useState(13);
```

b. In `fetchPricing` after the existing three `if` lines:

```tsx
          if (data.enterpriseAmount) setEnterpriseAmount(data.enterpriseAmount / 100);
          if (data.enterpriseSeatAmount) setEnterpriseSeatAmount(data.enterpriseSeatAmount / 100);
```

c. Enterprise price display (line 364):

```tsx
              <span className="font-display text-4xl font-bold text-slate-900">{priceCurrency}${enterpriseAmount}</span>
```

d. Seat note (line 368):

```tsx
              5 seats included · {priceCurrency}${enterpriseSeatAmount}/mo per additional user
```

e. Pro annual sub-label (line 315) — replace the whole ternary line:

```tsx
              {isAnnual
                ? `Billed annually (${priceCurrency}$${(annualAmount / 12).toFixed(0)}/mo)`
                : `Billed monthly (${priceCurrency})`}
```

- [ ] **Step 9: Type-check and full suite**

Run: `npm run type-check && npx vitest run`
Expected: clean.

- [ ] **Step 10: Commit**

```bash
git add src/components/ui/CtaBand.tsx src/components/ui/CtaBand.test.tsx pages/Pricing.tsx
git commit -m "fix(pricing): free-tier signup CTA, working bottom CTA, enterprise guidance for Pro users, currency consistency"
```

---

### Task 8: Consistent gating on Search + empty-state CTA

Search currently renders `CompanyCard` without `isLoggedIn`, so logged-out visitors see metric bars that Home blurs. Also `App.tsx` never passes `user`/`isPaid` to Search, so `isPro` is silently `undefined`.

**Files:**
- Create: `pages/Search.test.tsx`
- Modify: `App.tsx` (Search route props)
- Modify: `pages/Search.tsx`

- [ ] **Step 1: Write the failing test**

Create `pages/Search.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Search from "./Search";
import { ReviewSummary } from "../src/hooks/useReviewSummaries";

vi.mock("../services/geminiService", () => ({
  searchCompanies: vi.fn().mockResolvedValue([]),
}));

const summary: ReviewSummary = {
  reviewId: "s1", companyId: "comp-1", companyName: "Snowflake", industry: "Data",
  location: "US", country: "US", status: "Won", createdAt: "2026-03-01T00:00:00.000Z",
  excerpt: "Technical-led, procurement-heavy.", communicationRating: 4,
  negotiationLevel: 3, timeWasterLevel: 5, clarityOfScope: 4,
};

function renderSearch(user: any) {
  return render(
    <MemoryRouter initialEntries={["/search?q=snow"]}>
      <Search
        user={user}
        isPaid={false}
        onSignInClick={() => {}}
        reviewSummaries={[summary]}
        trackedIds={[]}
        onToggleTrack={() => {}}
        isLoading={false}
      />
    </MemoryRouter>,
  );
}

describe("Search gating", () => {
  it("blurs metrics for logged-out visitors (shows sign-in lock)", async () => {
    renderSearch(null);
    expect(await screen.findByText("Snowflake")).toBeInTheDocument();
    expect(screen.getByText("Sign in to view")).toBeInTheDocument();
  });

  it("shows metrics for logged-in users (no lock)", async () => {
    renderSearch({ id: "u1", name: "Sam" });
    expect(await screen.findByText("Snowflake")).toBeInTheDocument();
    expect(screen.queryByText("Sign in to view")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run pages/Search.test.tsx`
Expected: first test FAILS — no "Sign in to view" lock because `isLoggedIn` defaults to true.

- [ ] **Step 3: Pass user through and gate the card**

a. In `pages/Search.tsx`, destructure `user` in the component signature:

```tsx
const Search: React.FC<SearchProps> = ({
  user,
  isPaid,
  reviewSummaries,
  isLoading,
}) => {
```

b. Pass the flag where reviewed results render (line ~260):

```tsx
                    {results.map((c) => (
                      <CompanyCard key={c.id} company={c} isPro={isPaid} isLoggedIn={!!user} />
                    ))}
```

c. In `App.tsx`, update the `/search` route element:

```tsx
              <Route
                path="/search"
                element={
                  <Search
                    user={user}
                    isPaid={isPaid}
                    onSignInClick={triggerSignIn}
                    reviewSummaries={reviewSummaries}
                    isLoading={summariesLoading}
                    trackedIds={trackedCompanies}
                    onToggleTrack={toggleTrackCompany}
                  />
                }
              />
```

- [ ] **Step 4: Add a Write Review CTA to the no-results empty state**

In `pages/Search.tsx`, inside the "No accounts match" card (line ~289), after the existing second `<p>`, add:

```tsx
                  <div className="mt-5 flex justify-center">
                    <Button variant="primary" to="/review/new">Share intel on this account</Button>
                  </div>
```

and add the import at the top:

```tsx
import Button from "../src/components/ui/Button";
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run pages/Search.test.tsx && npm run type-check`
Expected: PASS, clean types.

- [ ] **Step 6: Commit**

```bash
git add pages/Search.tsx pages/Search.test.tsx App.tsx
git commit -m "fix(search): blur metrics for logged-out visitors, pass user context, add empty-state review CTA"
```

---

### Task 9: Company profile — evidence for logged-in users, persona fetch only for Pro

Two changes: (1) match the free-tier promise "Basic review feeds" by showing the evidence list to any logged-in user (AI playbook, trend strip, and flag evidence stay Pro); (2) stop firing the Gemini persona call for non-Pro visitors — today every visitor with reviews triggers it and the result is never rendered (cost leak).

**Files:**
- Modify: `pages/CompanyProfile.tsx:188-213,310`
- Test: `pages/CompanyProfile.test.tsx`

- [ ] **Step 1: Read `src/components/intel/ReviewCard.tsx` and `EvidenceList.tsx`**

Confirm they take only `reviews` and render no Pro-gated props. (EvidenceList is a 19-line mapper; ReviewCard ~73 lines.) If ReviewCard exposes anything Pro-only, keep that piece gated — but the audit found none.

- [ ] **Step 2: Update the tests to the new contract**

In `pages/CompanyProfile.test.tsx`, replace the two existing tests with three:

```tsx
describe("CompanyProfile spine", () => {
  it("shows flags gate and evidence to logged-in free users, but no playbook", async () => {
    renderPage(false);
    expect(await screen.findByText("Snowflake")).toBeInTheDocument();
    expect(screen.getByText(/unlock \d+ flags/i)).toBeInTheDocument();
    expect(await screen.findByText(/They ghosted us/)).toBeInTheDocument();
    expect(screen.queryByText("CFO veto")).not.toBeInTheDocument();
  });

  it("shows evidence and playbook to Pro users", async () => {
    renderPage(true);
    expect(await screen.findByText(/They ghosted us/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("CFO veto")).toBeInTheDocument());
  });

  it("hides evidence from logged-out visitors", async () => {
    render(
      <MemoryRouter initialEntries={[{ pathname: "/company/comp-1", state: { company } }]}>
        <CompanyProfile
          user={null}
          isPaid={false}
          onSignInClick={() => {}}
          reviews={[review]}
          allTrackedIds={[]}
          onToggleTrack={() => {}}
        />
      </MemoryRouter>,
    );
    expect(await screen.findByText("Snowflake")).toBeInTheDocument();
    expect(screen.queryByText(/They ghosted us/)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run tests to verify the new expectations fail**

Run: `npx vitest run pages/CompanyProfile.test.tsx`
Expected: test 1 FAILS (evidence hidden for free users today); tests 2-3 pass.

- [ ] **Step 4: Implement both changes in CompanyProfile.tsx**

a. Persona effect (line ~188) — gate on Pro:

```tsx
  useEffect(() => {
    if (isPro && company && filteredReviews.length > 0) {
```

Note: `isPro` is defined after the early return (`const isPro = isPaid;` line ~241) — the effect runs before that, so use `isPaid` directly in the effect and add it to the dependency array:

```tsx
  useEffect(() => {
    if (isPaid && company && filteredReviews.length > 0) {
      // ...existing body unchanged...
    } else {
      setAiPersona(null);
    }
  }, [isPaid, company, filteredReviews]);
```

b. Evidence section (line ~310) — change the guard from `isPro && hasReviews` to logged-in:

```tsx
      {user && hasReviews && (
```

(Everything inside — team filters, sort, `EvidenceList` — stays as is. `FlagList`/`FlagCard` keep `isPro`, `TrendStrip` and `Playbook` keep their `isPro` guards.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run pages/CompanyProfile.test.tsx && npm run type-check`
Expected: PASS, clean.

- [ ] **Step 6: Commit**

```bash
git add pages/CompanyProfile.tsx pages/CompanyProfile.test.tsx
git commit -m "fix(profile): show review evidence to logged-in users, fetch AI persona only for Pro (cost)"
```

---

### Task 10: Analytics — Firebase Analytics + funnel events

No analytics exist anywhere. `VITE_FIREBASE_MEASUREMENT_ID` is already in `.env.local` and wired into `firebaseConfig` (`src/firebase/config.ts`), so Firebase Analytics (GA4) needs zero new accounts.

**Files:**
- Create: `src/utils/analytics.ts`
- Create: `src/utils/analytics.test.ts`
- Modify: `App.tsx` (page views + auth events)
- Modify: `pages/Pricing.tsx` (checkout events)
- Modify: `pages/CreateReview.tsx` (review event)

- [ ] **Step 1: Write the failing test**

Create `src/utils/analytics.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const logEvent = vi.fn();
vi.mock("firebase/analytics", () => ({
  isSupported: vi.fn().mockResolvedValue(true),
  getAnalytics: vi.fn().mockReturnValue({ app: "stub" }),
  logEvent: (...args: unknown[]) => logEvent(...args),
}));
vi.mock("../firebase/config", () => ({ default: {} }));

describe("track", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_FIREBASE_MEASUREMENT_ID", "G-TEST123");
    logEvent.mockClear();
    vi.resetModules();
  });

  it("logs the event with params when analytics is supported", async () => {
    const { track } = await import("./analytics");
    await track("page_view", { page_path: "/pricing" });
    expect(logEvent).toHaveBeenCalledWith(
      { app: "stub" },
      "page_view",
      { page_path: "/pricing" },
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/utils/analytics.test.ts`
Expected: FAIL — module `./analytics` not found.

- [ ] **Step 3: Create the analytics module**

Create `src/utils/analytics.ts`:

```ts
import { getAnalytics, isSupported, logEvent, type Analytics } from "firebase/analytics";
import app from "../firebase/config";

let analytics: Analytics | null = null;
let ready: Promise<void> | null = null;

/** Lazily initialise Firebase Analytics. No-ops when unsupported
 *  (SSR, some corporate browsers) or when no measurement ID is configured. */
function init(): Promise<void> {
  if (!ready) {
    ready = isSupported()
      .then((ok) => {
        if (ok && import.meta.env.VITE_FIREBASE_MEASUREMENT_ID) {
          analytics = getAnalytics(app);
        }
      })
      .catch(() => {
        /* analytics must never break the app */
      });
  }
  return ready;
}

export async function track(
  event: string,
  params?: Record<string, unknown>,
): Promise<void> {
  try {
    await init();
    if (analytics) logEvent(analytics, event, params);
  } catch {
    /* swallow — analytics must never break the app */
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/utils/analytics.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire page views and auth events in App.tsx**

a. Import:

```tsx
import { track } from "./src/utils/analytics";
```

b. SPA page views — extend the existing `ScrollToTop` effect:

```tsx
const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
    track("page_view", { page_path: pathname, page_location: window.location.href });
  }, [pathname]);
  return null;
};
```

c. In `onGoogleLogin`, after the `signInWithPopup` result (inside the try, alongside the `isNewUser` check from Task 6):

```tsx
      const isNew = getAdditionalUserInfo(res)?.isNewUser;
      if (isNew) setPostAuthPath("/search");
      track(isNew ? "sign_up" : "login", { method: "google" });
```

d. In `onEmailLogin`:

```tsx
    if (isNew) {
      const res = await createUserWithEmailAndPassword(auth, email, pass);
      if (name) await updateProfile(res.user, { displayName: name });
      setPostAuthPath("/search");
      track("sign_up", { method: "password" });
    } else {
      await signInWithEmailAndPassword(auth, email, pass);
      track("login", { method: "password" });
    }
```

- [ ] **Step 6: Wire checkout events in Pricing.tsx**

a. Import: `import { track } from "../src/utils/analytics";`

b. In `handleSubscribe`, right after the `if (!user)` guard:

```tsx
    track("begin_checkout", { plan: isAnnual ? "annual" : "monthly" });
```

c. In `handleEnterpriseSubscribe`, same position:

```tsx
    track("begin_checkout", { plan: "enterprise" });
```

d. In the checkout-success poll, inside the branch that sets "Upgrade successful!":

```tsx
            track("checkout_success", { plan: "pro" });
```

- [ ] **Step 7: Wire the review event in CreateReview.tsx**

Import `track` the same way; in the submit handler's success branch (line ~144, next to `toast.success("Review submitted for moderation.")`):

```tsx
        track("review_submitted", { company: selectedCompany.name });
```

- [ ] **Step 8: Type-check and full suite**

Run: `npm run type-check && npx vitest run`
Expected: clean.

- [ ] **Step 9: Verify the production build env has the measurement ID**

Run: `grep -rn "VITE_FIREBASE" .github/workflows/ 2>/dev/null; cat firebase.json | head -30; cat vercel.json`
Determine where the frontend production build gets its env vars (Vercel dashboard or GitHub Actions secrets). If `VITE_FIREBASE_MEASUREMENT_ID` is not set there, flag it to Brendan in the final report — without it, production silently sends nothing.

- [ ] **Step 10: Commit**

```bash
git add src/utils/analytics.ts src/utils/analytics.test.ts App.tsx pages/Pricing.tsx pages/CreateReview.tsx
git commit -m "feat(analytics): Firebase Analytics with page views and funnel events (sign_up, login, begin_checkout, checkout_success, review_submitted)"
```

**Post-deploy manual check (note for Brendan):** open Firebase console → Analytics → Realtime while clicking around dealecho.io; events appear within ~60s.

---

### Task 11: Design token sweep — retire the old indigo style

MyIntel, GlobalTrends, CreateReview's signed-out screen, ProtectedRoute's loader, and AuthModal's header still use the pre-redesign indigo/rounded-[48px]/font-black language. Mechanical token swap, one file per step, no layout changes.

**Substitution map (apply in className strings only):**

| Old | New |
|---|---|
| `bg-[#0f172a]`, `bg-[#101426]` | `bg-navy` |
| `bg-indigo-600`, `bg-indigo-500` | `bg-accent` |
| `hover:bg-indigo-700`, `hover:bg-indigo-500` (on accent buttons) | `hover:bg-accent-700` |
| `text-indigo-600`, `text-indigo-500` | `text-accent` |
| `text-indigo-200`, `text-indigo-300`, `text-indigo-400` | `text-accent-soft` |
| `bg-indigo-500/5`, `bg-indigo-500/10`, `bg-indigo-600/20`, `bg-indigo-600/30` (glow/badge washes) | same value with `accent`: `bg-accent/5`, `bg-accent/10`, etc. |
| `border-indigo-*` | `border-accent/30` (pick nearest opacity) |
| `shadow-indigo-*` | drop the colored shadow (keep `shadow-2xl`/`shadow-xl`) |
| `border-b-4 border-indigo-700` (button bevel) | drop |
| `rounded-[48px]`, `rounded-[40px]`, `rounded-[32px]`, `rounded-[28px]` (cards/panels) | `rounded-card` |
| `rounded-[24px]`, `rounded-2xl` (buttons/controls) | `rounded-control` |
| `font-black` | `font-bold` |

Tailwind arbitrary values like `blur-[120px]` and dark-glass overlays (`bg-white/5 border-white/10`) may stay — only the indigo hues, radii, and weight change.

- [ ] **Step 1: Inventory the offenders**

Run: `grep -rn "indigo\|#0f172a\|#101426\|font-black\|rounded-\[48px\]\|rounded-\[40px\]\|rounded-\[32px\]\|rounded-\[28px\]" pages components src --include="*.tsx" | grep -v ".test."`
Expected files: `pages/MyIntel.tsx`, `pages/GlobalTrends.tsx`, `pages/CreateReview.tsx`, `components/ProtectedRoute.tsx`, `components/AuthModal.tsx`. Work through them one per step.

- [ ] **Step 2: components/ProtectedRoute.tsx loader**

Replace the loading return with the shell used by App's `RouteFallback`:

```tsx
  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-accent animate-spin" />
      </div>
    );
  }
```

Run: `npx vitest run && npm run type-check`, then commit:

```bash
git add components/ProtectedRoute.tsx
git commit -m "style: align ProtectedRoute loader with design system"
```

- [ ] **Step 3: components/AuthModal.tsx header**

Apply the map: `bg-[#0f172a]` → `bg-navy`, all `font-black` → `font-bold`, `rounded-2xl`/`rounded-xl` on interactive controls → `rounded-control` (the success/error banner containers may keep their radii via `rounded-control` too). Verify with `grep -n "indigo\|#0f172a\|font-black" components/AuthModal.tsx` → no output. Run suite, commit:

```bash
git add components/AuthModal.tsx
git commit -m "style: align AuthModal with design system tokens"
```

- [ ] **Step 4: pages/CreateReview.tsx**

Apply the full map (signed-out gate screen at line ~165 and the form header at line ~200 are the dense spots). Verify: `grep -n "indigo\|#0f172a\|#101426\|font-black\|rounded-\[48px\]\|rounded-\[28px\]" pages/CreateReview.tsx` → no output. Run suite, commit:

```bash
git add pages/CreateReview.tsx
git commit -m "style: align CreateReview with design system tokens"
```

- [ ] **Step 5: pages/GlobalTrends.tsx**

Apply the full map (paywall overlay at line ~152 and hero at ~114). Verify with the same grep against this file → no output. Run suite, commit:

```bash
git add pages/GlobalTrends.tsx
git commit -m "style: align GlobalTrends with design system tokens"
```

- [ ] **Step 6: pages/MyIntel.tsx**

Largest file (782 lines) — apply the map throughout. Verify with the same grep → no output. Run suite, commit:

```bash
git add pages/MyIntel.tsx
git commit -m "style: align MyIntel with design system tokens"
```

- [ ] **Step 7: Repo-wide verification**

Run: `grep -rn "indigo\|#0f172a\|#101426\|font-black" pages components src --include="*.tsx" | grep -v ".test."`
Expected: no output. Then `npm run type-check && npx vitest run` — clean.

- [ ] **Step 8: Visual check**

Start the dev server (preview tools), snapshot `/` (open the auth modal), `/review/new` while logged out, and `/trends` route bounce. Screenshot for the final report. Fix anything that reads broken (spacing/contrast), re-run suite.

---

### Task 12: Extend sitemap

**Files:**
- Modify: `public/sitemap.xml`

- [ ] **Step 1: Add the legal pages**

Insert before `</urlset>`:

```xml
  <url>
    <loc>https://dealecho.io/terms</loc>
    <changefreq>monthly</changefreq>
    <priority>0.3</priority>
  </url>
  <url>
    <loc>https://dealecho.io/privacy</loc>
    <changefreq>monthly</changefreq>
    <priority>0.3</priority>
  </url>
```

- [ ] **Step 2: Commit**

```bash
git add public/sitemap.xml
git commit -m "seo: add terms and privacy to sitemap"
```

---

### Task 13: Final verification and handoff

- [ ] **Step 1: Full gate**

Run: `npm run type-check && npx vitest run && npm run build`
Expected: all clean. `npm run build` also runs the TypeScript check per CLAUDE.md.

- [ ] **Step 2: End-to-end preview walk**

Dev server via preview tools. Verify, logged out:
1. `/` — new hero copy, blurred metric cards with "Sign in to view".
2. `/search?q=snowflake` — blurred metrics + lock; bogus query shows empty state with "Share intel on this account" button.
3. `/pricing` — "Sign up free" opens signup modal; bottom "Start free trial" opens signup modal.
4. `/control-centre` — bounces to `/` AND the sign-in modal opens.
5. `/definitely-not-a-page` — 404 page renders.
6. Browser console — no errors; network shows `google-analytics.com/g/collect` beacons (page_view).
Screenshot key pages as proof.

- [ ] **Step 3: Push (deploys automatically)**

```bash
git push origin main
```

Note: push triggers CI deploy per CLAUDE.md. Confirm with Brendan before pushing if any behavior in this plan was adjusted during execution.

- [ ] **Step 4: Report post-deploy manual checklist to Brendan**

1. LinkedIn Post Inspector on `https://dealecho.io` — confirm og-image renders (flushes LinkedIn cache).
2. Firebase console → Analytics → Realtime — confirm events flow from production.
3. Confirm `VITE_FIREBASE_MEASUREMENT_ID` (and the other `VITE_FIREBASE_*` vars) are present in the production build environment (finding from Task 10 Step 9).
4. When the browser extension ships: replace `PLACEHOLDER_EXTENSION_ID` in `src/constants/dealData.ts` (deliberately untouched by this plan).
