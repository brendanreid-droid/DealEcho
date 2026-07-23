# Search Page Redesign + Global-Search Loading State — Design

**Date:** 2026-07-23
**Status:** Approved by Brendan (Layout A "navy command hero" + Loading treatment 1 "indigo banner + skeleton cards", chosen via mockup review)
**Mockups:** `.superpowers/brainstorm/38064-1784766913/content/search-layout.html`, `search-loading.html` (gitignored scratch; this spec is authoritative)

## Goal

Reimagine `pages/Search.tsx` so it is on-brand and content-dense instead of a lone input in a slate void, and make the ~20s global (Gemini web) search phase visibly active with a spinner and clearer copy.

## Context

`pages/Search.tsx` today: a centered search input on `bg-slate-50`, then results. Two states are weak:
- **No query** (what you land on when clicking "Search" in the header): a single small "Enter a company name" card in a large empty area.
- **Global search in progress**: a small grey `<h2>` "Searching web for X…" over skeleton cards - easy to miss during the up-to-20s Gemini call, so the page reads as stalled/blank.

The page already receives `reviewSummaries` (prop) and aggregates them into `companies: CompanyCardData[]` (name, industry, location, healthIndex, per-metric scores, logoUrl, reports, excerpt). This same data powers the redesign - no new data sources. Brand tokens: navy `#0e1426` hero, indigo `accent`, Inter display, JetBrains `mono` for data figures, `signal` health colors, `de-card` / `rounded-card` / `rounded-control`. The Home hero (`pages/Home.tsx`) is the reference pattern for the navy band + white search input.

## Part 1 — Layout A: navy command hero

Restructure the page into a navy hero band + a light content area below, matching the Home aesthetic. Two render branches driven by whether there is a query (`q`).

### 1.1 Navy hero band (always rendered, both states)

- `bg-navy text-white` band, same horizontal rhythm as Home's hero (`px-6`, generous top/bottom padding).
- Eyebrow: mono 2xs uppercase `text-signal-healthy-bright` with a pulse dot, text "Search intelligence" (mirrors Home's "Deal intelligence").
- Heading: "Find how any account buys" (font-extrabold, ~3xl/4xl, `accent-soft` on a highlighted word).
- The search `<form>` moves INTO the hero: white input (`shadow-hero`, `focus:ring-accent/40`) with an accent Search button, identical treatment to Home's hero search. Keeps existing submit → `navigate('/search?q=...')`.
- **Industry quick-chips** row under the input: derived from the distinct `industry` values present in `companies` (max ~6, alphabetical). Each chip is a `Link` to `/search?q=<industry>`. Styled as dark translucent pills (`bg-white/10 text-slate-200 hover:bg-white/20`). Rendered only when at least one industry exists. When a query is active, the chip matching the query (if any) gets an active `bg-accent text-white` state.

### 1.2 Landing content (no query)

Below the hero, on `bg-slate-50`:
- Section label "Recently reviewed" (`text-xs font-bold text-slate-400 uppercase tracking-wider`).
- A grid (`grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5`) of the most-recently-reviewed accounts: `companies` sorted by most recent review date, capped at 6, rendered with the existing `CompanyCard` (passing `isPro={isPaid}`, `isLoggedIn={!!user}`).
- To support "most recent", the `companies` aggregation must retain a sortable recency value. Add `lastDate` (already tracked in the `stats` accumulator) to the mapped `CompanyCardData`-shaped objects OR compute a separate `recentCompanies` memo. Chosen: a dedicated `recentCompanies` memo that reuses the same aggregation but sorts by `lastDate` desc and slices 6 - keeps `CompanyCardData` unchanged. (Mirror Home's sort-by-lastDate approach.)
- If `companies` is empty (no reviews in the system yet), show a single friendly `de-card` CTA ("No accounts reviewed yet - be the first" → `/review/new`) instead of an empty grid. This is the graceful-degradation case.

### 1.3 Results content (query present)

Keep the existing two-section structure (Reviewed Accounts, then Other Accounts), but:
- Move the results heading/count into the light area directly under the hero (the hero now owns the search input, so the old separate search form block at the top of the results view is removed).
- Reviewed Accounts section unchanged (local Firestore filter → `CompanyCard`s).
- Other Accounts (global) section uses the new loading treatment (Part 2).
- No-results placeholder (`de-card` "No accounts match" + review CTA) unchanged in behavior.

## Part 2 — Loading treatment 1: indigo banner + skeleton cards

Replaces the current small grey "Searching web for X…" heading during the global (Gemini) phase (`isAiSearching`).

- A prominent banner: `bg-accent-50 border border-accent-100 rounded-card`, flex row with a spinning wheel + text.
- Spinner: a small CSS spinner (indigo, `border-top-color: accent`, `animate-spin`). Add a reusable `Spinner` element (inline in this file, or `src/components/ui/Spinner.tsx` if none exists - check first; a `Loader2` from lucide-react with `animate-spin` is already used elsewhere in the codebase (`pages/CreateReview.tsx`), prefer that to avoid a new component).
- Primary line (`text-accent font-bold`): "Searching our global database…"
- Secondary line (`text-accent-soft text-xs`): "Scanning the web for accounts matching \"{q}\". This can take a few seconds."
- Below the banner: the existing `CardGridSkeleton count={3}` shimmer grid (kept - it reads as "results landing here").
- Plain hyphens only, no em dashes (project rule).

The banner + skeletons render in the Other Accounts slot whenever `isAiSearching` is true, regardless of whether local Reviewed Accounts already rendered above.

## Components & data flow

- No backend changes. No new props. No changes to `searchCompanies` or the two-phase search logic (local filter is instant; `isAiSearching` gates the Gemini call as today).
- New within `Search.tsx`: `recentCompanies` memo (aggregation sorted by recency, sliced 6); `industries` memo (distinct industry list from `companies`, sliced ~6); the navy hero JSX; the industry-chip Links; the loading banner JSX.
- Reuses: `CompanyCard`, `CardGridSkeleton`, `Loader2` (lucide), existing brand utility classes.

## Testing

`pages/Search.test.tsx` exists - extend it:
- Landing state (no `q`): renders the hero heading, the industry chips for industries present in fixture summaries, and the recently-reviewed grid (asserts a known fixture company name appears). Empty-summaries case renders the "be the first" CTA, not a broken grid.
- Results state (`q` set): renders reviewed results; while `isAiSearching` (mock `searchCompanies` pending), the "Searching our global database" banner text is present.
- Industry chip is a link to `/search?q=<industry>`.

Follow the test file's existing render/router-mock conventions. `npm test` (site) + `npm run type-check` green.

## Out of scope

- Live stat counters (that was mockup direction C, not chosen).
- Any change to CompanyCard internals, the health-score math, or the global search backend.
- Pagination / infinite scroll of the recently-reviewed grid (fixed cap of 6).
- Debounced type-ahead in the hero input (submit-driven search unchanged).

## Sequencing

Single implementation plan: layout restructure + loading banner ship together (both touch the same file's render tree). Verify in the browser preview against local + a real global-search query.
