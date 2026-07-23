# Search Page Redesign + Loading State Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle `pages/Search.tsx` into a navy command-hero layout with an industry-chip row and a recently-reviewed grid (filling the current empty landing state), and make the ~20s global search phase visibly active with an indigo spinner banner reading "Searching our global database…".

**Architecture:** All changes are in the single file `pages/Search.tsx` plus its test `pages/Search.test.tsx`. No backend, prop, or shared-component changes. Two new `useMemo`s (`industries`, `recentCompanies`) derive from the existing `reviewSummaries`→`companies` aggregation. The render tree splits into a navy hero band (always shown) + a light content area that branches on whether a query `q` is present. The loading banner reuses lucide-react's `Loader2` (already used in `pages/CreateReview.tsx`).

**Tech Stack:** React 19 + Vite + TS + Tailwind. Vitest + @testing-library/react (`npm test`, `npm run type-check`). Brand tokens: `navy`, `accent`, `accent-soft`, `accent-50`, `accent-100`, `signal-healthy-bright`, `rounded-card`, `rounded-control`, `shadow-hero`, `de-card`, `font-mono`.

**Spec:** docs/superpowers/specs/2026-07-23-search-page-redesign-design.md (approved).

**Reference files (read before starting):**
- [pages/Search.tsx](../../../pages/Search.tsx) — the file being rewritten (current full source)
- [pages/Home.tsx](../../../pages/Home.tsx) lines 77-127 — the navy hero + white search input pattern to mirror
- [src/components/CompanyCard.tsx](../../../src/components/CompanyCard.tsx) — `CompanyCard` (props `company: CompanyCardData`, `isPro`, `isLoggedIn`) and `CompanyCardData` shape
- [pages/Search.test.tsx](../../../pages/Search.test.tsx) — existing test conventions (MemoryRouter, geminiService mock)

**Locked decisions (do not relitigate):** Layout A (navy command hero); Loading treatment 1 (indigo banner + skeleton cards); reuse `Loader2`, no new Spinner component; `recentCompanies` capped at 6; industries capped at 6 alphabetical; empty-corpus landing shows a "be the first" CTA not an empty grid; primary copy "Searching our global database…" + subline "Scanning the web for accounts matching \"{q}\". This can take a few seconds."; plain hyphens only.

---

### Task 1: Derive `industries` and `recentCompanies` memos + landing tests

**Files:**
- Modify: `pages/Search.tsx`
- Modify: `pages/Search.test.tsx`

- [ ] **Step 1: Write failing tests.** Append to `pages/Search.test.tsx` a new describe block. It renders the LANDING state (no `q`) and asserts the recently-reviewed company and an industry chip appear. Add a second fixture summary so there is a non-trivial recency sort and a distinct industry:

