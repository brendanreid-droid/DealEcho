# DealEcho Browser Extension — Design Spec

**Date:** 2026-06-28
**Status:** Approved (design); pending implementation plan
**Owner:** Brendan Reid

## Summary

A browser extension (Chrome + Edge, Manifest V3) that lets a sales rep identify the
company they're looking at — on a prospect's website **or** inside a CRM (Salesforce,
HubSpot) — and instantly see DealEcho's intelligence for that company in a side panel:
an aggregate summary, an AI buyer persona, and the 3 most recent reviews (Pro-gated),
with a link back to the full company card on dealecho.io.

The extension is a thin client. All resolution and data live in the existing Firebase
backend behind one new callable function.

## Goals

- Surface DealEcho company intelligence in the rep's existing workflow (CRM / web)
  without making them switch to dealecho.io.
- Work on **any website** (domain-based) and **inside any CRM** (name-based).
- Reuse the existing Firebase backend, Firestore data, and Pro gating. No new auth system.
- Ship with tight permissions for fast store approval and a clean install warning.
- Control AI/Gemini cost via caching.

## Non-Goals (this iteration)

- Auto-detection on every page load (no `<all_urls>` background watching).
- Salesforce DOM auto-scrape (deferred to P3 — Lightning shadow DOM is high-maintenance).
- Native CRM marketplace apps (AppExchange / HubSpot Marketplace).
- Writing data back into the CRM.

## Key Decisions (locked during brainstorming)

| Area | Decision |
|------|----------|
| Match logic | New search endpoint: CRM-host skip → domain-exact → fuzzy name → Gemini fallback |
| Display | Aggregate summary + AI persona (always) + 3 recent reviews (Pro) + "View full card" link |
| Auth | Firebase Auth login inside the panel; reviews gated server-side by existing `isPro` claim |
| Trigger | activeTab, click-to-open; reads `location.hostname` + highlighted text; any site |
| UI surface | Chrome Side Panel API (stays open while the rep works) |
| Domain index | Capture `domain` on companies in P1; rely on Gemini fallback at launch (no backfill gate) |

## Architecture

### Components

1. **Extension (MV3)** — React/Vite/TypeScript (same stack as the web app):
   - **Side Panel UI** — renders summary, persona, reviews, auth state. Uses
     `chrome.sidePanel`. Stays open across navigation; no broad host permissions.
   - **Background service worker** — orchestrates: receives page context, holds the
     Firebase session, calls the lookup endpoint, pushes results to the panel.
   - **On-demand content script** — injected only on icon click via `chrome.scripting`
     (granted by `activeTab`). Reads `location.hostname` and `window.getSelection()`,
     returns them to the background worker. No persistent page access.

2. **Backend** — one new callable Cloud Function `lookupCompanyReviews`
   (region `australia-southeast1`, matching existing functions).

3. **Firestore** — reuses `companies`, `reviews`, `review_summaries`. Adds an optional
   `domain` field on `companies` and a cached `persona` (see Cost Control).

### Data Flow

```
User clicks DealEcho icon
  → background injects content script (activeTab)
  → content script returns { hostname, selectionText }
  → background calls lookupCompanyReviews({ domain, name }, authToken)
  → endpoint resolves company + assembles payload (Pro-gated reviews)
  → background renders payload in the Side Panel
```

## The Lookup Endpoint — `lookupCompanyReviews`

The core of the system. Callable function (`onCall`, `cors: true`).

**Input:** `{ domain?: string, name?: string }`

**Resolution order:**
1. **CRM-host skip** — if `domain` is a known CRM/SaaS host (salesforce.com,
   lightning.force.com, hubspot.com, app.hubspot.com, …), ignore the domain and use
   `name` (the highlighted/scraped record name).
2. **Domain-exact** — normalize to the registrable domain (strip `www`, subdomains) and
   query `companies where domain == registrableDomain`.
3. **Fuzzy name** — match `name` against `companies.name` (and `reviews.companyName`).
4. **Gemini fallback** — reuse `searchCompanyEntities` to canonicalize the query to a
   known company name/domain, then re-run steps 2–3.
