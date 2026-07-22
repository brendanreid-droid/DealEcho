# Extension Panel Refresh + Store Publish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the extension side panel to the approved "dense intel brief" design with a company-logo header and schema-v2 review data, then prepare Chrome Web Store publication (privacy disclosures, listing copy, build zips, publish checklist).

**Architecture:** Backend adds one response field (`matchedDomain`) to `lookupCompanyReviews` — computed by a new pure `logoDomain()` helper in `domains.ts` so it's unit-testable. Frontend work is confined to `extension/src/sidepanel/` (new `CompanyLogo` component, restyled `ReviewsView`, extended `statusColor`) plus type additions in `extension/src/lib/api.ts`. Store prep touches `pages/Privacy.tsx` (site) and adds docs.

**Tech Stack:** Extension: React 19 + TS + Vite + crxjs, vitest (`npm --prefix extension test`). Functions: Node 22, vitest (`npm --prefix functions test`). NEITHER is an npm workspace — always use `--prefix`, never `-w`.

**Spec:** docs/superpowers/specs/2026-07-22-extension-panel-refresh-publish-design.md (approved).

**Key existing files:**
- [extension/src/sidepanel/ReviewsView.tsx](../extension/src/sidepanel/ReviewsView.tsx), [theme.tsx](../extension/src/sidepanel/theme.tsx), [App.tsx](../extension/src/sidepanel/App.tsx), [flags.ts](../extension/src/sidepanel/flags.ts)
- [extension/src/lib/api.ts](../extension/src/lib/api.ts)
- [functions/src/extension/lookupCompanyReviews.ts](../functions/src/extension/lookupCompanyReviews.ts), [domains.ts](../functions/src/extension/domains.ts)

**Locked decisions:** direction C ("dense intel brief") with logo header, per approved mockup. `matchedDomain` null on name-path or CRM-host matches. Favicon via `https://www.google.com/s2/favicons?domain=<d>&sz=64` (same service as the web app). statusColor: Won→healthy, Lost/No Decision→risk, Withdrew→caution, Ongoing→accent, unknown→sub. No em dashes in any UI copy (project rule).

---

### Task 1: Backend — `logoDomain` helper + `matchedDomain` in lookup response

**Files:**
- Modify: `functions/src/extension/domains.ts`
- Modify: `functions/src/extension/domains.test.ts`
- Modify: `functions/src/extension/lookupCompanyReviews.ts`

- [ ] **Step 1: Read `domains.ts` and `domains.test.ts`** to learn `registrableDomain`/`isCrmHost` signatures and the test file's conventions.

