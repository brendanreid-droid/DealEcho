# Extension parity with the v2 review format

**Date:** 2026-07-29
**Status:** proposed

## Problem

The Chrome extension was approved on the strength of a build cut on 27 Jul. The
company profile it mirrors was rewritten on 26 Jul. Three consequences, all
visible in the panel today:

1. **The panel shows a "Buyer persona" the site no longer has.** `pages/CompanyProfile.tsx`
   dropped it in 484a9ab. `lookupCompanyReviews` still generates one per company
   through `getOrCreatePersona`, at Gemini cost, for a panel section the product
   retired.
2. **The panel cannot produce red flags for v2 reviews.** `extension/src/sidepanel/flags.ts`
   is a copy of the keyword rules stripped out of `services/accountSignal.ts` on
   26 Jul. It matches substrings in review *text*. The site now derives flags
   from v2 *fields* via `getDealMechanics` + `getStructuredFlags`, merged with
   citation-validated AI flags. On Crown Resorts - one review, `schemaVersion: 2`
   - the keyword rules return nothing and the section hides itself, while the
   site shows flags for the same review.
3. **First lookup on a domain says "no reviews", a refresh shows them.** Same
   input, different answer, so the nondeterminism is server-side. With no valid
   `company_domains` entry, `resolveCompany` has exactly one path to an answer:
   `canonicalizeViaAI` (Gemini + googleSearch) followed by `bestNameMatch`. When
   the model returns a name that does not match, the lookup returns
   `matched: false`. Nothing is cached on failure, so the next attempt re-rolls
   the dice - and usually wins. Every domain is exposed to this once, and any
   domain whose cache entry was just evicted is exposed again.

Fixing (3) also removes most Gemini calls from the lookup path.

## Approach

Move the flag engine server-side rather than porting it into the extension a
second time. `lookupCompanyReviews` already fetches the full review set for Pro
users, so the corpus is in hand. One round trip, one copy of the rules, no
corpus shipped to the client, and the panel stops being a place where rules can
silently drift out of date.

Deterministic domain matching lands first: it is independent of the rest, fixes
a bug the user hit today, and needs no store submission.

---

## Task 1: deterministic domain-label matching

**Fixes problem 3. Server-side only - ships without a store submission.**

`bestNameMatch("crownresorts", ...)` fails today because the query is one token
and "Crown Resorts" is two, so token overlap is zero. Compare despaced forms
instead.

- `functions/src/extension/matching.ts` - add `matchByDomainLabel(label, candidates)`:
  normalize both sides, remove spaces, match on equality or either-side prefix.
  Require `label.length >= 5` so short labels cannot land on an unrelated
  company.
- `functions/src/extension/resolver.ts` - in the domain branch, try
  `matchByDomainLabel(registrableDomain minus its TLD)` against the live company
  list *before* `canonicalizeViaAI`. Cache and return on a hit. AI stays as the
  fallback for domains that do not resemble their company name.

Verified by hand against all eight live companies - every one resolves without
Gemini:

| domain label | company | matches on |
|---|---|---|
| crownresorts | Crown Resorts | equality |
| affinityeducation | Affinity Education Group | prefix |
| australiapost | Australia Post | equality |
| busybees | Busy Bees | equality |
| atlantisresorts | Atlantis Resorts | equality |
| genesisenergy | Genesis Energy Limited | equality after suffix strip |
| victra | Victra | equality |
| harrisfarmmarkets | Harris Farm Markets | equality |

**Tests** (`matching.test.ts`, `resolver.test.ts`): concatenated label matches a
multi-word name; prefix match on a longer name; suffix-stripped name matches;
labels under 5 chars are rejected; a domain with no resembling company still
reaches the AI fallback; a deterministic hit never calls `canonicalizeViaAI`.

**Known tradeoff:** `apple.com` against a company named "Apple Bank" would match
on prefix. That is the same fuzziness `bestNameMatch` already carries, and the
AI path would likely reach the same answer. Not worth a stricter rule until it
bites.

## Task 2: port deal mechanics and the structured flag bank into functions/

**Fixes problem 2. Server-side half.**

`services/dealMechanics.ts` (200 lines) and the rule bank in
`services/accountFlags.ts` (~330 lines, `RULES` through `getStructuredFlags`)
are pure functions over `Review[]`. `functions/src/accountFlags.ts` already
mirrors the AI half and the `AccountFlag` type, with the existing note that the
two workspaces cannot import each other.

- `functions/src/dealMechanics.ts` - port `getDealMechanics` and its helpers.
- `functions/src/accountFlags.ts` - add `RULES`, `getStructuredFlags`,
  `mergeFlags`, `groupFlags`, `MAX_RISK_FLAGS`, `MAX_STRENGTH_FLAGS`.
