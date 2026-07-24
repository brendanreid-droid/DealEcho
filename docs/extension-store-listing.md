# Chrome Web Store Listing - Dealecho

## Name
Dealecho - Sales Intelligence

## Short description (max 132 chars)
See how companies actually buy - reviews, buyer personas and red flags from real sellers, on any prospect site or CRM.

## Long description
Dealecho shows you seller-submitted intelligence about the company you are looking at - before your first call.

Click the Dealecho icon on any prospect website (or highlight a company name inside your CRM) and the side panel shows:

- Buyer health score and rating from verified seller reviews
- Score breakdown: responsiveness, negotiation, buyer intent, scope clarity
- AI buyer persona summarising how this company behaves in deals
- Red flags reported by other sellers (ghosting, brutal procurement, slow legal)
- Recent deal reviews with deal type, region and deal size (Pro)

Stop walking into deals blind. Know the buying process, the friction and the timeline before you spend a quarter discovering it.

Requires a free Dealecho account (dealecho.io). Review details are part of Dealecho Pro.

## Category
Productivity → Workflow & Planning (Chrome); Productivity (Edge)

## Privacy policy URL
https://www.dealecho.io/privacy

## Data-use disclosure form answers

Chrome defines "collect" as transmitting data OFF the user's device. Local-only
`chrome.storage` writes do not count.

Tick exactly these three:

- **Personally identifiable information** - email address. Sign-in transmits it to Firebase
  Auth, and the Google SSO scope (`email profile openid`) returns email, name and profile photo.
- **Authentication information** - password entered in the extension login form, transmitted to
  `identitytoolkit.googleapis.com`, plus the Firebase session token.
- **Website content** - the active tab's hostname and any text the user highlights, sent to the
  lookup endpoint to identify the company.

Leave unticked, with reasons (in case a reviewer asks):

- **Health**, **Personal communications** - not touched at all.
- **Financial and payment information** - the extension never contacts Stripe; it only reads an
  `isPro` boolean to gate Pro fields.
- **User activity** - no click, scroll, mouse-position or keystroke tracking anywhere in the source.
- **Web history** - Google defines this as a *list* of visited pages with titles and visit times.
  The extension keeps a single current-tab hostname, overwritten on each change and cleared when the
  browser closes. No page titles, no history list.
- **Location** - no GPS, region or IP-handling code in the extension or its backend endpoints. IP
  reaches Google Cloud infrastructure logs automatically on any network request, which Google's FAQ
  treats as standard infrastructure rather than collection. Ticking this would over-disclose and
  invite questions about location features that do not exist.

Other answers:
- Purpose: app functionality only
- Data NOT sold; NOT used for unrelated purposes; NOT used for creditworthiness/lending
- No remote code execution

## Privacy practices tab - copy/paste answers

### Single purpose description
Dealecho has one purpose: to identify the company associated with the page you are currently viewing and show that company's seller-submitted deal intelligence in a side panel. The extension determines the company either from the active tab's domain or from a company name you highlight, then displays that company's Dealecho buyer health score, score breakdown, AI buyer persona, reported red flags, and recent deal reviews.

### activeTab
Used only in response to the user clicking the Dealecho toolbar icon. That click grants temporary access to the active tab so the extension can read the page's hostname and any text the user has already highlighted - the two things that identify which company to look up. The extension does not read other page content, and the grant expires when the tab navigates or closes.

### scripting
Used together with activeTab to execute one self-contained function (`capturePageContext`) in the active tab after the user clicks the toolbar icon. That function returns only `window.location.hostname` and `window.getSelection()` text. No content script is registered, nothing is injected at page load, and the extension never writes to or modifies the page.

### contextMenus
Registers a single right-click menu item, `Search Dealecho for "<selection>"`, which appears only when the user has text selected. Choosing it opens the side panel and looks up the highlighted company name. This is the main way users look up a prospect from inside a CRM, where the page's own domain belongs to the CRM rather than to the company being researched.