```tsx
const summary2: ReviewSummary = {
  reviewId: "s2", companyId: "comp-2", companyName: "Datadog", industry: "Observability",
  location: "US", country: "US", status: "Won", createdAt: "2026-05-01T00:00:00.000Z",
  excerpt: "Fast to engage.", communicationRating: 5,
  negotiationLevel: 4, timeWasterLevel: 4, clarityOfScope: 4,
};

function renderLanding(reviewSummaries: ReviewSummary[]) {
  return render(
    <MemoryRouter initialEntries={["/search"]}>
      <Search
        user={{ id: "u1", name: "Sam" }}
        isPaid={false}
        onSignInClick={() => {}}
        reviewSummaries={reviewSummaries}
        trackedIds={[]}
        onToggleTrack={() => {}}
        isLoading={false}
      />
    </MemoryRouter>,
  );
}

describe("Search landing (no query)", () => {
  it("renders the hero heading", () => {
    renderLanding([summary, summary2]);
    expect(screen.getByText(/Find how any account buys/i)).toBeInTheDocument();
  });

  it("shows a recently-reviewed grid with reviewed companies", () => {
    renderLanding([summary, summary2]);
    // most recent first: Datadog (May) before Snowflake (Mar)
    expect(screen.getByText("Datadog")).toBeInTheDocument();
    expect(screen.getByText("Snowflake")).toBeInTheDocument();
  });

  it("renders an industry chip linking to that industry query", () => {
    renderLanding([summary, summary2]);
    const chip = screen.getByRole("link", { name: "Data" });
    expect(chip).toHaveAttribute("href", "/search?q=Data");
  });

  it("shows a be-the-first CTA when there are no reviews", () => {
    renderLanding([]);
    expect(screen.getByText(/be the first/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify failure.**

Run: `npx vitest run pages/Search.test.tsx`
Expected: FAIL — landing renders the old "Enter a company name to search." card; no hero heading, no chips, no grid.

- [ ] **Step 3: Add the two memos** to `pages/Search.tsx`. Place directly after the existing `companies` memo (around line 146). `recentCompanies` re-runs the same aggregation but keeps `lastDate` and sorts by recency; `industries` lists distinct industries from `companies`:

```tsx
// Distinct industries present in reviewed companies (for the hero quick-chips).
const industries = useMemo(
  () =>
    Array.from(new Set(companies.map((c) => c.industry).filter(Boolean)))
      .sort()
      .slice(0, 6),
  [companies],
);