- Port both test files alongside. They are pure-function tests; they should
  transfer with only import paths changed, and they are the evidence the port
  did not drift.

Frontend keeps its copies. This is a second mirror, like the AI half - the
alternative is a shared package, which is a bigger change than this work wants.
Add the same "mirrors services/..." header comment so the next reader knows.

## Task 3: return flags from lookupCompanyReviews, drop the persona

**Fixes problem 1 and the server half of problem 2.**

- `functions/src/extension/lookupCompanyReviews.ts`:
  - Fetch the full review set for the company (currently fetched then sliced to
    3 for Pro; the mechanics need all of them, and free users need the flag
    *count* for the upgrade CTA).
  - `getDealMechanics(reviews)` → `getStructuredFlags(m)`, merged via
    `groupFlags` with the AI flags already produced for the profile.
  - Return `{ risks, strengths }`. For non-Pro, return labels only with `stat`,
    `qualify`, and `reviewIds` stripped - matching how `FlagCard` blurs detail
    on the site, but enforced server-side rather than in the client.
  - Remove the `getOrCreatePersona` call and the `persona` field.
  - Reuse the AI flag cache in `account_flags/{companyId}`; do not add a second
    generation path.
- Delete `functions/src/extension/personaCache.ts` and its test. The `personas/`
  Firestore collection is left in place - orphaned data, no reader, no cost.

**Tests:** flags returned for a Pro caller; detail stripped for a free caller;
zero reviews still short-circuits to `matched: false`; a mechanics failure
degrades to empty flags rather than failing the lookup, matching how the persona
failure was handled.

**Breaking change:** the shipped 0.1.1 extension reads `result.persona`. Removing
it degrades to no persona section - React renders nothing for `undefined`. No
crash, and the section was showing retired content anyway. Confirm before
deploying that `ReviewsView` guards on `persona?.summary` (it does).

## Task 4: render the new flags in the panel

**Extension side. Requires a rebuild and a store submission.**

- Delete `extension/src/sidepanel/flags.ts` and its test.
- `extension/src/lib/api.ts` - drop `persona`, add `risks` / `strengths` typed
  against the server's `AccountFlag` shape.
- `extension/src/sidepanel/ReviewsView.tsx` - replace the persona section and the
  local flag derivation with two `Section`s, "Watch for" and "In your favour",
  matching the site's headings. Per flag: `label`, then `stat` right-aligned.
  Severity colours follow `FlagCard` - polarity wins over severity, so a
  strength is always green. Omit `qualify` points; the panel is 300px and they
  belong on the full card, which the footer already links to.
- Free users: labels only, plus the existing upgrade CTA, worded off the flag
  count the server returns.

## Task 5: pin the extension ID

**Bundle into the same submission.**

`extension/manifest.config.ts` - add `key` from the Web Store dashboard's "View
public key". Unpacked builds then load as `khcgfhbpiinaaanphfoefbamkbcjffpb`,
so a locally loaded build shares the store build's OAuth redirect URI and the
`redirect_uri_mismatch` class of failure cannot recur. Once this lands, the
`gjlehbafpfljddnobnhcelcmbhhjgoeg` redirect URI can be deleted from the OAuth
client.

Also already committed and waiting to ship: `getRedirectURL("oauth2")` in
`extension/src/lib/authClient.ts` (9e5c40a).

---

## Sequencing

Tasks 1-3 deploy through CI and are independent of Google's review queue. Task 1
is worth pushing on its own the moment it is green - it fixes a bug the user is
hitting now. Tasks 4-5 go out together in one submission.

The panel loses the dead persona section as soon as Task 3 deploys, on the
already-installed 0.1.1 build. Flags appear when the new build is approved.

## Verification

- `npm --prefix functions test` and `npm --prefix functions run build` clean.
- `npm --prefix extension test` and `npm --prefix extension run build` clean.
- Against live data, with the panel open: crownresorts.com.au and
  affinityeducation.com.au resolve on first load with no refresh; bestandless.com.au
  and kokodaproperty.com.au show "no reviews yet"; Crown's flags match what
  dealecho.io/company/ai-0-1785112452766 shows.
- Confirm with a free-tier account that `stat` and `reviewIds` are absent from
  the response payload, not merely unrendered.

## Out of scope

- The company logo gap: `sanitize()` strips `domain` on review submit, so
  `matchedDomain` falls back to initials. Pre-existing, unrelated, tracked
  separately.
- `toSummary` in `functions/src/reviewModeration.ts` does not mirror v2 fields
  into `review_summaries`. Does not affect this work - flags read the `reviews`
  collection directly - but it is why free-tier aggregates stay v1-shaped.
- Deduplicating the frontend and functions copies of the flag engine behind a
  shared package.
- CI actions still on deprecated Node 20.
