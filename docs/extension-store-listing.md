# Chrome Web Store Listing - DealEcho

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
2. `npm --prefix extension run build && mkdir -p extension/release && (cd extension/dist && zip -r ../release/dealecho-extension.zip .)` (zips from inside `dist/` so `manifest.json` lands at the zip's top level - Chrome rejects a zip with `dist/manifest.json` nested).
3. Dev console → New item → upload the zip.
4. Fill listing: name, descriptions, category, screenshots, privacy policy URL, data-use form (answers above).
5. Submit for review (typically 1-3 days).
6. On approval: copy the listing URL, replace PLACEHOLDER_EXTENSION_ID in `src/constants/dealData.ts` (CHROME_EXTENSION_URL) and push - this activates the Pricing page "Add to Chrome" button.
7. Optional: Edge Add-ons via https://partner.microsoft.com/dashboard/microsoftedge (free) with the same zip + copy.