- [ ] **Step 2: Write failing tests** — append to `functions/src/extension/domains.test.ts` (adapt describe/import style to the file's existing conventions):

```ts
describe("logoDomain", () => {
  it("returns the registrable domain for a plain prospect host", () => {
    expect(logoDomain("app.datadoghq.com", undefined)).toBe("datadoghq.com");
  });
  it("is null when an explicit name drove the lookup", () => {
    expect(logoDomain("datadoghq.com", "Datadog")).toBeNull();
  });
  it("is null for CRM hosts", () => {
    expect(logoDomain("na1.salesforce.com", undefined)).toBeNull();
  });
  it("is null when no domain given", () => {
    expect(logoDomain(undefined, undefined)).toBeNull();
  });
});
```

(If `registrableDomain("app.datadoghq.com")` returns something other than `"datadoghq.com"` per its existing tests, match the helper's actual behavior — the point is delegation, not re-implementation.)

- [ ] **Step 3: Run** `npm --prefix functions test` — new tests FAIL (logoDomain undefined).

- [ ] **Step 4: Implement** — append to `functions/src/extension/domains.ts`:

```ts
/**
 * Domain that is SAFE to show a favicon for in the panel header.
 * Only the domain-resolution path qualifies: an explicit name means the page
 * the name was found on (a CRM, news site, dealecho itself) is usually NOT the
 * company's own site, and CRM hosts are never the prospect. Null = the client
 * shows an initials avatar instead.
 */
export function logoDomain(
  domain: string | undefined,
  name: string | undefined,
): string | null {
  if (name && name.trim()) return null;
  if (!domain || isCrmHost(domain)) return null;
  return registrableDomain(domain) || null;
}
```

- [ ] **Step 5: Wire into the response** — in `lookupCompanyReviews.ts`: add `logoDomain` to the existing `./domains` import (create the import if none exists). In the final `return { matched: true, ... }` object, add:

```ts
matchedDomain: logoDomain(domain, name),
```

Do NOT add it to the `{ matched: false }` early return. No other changes.

- [ ] **Step 6: Run** `npm --prefix functions test` (all green, including the 4 new) and `npm --prefix functions run build` (clean).

- [ ] **Step 7: Commit**

```bash
git add functions/src/extension/domains.ts functions/src/extension/domains.test.ts functions/src/extension/lookupCompanyReviews.ts
git commit -m "feat(extension-api): matchedDomain in lookup response for logo-safe favicon"
```
End commit body with: Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>

---

### Task 2: Extension types + statusColor

**Files:**
- Modify: `extension/src/lib/api.ts`
- Modify: `extension/src/sidepanel/theme.tsx`
- Create: `extension/src/sidepanel/theme.test.ts`

- [ ] **Step 1: Write failing test** — create `extension/src/sidepanel/theme.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { statusColor, theme } from "./theme";

describe("statusColor", () => {
  it("maps all five review outcomes plus unknown", () => {
    expect(statusColor("Won")).toBe(theme.healthy);
    expect(statusColor("Lost")).toBe(theme.risk);
    expect(statusColor("No Decision")).toBe(theme.risk);
    expect(statusColor("Withdrew")).toBe(theme.caution);
    expect(statusColor("Ongoing")).toBe(theme.accent);
    expect(statusColor("garbage")).toBe(theme.sub);
  });
});
```

- [ ] **Step 2: Run** `npm --prefix extension test` — new test FAILS (No Decision currently → sub).

- [ ] **Step 3: Implement** — in `theme.tsx` replace `statusColor` with:

```ts
/** Review outcome colour. Mirrors the web app's ReviewCard badge mapping. */
export function statusColor(status: string): string {
  if (status === "Won") return theme.healthy;
  if (status === "Lost" || status === "No Decision") return theme.risk;
  if (status === "Withdrew") return theme.caution;
  if (status === "Ongoing") return theme.accent;
  return theme.sub;
}
```

- [ ] **Step 4: Extend types** — in `extension/src/lib/api.ts`, add to `LookupReview` (after `clarityOfScope`):

```ts
  // Schema v2 (optional — absent on legacy reviews)
  schemaVersion?: number;
  dealType?: string;
  dealRegion?: string;
  dealPeriod?: string;
  tcvBracket?: string;
```

And to `LookupResult` (after `recentReviews`):

```ts
  /** Domain safe to derive a favicon from; null/absent = show initials avatar. */
  matchedDomain?: string | null;
```

- [ ] **Step 5: Run** `npm --prefix extension test` (green) and `npm --prefix extension run build` (clean).

- [ ] **Step 6: Commit**

```bash
git add extension/src/lib/api.ts extension/src/sidepanel/theme.tsx extension/src/sidepanel/theme.test.ts
git commit -m "feat(extension): v2 review fields in types, five-outcome status colors"
```
End commit body with: Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>

---

### Task 3: CompanyLogo component

**Files:**
- Create: `extension/src/sidepanel/CompanyLogo.tsx`
- Create: `extension/src/sidepanel/CompanyLogo.test.tsx`

- [ ] **Step 1: Read an existing component test** (`ReviewsView.test.tsx` or `LoginForm.test.tsx`) and mirror its render/query conventions exactly.

- [ ] **Step 2: Write failing tests** — `CompanyLogo.test.tsx` (adapt imports to the existing convention):

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CompanyLogo, initials } from "./CompanyLogo";

describe("initials", () => {
  it("takes first letters of up to two words", () => {
    expect(initials("Datadog Inc")).toBe("DI");
    expect(initials("miro")).toBe("M");
    expect(initials("  Crown   Resorts  Limited ")).toBe("CR");
  });
});

describe("CompanyLogo", () => {
  it("renders the favicon when a domain is given", () => {
    render(<CompanyLogo name="Datadog Inc" domain="datadoghq.com" />);
    const img = screen.getByRole("presentation");
    expect(img).toHaveAttribute(
      "src",
      "https://www.google.com/s2/favicons?domain=datadoghq.com&sz=64",
    );
  });
  it("renders initials when no domain", () => {
    render(<CompanyLogo name="Datadog Inc" domain={null} />);
    expect(screen.getByText("DI")).toBeTruthy();
  });
});
```

(If the test setup lacks `@testing-library/jest-dom`, replace `toHaveAttribute` with `expect(img.getAttribute("src")).toBe(...)`. `getByRole("presentation")` matches an `<img alt="">`; use `container.querySelector("img")` if role lookup misbehaves.)

- [ ] **Step 3: Run** `npm --prefix extension test` — FAIL (module missing).

- [ ] **Step 4: Implement** — `CompanyLogo.tsx`:

```tsx
import { CSSProperties, useState } from "react";
import { theme } from "./theme";

const tile: CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 7,
  background: theme.white,
  border: `1px solid ${theme.border}`,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  overflow: "hidden",
  flexShrink: 0,
};