### tabs
Used to keep the side panel in sync with what the user is viewing. The extension listens to `chrome.tabs.onActivated` and `chrome.tabs.onUpdated` to read the hostname of the newly active or newly navigated tab so the panel refreshes automatically rather than requiring a manual click, and uses `chrome.tabs.query` to re-read the active tab when the user presses the panel's Refresh button. Only the URL's hostname is read and used; full URLs, page titles, and browsing history are never collected or transmitted.

### sidePanel
The extension's entire user interface is a side panel. This permission is required to call `chrome.sidePanel.open` when the user clicks the toolbar icon or the right-click menu item. A side panel is used instead of a popup so the company intelligence stays visible while the user continues reading the prospect's website.

### storage
`chrome.storage.session` holds the currently detected hostname and highlighted selection so the background service worker can hand it to the side panel UI; this is cleared when the browser closes. `chrome.storage.local` stores a single boolean UI preference (`dealecho:hideTip`) recording that the user dismissed the onboarding tip. No personal information, review content, or browsing history is stored.

### identity
Used only for the optional "Sign in with Google" flow. `chrome.identity.launchWebAuthFlow` opens Google's own OAuth consent screen and `chrome.identity.getRedirectURL` supplies the extension's redirect URI. The extension requests only the `email`, `profile`, and `openid` scopes and exchanges the returned token for a Firebase Authentication session. The extension never sees, handles, or stores the user's Google password.

### Host permissions
The extension requests three specific hosts and no broad host access (no `<all_urls>`, no wildcard domains):

- `https://identitytoolkit.googleapis.com/*` and `https://securetoken.googleapis.com/*` - Google's own Firebase Authentication endpoints, required to sign the user in and to refresh their session token. Without these the user cannot log in.
- `https://australia-southeast1-dealecho-io-sales-intel-hub.cloudfunctions.net/*` - Dealecho's own backend (Firebase Cloud Functions). The extension calls it to resolve a hostname or a highlighted company name to a company record and to fetch that company's review data. This is the only non-Google host the extension contacts.

### Remote code
Answer: **No, I am not using remote code.**

All JavaScript is bundled into the package. The manifest sets `content_security_policy.extension_pages` to `script-src 'self'`, which forbids loading or evaluating any external script. The bundle contains no `eval()`, no `new Function()`, and no `importScripts()`. Google sign-in is performed via `chrome.identity.launchWebAuthFlow`, which hands off to the browser's own auth window rather than loading remote script into the extension.

### Data usage certification
Tick all three: data is not sold to third parties; data is not used or transferred for purposes unrelated to the item's single purpose; data is not used or transferred to determine creditworthiness or for lending purposes.

## Store listing tab - icon
128x128 PNG: `extension/public/icons/icon-128.png` (already the correct size, upload as-is).

## Screenshots (1280x800, capture after Task 6 checkpoint)
1. Matched Pro view on a prospect site - favicon header, metrics, persona, red flags, reviews
2. No-match view with "Be the first to review" CTA
3. Highlight-a-name-in-CRM flow (initials tile)

## Publish checklist (Brendan)
1. Chrome Web Store: register developer account at https://chrome.google.com/webstore/devconsole (US$5 one-time, needs a Google account + payment card - do this yourself, not via the assistant).
2. `npm --prefix extension run build && mkdir -p extension/release && (cd extension/dist && zip -r ../release/dealecho-extension.zip .)` (zips from inside `dist/` so `manifest.json` lands at the zip's top level - Chrome rejects a zip with `dist/manifest.json` nested).
3. Dev console → New item → upload the zip.
4. Fill listing: name, descriptions, category, screenshots, privacy policy URL, data-use form (answers above).
5. Submit for review (typically 1-3 days).
6. On approval: copy the listing URL, replace PLACEHOLDER_EXTENSION_ID in `src/constants/dealData.ts` (CHROME_EXTENSION_URL) and push - this activates the Pricing page "Add to Chrome" button.
7. Optional: Edge Add-ons via https://partner.microsoft.com/dashboard/microsoftedge (free) with the same zip + copy.