5. **No match** — return `{ matched: false }`; panel shows an empty/"no reviews yet" state
   with a CTA to add one.

**Output:**
```ts
{
  matched: boolean;
  companyId?: string;
  companyName?: string;
  summary?: ReviewSummary;        // from review_summaries (rating, count, healthIndex)
  persona?: BuyerPersona;         // cached AI persona (see Cost Control)
  recentReviews?: Review[];       // top 3 by createdAt — ONLY if caller isPro
  isPro: boolean;                 // so the panel knows whether to show the upgrade CTA
}
```

**Gating:** `summary` and `persona` are returned to any authenticated caller.
`recentReviews` is included **only** when `request.auth.token.role` is in
`['paid','admin','free_full']` (the existing `isPro` set). This enforces the same gating
as the Firestore rules, server-side. Non-Pro callers get `recentReviews: undefined` and
the panel shows the upgrade CTA.

## Display & Gating (panel)

- **Always (authenticated):** aggregate summary — rating, # reviews, health index — plus
  the AI buyer persona.
- **Pro only:** the 3 most recent reviews. Non-Pro sees an "Upgrade to see reviews" CTA.
- **Footer:** "View full company card" → opens `https://dealecho.io/company/{companyId}`
  in a new tab.
- **Auth:** login inside the panel (Firebase Auth — Google + email/password). Session
  persisted in extension storage. Logged-out users see a login prompt.

## Cost Control

The AI persona is the only expensive path (a Gemini call). To avoid the cost blowup:

- **Cache the persona per company.** On first request, generate via the existing
  `getAICompanyPersona` logic and store it (on the company's `review_summaries` doc or a
  dedicated `personas/{companyId}` doc) with a `generatedAt` timestamp.
- Subsequent lookups read the cache. Regenerate only when stale (TTL, e.g. 30 days) or
  when review count changes materially.
- Domain-exact and fuzzy paths cost **zero** AI. Gemini is only hit on cache-miss persona
  generation and on the fallback resolver — both bounded.

## Permissions & Store

**Manifest (MV3):**
- `permissions`: `activeTab`, `scripting`, `storage`, `sidePanel`.
- `host_permissions`: only the Firebase Functions URL (for the callable). **No `<all_urls>`.**
- Result: no "reads all your data on all websites" warning → faster, smoother store review.

**Distribution:**
- Chrome Web Store ($5 one-time dev fee; tight permissions → quick review).
- Edge Add-ons (same package, free).
- Requires a published privacy policy on dealecho.io describing what page data is read
  (domain + user-highlighted text, sent only on explicit icon click) and that no remote
  code is executed.

## Phases

- **P1 (this build):** `lookupCompanyReviews` endpoint + extension (Side Panel, activeTab,
  domain + highlight, Firebase login, summary + persona + 3 reviews + card link). Capture
  `domain` on new companies; Gemini fallback covers gaps at launch.
- **P2:** HubSpot DOM auto-scrape of the record/deal name (removes the highlight step on
  HubSpot). Backfill `domain` onto existing companies to shrink Gemini fallback usage.
- **P3:** Salesforce DOM auto-scrape (only if maintenance cost is justified).

## Testing

- **Endpoint (unit):** resolver branches — CRM-host skip, domain-exact, fuzzy name,
  Gemini fallback, no-match; Pro vs non-Pro gating of `recentReviews`; persona cache
  hit/miss.
- **Extension:** mock the callable; verify panel states (logged-out, non-Pro, Pro, no
  match); manual smoke test on a prospect site and inside HubSpot + Salesforce.

## Open Questions / Risks

- **Fuzzy name matching quality** — Firestore has no native fuzzy search. P1 may use
  prefix/normalized-exact matching and lean on the Gemini fallback for the rest; a
  dedicated search index (e.g. Algolia/Typesense) is a possible later upgrade.
- **CRM ToS** — reading the rep's own screen via a user-initiated click is low-risk, but
  confirm Salesforce/HubSpot terms before any automated background scraping in P2/P3.
- **Enterprise install policy** — some orgs block self-install of extensions; enterprise
  customers may need IT to whitelist the extension ID. Not a P1 blocker.