/** "Datadog Inc" → "DI"; single word → single letter. */
export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * 32px logo tile. Favicon (same Google service the web app uses) when a
 * logo-safe domain is known; initials avatar otherwise or on image error.
 */
export function CompanyLogo({ name, domain }: { name: string; domain?: string | null }) {
  const [failed, setFailed] = useState(false);
  if (domain && !failed) {
    return (
      <div style={tile}>
        <img
          src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`}
          width={22}
          height={22}
          alt=""
          onError={() => setFailed(true)}
        />
      </div>
    );
  }
  return (
    <div style={{ ...tile, background: theme.accent50, border: `1px solid ${theme.accent100}` }}>
      <span style={{ fontSize: 12, fontWeight: 800, color: theme.accent }}>{initials(name)}</span>
    </div>
  );
}
```

- [ ] **Step 5: Run** `npm --prefix extension test` — green.

- [ ] **Step 6: Commit**

```bash
git add extension/src/sidepanel/CompanyLogo.tsx extension/src/sidepanel/CompanyLogo.test.tsx
git commit -m "feat(extension): company logo tile with favicon + initials fallback"
```
End commit body with: Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>

---

### Task 4: ReviewsView restyle (dense brief)

**Files:**
- Modify: `extension/src/sidepanel/ReviewsView.tsx`
- Modify: `extension/src/sidepanel/ReviewsView.test.tsx`

This is a full-body restyle of the matched view. Keep: `Tip`, `formatDate`, `NoMatchView` + its custom-token bridge flow, `buildFlags` usage, Pro gating, all existing tooltips/hints, `companyHint` prop. Replace the matched layout with the structure below. All styling inline on `theme` tokens, as today.

- [ ] **Step 1: Read the current `ReviewsView.tsx` and `ReviewsView.test.tsx` in full.**

- [ ] **Step 2: Update the matched-view JSX.** Precise structure (reuse the existing `eyebrow`/`unit`/`primaryBtn` style constants; add new ones as needed):

**Header** (replaces the bare `<h2>` + stat row):

```tsx
<div
  style={{
    display: "flex",
    alignItems: "center",
    gap: 10,
    borderBottom: `2px solid ${theme.navy}`,
    paddingBottom: 10,
    marginBottom: 10,
  }}
>
  <CompanyLogo name={companyName ?? ""} domain={result.matchedDomain} />
  <div style={{ flex: 1, minWidth: 0 }}>
    <div style={{ fontSize: 14, fontWeight: 800, color: theme.navy, letterSpacing: 0.3, textTransform: "uppercase" }}>
      {companyName}
    </div>
    {summary && (
      <div style={{ fontSize: 9, color: theme.faint, fontWeight: 600 }}>
        {summary.reviewCount} review{summary.reviewCount !== 1 ? "s" : ""} · avg rating {summary.rating.toFixed(1)}/5
      </div>
    )}
  </div>
  {summary && (
    <Tip text={HEALTH_HINT} style={{ textAlign: "right" }}>
      <div style={{ fontSize: 16, fontWeight: 800, color: healthColor(summary.healthIndex) }}>
        {summary.healthIndex}
      </div>
      <div style={{ fontSize: 8, color: theme.faint, fontWeight: 700, textTransform: "uppercase" }}>Health</div>
    </Tip>
  )}
</div>
```

Import `CompanyLogo` at the top: `import { CompanyLogo } from "./CompanyLogo";`

**Metric table** (replaces MetricBar grid — the `MetricBar` component and `RATING_HINT`/`REVIEWS_HINT` constants become unused; DELETE them):

```tsx
{summary?.metrics && (
  <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse", marginBottom: 8 }}>
    <tbody>
      {[[METRICS[0], METRICS[2]], [METRICS[1], METRICS[3]]].map(([left, right]) => (
        <tr key={left.key}>
          {[left, right].map((m) => (
            <Fragment key={m.key}>
              <td style={{ color: theme.sub, padding: "3px 0" }}>
                <Tip text={m.hint} style={{ display: "inline-block" }}>{m.label}</Tip>
              </td>
              <td style={{ textAlign: "right", fontWeight: 700, color: healthColor(summary.metrics![m.key] * 20), paddingLeft: 8 }}>
                {summary.metrics![m.key].toFixed(1)}
              </td>
            </Fragment>
          ))}
        </tr>
      ))}
    </tbody>
  </table>
)}
```

(Add `Fragment` to the react import. Row pairing puts Responsiveness|Intent on row 1, Negotiation|Scope on row 2, matching the approved mockup.)

**Section wrapper** — add a small helper component in the file:

```tsx
function Section({ label, color, children }: { label: string; color: string; children: ReactNode }) {
  return (
    <div style={{ borderTop: `1px solid ${theme.border}`, padding: "8px 0" }}>
      <div style={{ fontSize: 8, fontWeight: 700, color, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3 }}>
        {label}
      </div>
      {children}
    </div>
  );
}
```

**Persona** (replaces the boxed indigo paragraph):

```tsx
{persona?.summary && (
  <Section label="Buyer persona" color={theme.accent}>
    <div style={{ fontSize: 11, lineHeight: 1.5, color: theme.ink }}>{persona.summary}</div>
  </Section>
)}
```

**Red flags** (replaces the boxed cards):

```tsx
{flags.length > 0 && (
  <Section label={`⚑ ${flags.length} red flag${flags.length !== 1 ? "s" : ""}`} color={theme.risk}>
    {flags.map((f) => (
      <div key={f.type} style={{ fontSize: 11, color: theme.ink, marginBottom: 3 }}>
        {FLAG_LABELS[f.type]} · <span style={{ color: theme.sub }}>{f.severity} · {f.reviewIds.length} report{f.reviewIds.length !== 1 ? "s" : ""}</span>
        {f.evidence && (
          <div style={{ fontSize: 10, fontStyle: "italic", color: theme.sub }}>"{f.evidence}"</div>
        )}
      </div>
    ))}
  </Section>
)}
```

**Recent reviews (Pro)** (replaces the boxed review cards). Meta line: v2 fields render only when present; the trailing slot is `dealPeriod` when present, else the formatted `createdAt`:

```tsx
{isPro ? (
  <Section label="Recent reviews" color={theme.faint}>
    {(recentReviews ?? []).map((r) => {
      const metaParts = [r.dealType, r.dealRegion, r.tcvBracket, r.dealPeriod ?? formatDate(r.createdAt)]
        .filter(Boolean)
        .join(" · ");
      return (
        <div key={r.id} style={{ fontSize: 11, lineHeight: 1.55, color: theme.ink, marginBottom: 10 }}>
          <span style={{ fontWeight: 800, color: statusColor(r.status), textTransform: "uppercase" }}>
            {r.status}
          </span>
          {metaParts && <span style={{ color: theme.sub }}> · {metaParts}</span>}
          <div
            style={{
              display: "-webkit-box",
              WebkitLineClamp: 3,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            "{r.content}"
          </div>
          <div style={{ fontSize: 10, color: theme.sub, marginTop: 2, display: "flex", gap: 0 }}>
            {METRICS.map((m, i) => (
              <Tip key={m.key} text={m.hint} style={{ display: "inline-block" }}>
                <span>{i > 0 ? " · " : ""}{m.short} {r[m.key]}</span>
              </Tip>
            ))}
          </div>
        </div>
      );
    })}
  </Section>
) : (
  <div style={{ borderTop: `1px solid ${theme.border}`, paddingTop: 10 }}>
    <a href="https://www.dealecho.io/pricing" target="_blank" rel="noreferrer" style={primaryBtn}>
      Upgrade to see reviews →
    </a>
  </div>
)}
```

**Footer** (restyle only):

```tsx
<div style={{ borderTop: `1px solid ${theme.border}`, marginTop: 4, paddingTop: 8 }}>
  <a
    href={companyId ? `${CARD_URL}/company/${companyId}` : CARD_URL}
    target="_blank"
    rel="noreferrer"
    style={{ color: theme.accent, fontSize: 11, fontWeight: 700, textDecoration: "none" }}
  >
    View full company card →
  </a>
</div>
```

Root container: change to `style={{ fontSize: 13, lineHeight: 1.5, color: theme.ink, background: "#fafbfc", border: \`1px solid ${theme.border}\`, borderRadius: 10, padding: 14 }}` per the approved mockup (panel body sits on white; the brief is a soft card).

- [ ] **Step 3: Update tests.** Fix existing assertions broken by the new DOM, then ADD:

```tsx
it("shows v2 meta inline when fields are present", () => {
  // fixture review with dealType: "New Business", dealRegion: "Australia & NZ", tcvBracket: "$100k - $250k", dealPeriod: "Q3 2026"
  // assert rendered text contains "New Business · Australia & NZ · $100k - $250k · Q3 2026"
});
it("falls back to created date for legacy reviews", () => {
  // fixture without v2 fields — assert the formatted createdAt renders and no "·  ·" artifacts appear
});
it("renders initials tile when matchedDomain is null", () => {
  // result.matchedDomain: null — assert initials text present, no favicon img
});
```

Write these as real tests following the file's existing fixture/render pattern (the pseudo-comments above define the required assertions; the surrounding conventions come from the existing file).

- [ ] **Step 4: Run** `npm --prefix extension test` (all green) and `npm --prefix extension run build` (clean).

- [ ] **Step 5: Commit**

```bash
git add extension/src/sidepanel/ReviewsView.tsx extension/src/sidepanel/ReviewsView.test.tsx
git commit -m "feat(extension): dense intel-brief panel layout with logo header and v2 review meta"
```
End commit body with: Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>

---

### Task 5: App shell state polish

**Files:**
- Modify: `extension/src/sidepanel/App.tsx`

Typography-only pass so loading/error/empty states match the brief's density. Logic untouched.

- [ ] **Step 1: Apply**:
- "Looking at {hostname}" line: fontSize 10, keep colors.
- Loading line: replace with `<p style={{ fontSize: 12, color: theme.sub }}>Looking up {context.selection || context.hostname}…</p>` — unchanged content, size 12.
- Error line: fontSize 12.
- No-context prompt: fontSize 12.
- `body` padding: `"14px 16px"`.

- [ ] **Step 2: Run** `npm --prefix extension test` and `npm --prefix extension run build` — green/clean.

- [ ] **Step 3: Commit**

```bash
git add extension/src/sidepanel/App.tsx
git commit -m "style(extension): align shell states with dense brief typography"
```
End commit body with: Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>

---

### Task 6: Verify + deploy backend + CHECKPOINT

**Files:** none (verification)

- [ ] **Step 1:** Full gates: `npm --prefix extension test && npm --prefix extension run build && npm --prefix functions test && npm --prefix functions run build && npm run type-check && npm test` (site unaffected but cheap to confirm).

- [ ] **Step 2:** Push to main. CI deploys `lookupCompanyReviews` (already in the `--only` allowlist from 2B — verify `functions:lookupCompanyReviews` still appears in `.github/workflows/deploy-functions.yml` before pushing). Watch the run to green. If a 409 deploy conflict appears, wait and re-run the job — do not rapid-fire redeploys.

- [ ] **Step 3: CHECKPOINT — STOP and hand to Brendan.** He reloads the unpacked extension (`chrome://extensions` → Reload after `npm --prefix extension run build`) and checks: Datadog-style domain match shows the favicon header; a name-highlight lookup inside a CRM shows the initials tile; a v2 review shows the meta line; Pro gating unchanged. Do not proceed to Task 7 until he approves the look.

---

### Task 7: Privacy page — extension disclosures

**Files:**
- Modify: `pages/Privacy.tsx`

- [ ] **Step 1: Read `pages/Privacy.tsx`** and mirror its existing section markup/heading structure exactly.

- [ ] **Step 2: Add a "Browser Extension" section** (before any final "contact" section), copy:

> **Browser Extension**
> The DealEcho browser extension activates only when you click its icon or use its context-menu action. When activated it reads the current tab's website address (hostname) and any text you have highlighted, and sends them to DealEcho to look up matching company intelligence. The extension does not read page content, browsing history, or form data, and collects nothing in the background. Sign-in uses the same DealEcho account and authentication providers as the website. Lookup queries may be processed by our AI provider to identify the company. We do not sell extension data or use it for advertising.

(Adjust wrapper tags/classes to the file's conventions. Plain hyphens only, no em dashes.)

- [ ] **Step 3:** `npm run type-check && npm test` — green.

- [ ] **Step 4: Commit**

```bash
git add pages/Privacy.tsx
git commit -m "docs(privacy): browser extension data-use disclosures"
```
End commit body with: Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>

---

### Task 8: Store listing copy + publish checklist + zips

**Files:**
- Create: `docs/extension-store-listing.md`
- Create (generated, gitignored or committed per repo norms — commit it): `extension/release/` zips are NOT committed; add `extension/release/` to `.gitignore`.

- [ ] **Step 1: Create `docs/extension-store-listing.md`** with this full content:

```markdown
# Chrome Web Store Listing — DealEcho

## Name
DealEcho - Sales Intelligence

## Short description (max 132 chars)
See how companies actually buy - reviews, buyer personas and red flags from real sellers, on any prospect site or CRM.

## Long description
DealEcho shows you seller-submitted intelligence about the company you are looking at - before your first call.

Click the DealEcho icon on any prospect website (or highlight a company name inside your CRM) and the side panel shows:

- Buyer health score and rating from verified seller reviews
- Score breakdown: responsiveness, negotiation, buyer intent, scope clarity
- AI buyer persona summarising how this company behaves in deals
- Red flags reported by other sellers (ghosting, brutal procurement, slow legal)
- Recent deal reviews with deal type, region and deal size (Pro)

Stop walking into deals blind. Know the buying process, the friction and the timeline before you spend a quarter discovering it.

Requires a free DealEcho account (dealecho.io). Review details are part of DealEcho Pro.

## Category
Productivity → Workflow & Planning (Chrome); Productivity (Edge)

## Privacy policy URL
https://www.dealecho.io/privacy

## Data-use disclosure form answers
- Collects: authentication information (email for sign-in), website content (hostname + highlighted text, ONLY on user action)
- Purpose: app functionality only
- Data NOT sold; NOT used for unrelated purposes; NOT used for creditworthiness/lending
- No remote code execution

## Screenshots (1280x800, capture after Task 6 checkpoint)
1. Matched Pro view on a prospect site - favicon header, metrics, persona, red flags, reviews
2. No-match view with "Be the first to review" CTA
3. Highlight-a-name-in-CRM flow (initials tile)

## Publish checklist (Brendan)
1. Chrome Web Store: register developer account at https://chrome.google.com/webstore/devconsole (US$5 one-time, needs a Google account + payment card - do this yourself, not via the assistant).
2. `npm --prefix extension run build && cd extension && zip -r release/dealecho-extension.zip dist` (create `release/` first).
3. Dev console → New item → upload the zip.
4. Fill listing: name, descriptions, category, screenshots, privacy policy URL, data-use form (answers above).
5. Submit for review (typically 1-3 days).
6. On approval: copy the listing URL, replace PLACEHOLDER_EXTENSION_ID in `src/constants/dealData.ts` (CHROME_EXTENSION_URL) and push - this activates the Pricing page "Add to Chrome" button.
7. Optional: Edge Add-ons via https://partner.microsoft.com/dashboard/microsoftedge (free) with the same zip + copy.
```

- [ ] **Step 2:** Add `extension/release/` to `.gitignore`. Verify the zip builds: `npm --prefix extension run build && mkdir -p extension/release && (cd extension && zip -r release/dealecho-extension.zip dist)` — confirm the zip contains `manifest.json` at `dist/` root (Chrome requires manifest at zip's top level INSIDE the uploaded folder structure — if `unzip -l` shows `dist/manifest.json`, re-zip from inside `dist`: `(cd extension/dist && zip -r ../release/dealecho-extension.zip .)` and update the checklist doc to match the working command).

- [ ] **Step 3: Commit**

```bash
git add docs/extension-store-listing.md .gitignore
git commit -m "docs(extension): store listing copy and publish checklist"
```
End commit body with: Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>

- [ ] **Step 4:** Push. Report to Brendan: checkpoint items from Task 6 plus the publish checklist. Screenshots are captured by Brendan (or via the loaded extension in a 1280x800 window) after he approves the visuals.

---

## Out of scope
Firefox port, CRM deep integrations, promo marquee assets, changes to resolution/persona/gating logic, publishing actions themselves (account creation and store submission are Brendan's).
