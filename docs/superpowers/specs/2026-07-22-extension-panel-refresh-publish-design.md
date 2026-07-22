# Extension Panel Refresh ("Dense Intel Brief") + Store Publish — Design

**Date:** 2026-07-22
**Status:** Approved by Brendan (visual direction C chosen via mockup review; refined C v2 with logo header approved)
**Mockup:** `.superpowers/brainstorm/31217-1784723814/content/panel-c-refined.html` (gitignored scratch; the spec below is authoritative)

## Goal

Restyle the extension side panel to a dense, table-driven "intel brief" with a company-logo header and schema-v2 review data, then package and publish to the Chrome Web Store (and Edge Add-ons) — turning the extension into a live acquisition surface and making the Pricing page's "Add to Chrome" button real.

## Context

- Extension 2A (scaffold), 2B (auth + data), 2C (Google sign-in) are DONE and merged; the panel works end-to-end against prod. 2D (packaging/publish) never started.
- Review schema v2 shipped 2026-07-22: reviews carry optional `dealType`, `dealRegion`, `dealPeriod`, `tcvBracket` (extended), 5-value `status` (`Won | Lost | No Decision | Withdrew | Ongoing`), etc. The extension's Pro review payload already includes these fields (raw doc passthrough) — the UI just doesn't render them yet.
- Extension code lives in top-level `extension/` (own package.json, NOT an npm workspace — `npm --prefix extension <cmd>`). Backend callable: `functions/src/extension/lookupCompanyReviews.ts` (region australia-southeast1).

## Part 1 — Panel refresh

### 1.1 Backend: `matchedDomain` in the lookup response

`lookupCompanyReviews` returns a new optional field `matchedDomain: string | null`:
- Set to the queried domain when company resolution succeeded via the domain path (domain cache hit or Gemini-canonicalized domain).
- `null` when the match came from fuzzy name matching or when the host was a skipped CRM host.

Rationale: the panel must never show a CRM's favicon (salesforce.com) for a company matched by name. The server is the only place that knows which path resolved, so it declares the logo-safe domain. No Firestore changes; response shape only. Client treats absence as null (backward compatible while functions deploy lags the UI).

### 1.2 Logo component

New `CompanyLogo` in `extension/src/sidepanel/`:
- If `matchedDomain` present: `<img src="https://www.google.com/s2/favicons?domain=<matchedDomain>&sz=64">` in a 32px bordered tile (same favicon service the web app uses in `src/utils/companyLogo.ts` — free, stable).
- Fallback (no domain, or img `onerror`): initials tile — first letters of up to two words of the company name on `accent50` background, `accent` text.

### 1.3 ReviewsView restyle (dense brief)

Top-to-bottom layout, thin dividers (`1px border` rows) instead of boxed cards, on the existing `theme.tsx` tokens:

1. **Header row**: logo tile · uppercase company name (14px/800) with subline "N reviews · avg X/5" · right-aligned health number (colored by `healthColor`) over a small HEALTH eyebrow. Bottom border 2px navy.
2. **Metric table**: 2×2 (`Responsiveness | Intent / Negotiation | Scope`), value right-aligned and colored by `healthColor(value*20)`. Existing tooltips (`Tip`) preserved.
3. **Buyer persona**: indigo eyebrow label + plain paragraph (no boxed background).
4. **Red flags**: red eyebrow "⚑ N red flag(s)" + one line per flag (`label · N reports`), evidence italic line if present. Uses existing `buildFlags`.
5. **Recent reviews (Pro)**: per review, compact text block:
   - Line 1: `STATUS` (colored, uppercase) `· dealType · dealRegion · tcvBracket · dealPeriod-or-formatted-date` — v2 fields render only when present (legacy reviews show status + date only).
   - Line 2: excerpt (existing content, clamped to ~3 lines).
   - Line 3: `Resp N · Neg N · Intent N · Scope N` in muted small text (tooltips preserved).
6. **Non-Pro**: summary + persona + flags visible as today; reviews replaced by the upgrade CTA (restyled to match density).
7. **Footer**: "View full company card →" link above a thin divider.

### 1.4 Theme + API type updates

- `statusColor`: `Won` → healthy, `Lost` and `No Decision` → risk, `Withdrew` → caution, anything else (`Ongoing`, unknown) → accent-ish muted (`theme.sub` today → change to `theme.accent` for Ongoing, `theme.sub` for unknown). Mirrors the web app's ReviewCard badge mapping.
- `extension/src/lib/api.ts`: `Review` gains optional `dealType`, `dealRegion`, `dealPeriod`, `schemaVersion`; `LookupResult` gains `matchedDomain?: string | null`.

### 1.5 States

Loading / error / no-match / login views restyled to the same density (typography + spacing only; logic unchanged). No-match view keeps the "Be the first to review" custom-token bridge flow untouched.

### 1.6 Testing

- Unit: `statusColor` new outcomes; `CompanyLogo` fallback logic (initials derivation, no-domain case); ReviewsView renders v2 meta line when fields present and omits when absent; existing tests updated to the new DOM.
- Backend: `matchedDomain` set/null per resolution path (extend existing resolver/lookup tests, `npm --prefix functions test`).
- Manual: Brendan load-unpacked smoke test against prod (Datadog + a name-matched CRM case).

## Part 2 — Store packaging + publish (2D)

1. **Privacy disclosures**: add an "Browser extension" section to the site's `/privacy` page covering: what the extension reads (active-tab hostname + selected text, only on icon click), what's sent to DealEcho (domain/name lookup), auth data, no sale of data, no ad tracking. Listing's privacy-policy URL points to `https://www.dealecho.io/privacy`.
2. **Listing copy** (drafted for Brendan's review): name "DealEcho — Sales Intelligence", short description (132-char limit), long description, category Productivity/Sales.
3. **Screenshots**: 1280×800 set generated from the refreshed panel with staged data (matched Pro view, persona + flags visible; no-match view; login view). Taken after Part 1 ships.
4. **Builds**: `npm --prefix extension run build` → zip `extension/dist` for Chrome Web Store; same zip works for Edge Add-ons.
5. **Publish (Brendan's actions, checklist provided)**: Chrome Web Store developer account (US$5 one-time), upload zip, complete data-use disclosure form (matches §1 privacy content), submit for review; optionally repeat on Edge Partner Center (free). Review latency: typically 1–3 days.
6. **Post-approval**: replace `CHROME_EXTENSION_URL` placeholder in `src/constants/dealData.ts` with the real listing URL — this activates the Pricing page's "Add to Chrome" post-checkout prompt.

## Out of scope

- Firefox port, content-script overlays, CRM deep integrations.
- Any change to lookup resolution, persona generation, or Pro gating logic.
- Paid store promo assets (marquee tiles) — can follow later.

## Sequencing

Part 1 → Brendan load-unpacked review → screenshots + listing prep → Brendan submits → URL swap on approval.