// Most-recently-reviewed accounts for the landing grid (mirrors Home's sort-by-lastDate).
const recentCompanies = useMemo(() => {
  const stats: Record<string, any> = {};
  reviewSummaries.forEach((s) => {
    const name = s.companyName;
    if (!stats[name]) {
      stats[name] = {
        id: s.companyId, name: s.companyName, industry: s.industry, location: s.location,
        count: 0, respTotal: 0, negTotal: 0, wasteTotal: 0, scopeTotal: 0,
        lastDate: s.createdAt, excerpt: s.excerpt,
      };
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
    .slice(0, 6)
    .map((c) => {
      const avgResp = c.respTotal / c.count, avgNeg = c.negTotal / c.count,
        avgWaste = c.wasteTotal / c.count, avgScope = c.scopeTotal / c.count;
      const domainGuess = guessDomainFromName(c.name);
      return {
        id: c.id, name: c.name, industry: c.industry, location: c.location,
        reports: c.count, excerpt: c.excerpt,
        logoUrl: companyLogoUrl({ name: c.name, domain: domainGuess }),
        healthIndex: Math.round(((avgResp + avgNeg + avgWaste + avgScope) / 20) * 100),
        responsiveness: Math.round(avgResp * 20), negotiation: Math.round(avgNeg * 20),
        buyerIntent: Math.round(avgWaste * 20), scopeClarity: Math.round(avgScope * 20),
      };
    });
}, [reviewSummaries]);
```

Note: this is intentionally the same aggregation shape as `companies` — the DRY alternative (add `lastDate` to `companies` and sort a slice) is fine too, but keeping a separate memo avoids changing `CompanyCardData` consumers and matches the spec's chosen approach. Leave `companies` as-is.

The hero heading, chips, and grid JSX that make these tests pass are added in Task 2 (this task establishes the data + failing tests; Task 2 wires the render). To make the tests pass NOW without a huge single commit, implement the minimal landing JSX here — see Step 4.

- [ ] **Step 4: Add minimal landing render** to make the tests pass. Replace the current no-query `else` branch (the `<div className="de-card p-12 text-center">Enter a company name…</div>`, around lines 306-312) with the landing content. The full hero (Task 2) wraps everything; for this task add the heading text, chips, and grid so tests pass:

```tsx
) : (
  <div className="space-y-8">
    <h1 className="sr-only">Find how any account buys</h1>
    {industries.length > 0 && (
      <div className="flex flex-wrap gap-2">
        {industries.map((ind) => (
          <Link
            key={ind}
            to={`/search?q=${encodeURIComponent(ind)}`}
            className="bg-white/10 text-slate-200 hover:bg-white/20 px-3 py-1 rounded-full text-xs font-semibold transition-colors"
          >
            {ind}
          </Link>
        ))}
      </div>
    )}
    {recentCompanies.length > 0 ? (
      <div>
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
          Recently reviewed
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {recentCompanies.map((c) => (
            <CompanyCard key={c.id} company={c} isPro={isPaid} isLoggedIn={!!user} />
          ))}
        </div>
      </div>
    ) : (
      <div className="de-card p-12 text-center">
        <p className="text-slate-600 font-medium">No accounts reviewed yet.</p>
        <p className="text-slate-400 text-sm mt-1">Be the first to add intel on an account.</p>
        <div className="mt-5 flex justify-center">
          <Button variant="primary" to="/review/new">Share intel on an account</Button>
        </div>
      </div>
    )}
  </div>
)}
```

(The `<h1 className="sr-only">` is a placeholder so the "hero heading" test passes before Task 2 adds the visible hero; Task 2 replaces it with the real visible heading and removes the sr-only.)

- [ ] **Step 5: Run tests to verify pass.**

Run: `npx vitest run pages/Search.test.tsx`
Expected: PASS (existing 2 gating tests + 4 new landing tests). If the industry-chip test fails on `encodeURIComponent("Data")` → "Data" is unchanged, so `href="/search?q=Data"` is correct.

- [ ] **Step 6: Type-check.**

Run: `npm run type-check`
Expected: clean.

- [ ] **Step 7: Commit.**

```bash
git add pages/Search.tsx pages/Search.test.tsx
git commit -m "feat(search): recently-reviewed grid and industry chips on landing state"
```
End commit body with: Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>

---

### Task 2: Navy command hero band

**Files:**
- Modify: `pages/Search.tsx`

Wrap the page in the navy hero (search input + heading + eyebrow live inside it) and move the industry chips into the hero. The chips currently added in Task 1 (in the light area) move up into the navy band and get navy-appropriate styling; the light content area keeps only the recently-reviewed grid / results.

- [ ] **Step 1: Replace the outer structure.** The current return opens `<div className="min-h-screen bg-slate-50">` with a `max-w-6xl` container holding the search form then the q-branch. Restructure to: navy hero band containing eyebrow + heading + search form + chips, then a light container holding the q-branch content. Reference Home.tsx lines 80-126 for the hero + input treatment. New top of the return:

```tsx
return (
  <div className="min-h-screen bg-slate-50">
    {/* Navy command hero */}
    <section className="bg-navy text-white pt-16 pb-14 px-6">
      <div className="max-w-4xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 font-mono text-2xs uppercase tracking-[0.16em] text-signal-healthy-bright mb-5">
          <span className="w-1.5 h-1.5 rounded-full bg-signal-healthy-bright animate-pulse-soft" />
          Search intelligence
        </div>
        <h1 className="font-extrabold text-3xl md:text-5xl leading-[1.05] tracking-tight mb-6">
          Find how any <span className="text-accent-soft">account buys</span>
        </h1>
        <form onSubmit={handleSearch} className="max-w-xl mx-auto">
          <div className="relative">
            <svg className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              type="text"
              value={localQuery}
              onChange={(e) => setLocalQuery(e.target.value)}
              placeholder="Search any company or industry"
              aria-label="Company search"
              className="w-full rounded-card bg-white text-slate-900 placeholder-slate-400 pl-12 pr-28 py-4 text-base shadow-hero focus:outline-none focus:ring-4 focus:ring-accent/40"
            />
            <button type="submit" className="absolute right-2 top-2 bottom-2 bg-accent text-white px-6 rounded-control font-bold text-sm hover:bg-accent-700 transition-colors">
              Search
            </button>
          </div>
        </form>
        {industries.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2 mt-5">
            {industries.map((ind) => {
              const active = q.toLowerCase() === ind.toLowerCase();
              return (
                <Link
                  key={ind}
                  to={`/search?q=${encodeURIComponent(ind)}`}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                    active ? "bg-accent text-white" : "bg-white/10 text-slate-200 hover:bg-white/20"
                  }`}
                >
                  {ind}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </section>

    {/* Content area */}
    <div className="max-w-6xl mx-auto px-6 py-12">
```

- [ ] **Step 2: Remove the old in-body search form and duplicate chips.** Delete the original `<form onSubmit={handleSearch} className="mb-10">…</form>` block (old lines ~207-235) — the search input now lives in the hero. In the Task-1 landing branch, REMOVE the chips block (the `{industries.length > 0 && (<div className="flex flex-wrap gap-2">…)}`) since chips are now in the hero, and remove the `<h1 className="sr-only">` placeholder (the hero `<h1>` is now the real visible heading). The landing branch becomes just the "Recently reviewed" grid / be-the-first CTA.

- [ ] **Step 3: Close the new wrapper.** Ensure the content `<div className="max-w-6xl mx-auto px-6 py-12">` and the outer `<div>` are closed correctly at the end of the return (the old `max-w-6xl … py-14` wrapper is replaced by this one; there should be exactly one closing `</div>` for the content wrapper and one for the page root, after the `</section>`).

- [ ] **Step 4: Run tests.**

Run: `npx vitest run pages/Search.test.tsx`
Expected: PASS. The "hero heading" test now matches the visible `<h1>` ("Find how any account buys" — note the highlighted span splits the text across nodes; the test uses `getByText(/Find how any account buys/i)` which matches across the element only if text isn't split. Since "account buys" is in a nested `<span>`, use a function matcher OR assert on "Find how any" — UPDATE the Task 1 test to `expect(screen.getByText(/Find how any/i)).toBeInTheDocument();` to be robust to the span split). Apply that test tweak now if the assertion fails.

- [ ] **Step 5: Type-check + full test run.**

Run: `npm run type-check && npx vitest run pages/Search.test.tsx`
Expected: clean + green.

- [ ] **Step 6: Commit.**

```bash
git add pages/Search.tsx pages/Search.test.tsx
git commit -m "feat(search): navy command hero with in-hero search and industry chips"
```
End commit body with: Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>

---

### Task 3: Indigo "Searching our global database" loading banner

**Files:**
- Modify: `pages/Search.tsx`
- Modify: `pages/Search.test.tsx`

Replace the small grey "Searching web for X…" heading (shown while `isAiSearching`) with the indigo spinner banner over the existing skeleton grid.

- [ ] **Step 1: Write failing test.** Append to `Search.test.tsx`. Make `searchCompanies` return a never-resolving promise so `isAiSearching` stays true, then assert the banner copy renders:

```tsx
import { searchCompanies } from "../services/geminiService";

describe("Search global-search loading state", () => {
  it("shows the global-database banner while the web search is pending", async () => {
    (searchCompanies as any).mockReturnValueOnce(new Promise(() => {}));
    render(
      <MemoryRouter initialEntries={["/search?q=stripe"]}>
        <Search
          user={{ id: "u1", name: "Sam" }}
          isPaid={false}
          onSignInClick={() => {}}
          reviewSummaries={[summary]}
          trackedIds={[]}
          onToggleTrack={() => {}}
          isLoading={false}
        />
      </MemoryRouter>,
    );
    expect(await screen.findByText(/Searching our global database/i)).toBeInTheDocument();
  });
});
```

(`searchCompanies` is already `vi.fn()` via the top-of-file `vi.mock`; importing it gives the mock handle. `mockReturnValueOnce` overrides just this test.)

- [ ] **Step 2: Run to verify failure.**

Run: `npx vitest run pages/Search.test.tsx`
Expected: FAIL — current copy is "Searching web for …", not "Searching our global database".

- [ ] **Step 3: Add the Loader2 import.** At the top of `pages/Search.tsx` add:

```tsx
import { Loader2 } from "lucide-react";
```

- [ ] **Step 4: Replace the loading block.** Find the `{isAiSearching ? (` branch in the Other Accounts section (old lines ~269-275, the `<h2>Searching web for "{q}"…</h2>` + `<CardGridSkeleton count={3} />`). Replace with:

```tsx
{isAiSearching ? (
  <div>
    <div className="flex items-center gap-3 bg-accent-50 border border-accent-100 rounded-card px-4 py-3 mb-4">
      <Loader2 className="animate-spin text-accent shrink-0" size={18} />
      <div>
        <p className="text-accent font-bold text-sm">Searching our global database…</p>
        <p className="text-accent-soft text-xs">
          Scanning the web for accounts matching “{q}”. This can take a few seconds.
        </p>
      </div>
    </div>
    <CardGridSkeleton count={3} />
  </div>
) : filteredAiCompanies.length > 0 ? (
```

(Keep the rest of the ternary — the `filteredAiCompanies` grid and the trailing `: null` — unchanged.)

- [ ] **Step 5: Run tests.**

Run: `npx vitest run pages/Search.test.tsx`
Expected: PASS (all prior tests + the new loading test).

- [ ] **Step 6: Type-check.**

Run: `npm run type-check`
Expected: clean.

- [ ] **Step 7: Commit.**

```bash
git add pages/Search.tsx pages/Search.test.tsx
git commit -m "feat(search): indigo spinner banner for the global-search phase"
```
End commit body with: Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>

---

### Task 4: Verify, browser-check, deploy

**Files:** none (verification)

- [ ] **Step 1: Full gates.**

Run: `npm run type-check && npx vitest run pages/Search.test.tsx && npm run build`
Expected: all pass. (Full `npm test` has known unrelated flakiness from stray `.claude/worktrees/` test globs — run the targeted Search test file plus a full `npm test` if the worktree exclusion has landed; otherwise the targeted run is authoritative for this change.)

- [ ] **Step 2: Browser verification.** Start the dev server (Browser-pane preview `{name:"dev"}`, not Bash) and check:
  1. `/search` (no query) — navy hero with "Find how any account buys", search input, industry chips, and a "Recently reviewed" grid of real reviewed accounts below. No large empty void.
  2. Type a company that HAS local reviews and submit — reviewed results appear instantly under the hero.
  3. Type a company with NO local reviews (e.g. a random real company) and submit — the indigo "Searching our global database…" banner with a spinning icon appears over skeleton cards, then resolves to Other Accounts (or no-results CTA). Confirm the spinner actually animates and the banner is prominent.
  4. Check the browser console for errors (read_console_messages).

- [ ] **Step 3: Screenshot** the landing hero and the loading banner (computer screenshot) to share as proof.

- [ ] **Step 4: Push (deploys via CI).**

```bash
git push origin main
```

Search is a frontend-only change; the functions CI deploy is a no-op for it, but pushing is how it reaches prod (Vercel frontend). Confirm the push succeeds.

---

## Out of scope
Live stat counters (mockup C, not chosen), CompanyCard internals, health-score math, global-search backend, pagination of the recently-reviewed grid, type-ahead in the hero input.

## Self-review notes
- Spec coverage: hero (T2), chips (T1→moved T2), recently-reviewed grid + empty CTA (T1), results two-section (unchanged, preserved), loading banner + copy (T3), tests (T1/T3), browser verify (T4). All covered.
- Type consistency: `recentCompanies`/`industries` memo names used consistently T1→T2; `Loader2` import T3; `CompanyCard`/`Button`/`Link`/`CardGridSkeleton` already imported in Search.tsx.
- Known test nuance flagged inline: the hero `<h1>` splits text across a `<span>`, so the heading assertion targets `/Find how any/i` (T2 Step 4).
