# Control Centre Redesign — Header & Account Hub

**Date:** 2026-07-01  
**Status:** Design approved  
**Scope:** Header navigation cleanup + account hub refactor

---

## Overview

Simplify DealEcho's primary navigation by removing redundant header links and reorganize the account management page ("My Intel") into a cleaner, tab-based interface called "Control Centre."

**Current state:** Header has Search, Write Review, My Intel, Analytics, Pricing, plus Team/Admin for eligible users. My Intel uses a 3-column layout (left sidebar + right content area) mixing tracked accounts, submissions, reviews, and scattered settings.

**Target state:** Lean header with core actions only. Control Centre uses three focused tabs to separate concerns and surface billing/account management clearly.

---

## Header Navigation Changes

### Scope
Modify `src/components/Shell.tsx` Navigation component.

### Changes

**For authenticated users, remove from nav:**
- "Search" (available at `/` but not in header)
- "Analytics" (available at `/trends` via footer)
- "Pricing" (available at `/pricing` via footer)

**Keep in nav:**
- "Write Review" (`/review/new`)
- "Control Centre" (renamed from "My Intel", route `/my-intel`)
- "Team" (`/settings/team`) — if `isEnterprise`
- "Admin" (`/admin`) — if `isAdmin`

**For unauthenticated users:**
- Keep "Search" and "Pricing" visible

### Rationale
All three removed links exist in the footer's Product and Contribute sections. Removing them from the header reduces cognitive load and keeps the nav focused on primary actions. Users can still reach these pages via footer links or direct navigation.

---

## Control Centre Page Refactor

### Current Structure (MyIntel.tsx)
- 3-column layout: left sidebar (Tracked Accounts + Email Notifications) + right column (My Submissions + Workspace History)
- Scattered UI: subscription status in header, billing controls semi-hidden
- No explicit separation of concerns

### New Structure
**Single tab interface, three tabs:**

#### Tab 1: Tracked Accounts
Content:
- Tracked companies list (cards with logo, name, industry, review count, notification badges)
- Upgrade prompt if at limit (for unpaid users)
- Email notification settings card:
  - Real-time Alerts toggle + description
  - Weekly Digest toggle + description

**Current source:** Lines 214–305 of MyIntel.tsx (Tracked Accounts section + Email Notifications card)

#### Tab 2: My Reviews
Content stacked vertically:
1. **My Submissions** — pending and rejected reviews with edit/resubmit flow
   - Rejected reviews with moderation reason and edit UI
   - Pending reviews with loading state
   - **Source:** `src/components/MySubmissions.tsx` (entire component)

2. **Workspace History** — published reviews by the user
   - Sortable by date (newest first)
   - Cards show company, status, score, deal details, timestamp
   - **Source:** Lines 391–521 of MyIntel.tsx

#### Tab 3: Billing & Account
Content in clear sections:
1. **Profile Section**
   - Avatar, name, email
   - **Source:** Current header section (lines 145–159)

2. **Plan & Subscription**
   - Current plan badge (Sales Pro Member / Pioneer Plan)
   - Upgrade to Sales Pro button (if unpaid)
   - Cancel Subscription button (if paid)
   - Success/error messages for cancel flow
   - **Source:** Lines 160–209 of MyIntel.tsx

3. **Payment Details** (new section)
   - Placeholder for payment method display
   - Placeholder for billing history
   - *Implementation note: coordinate with Stripe API integration if not already built*

4. **Account Security** (new section)
   - Placeholder for password change / account settings
   - *Implementation note: defer to security roadmap*

### Layout & Styling
- Tabs at top with icon + label (bookmark, history, credit-card)
- Active tab underlined in accent color
- Inactive tabs gray, hover state on text
- Tab content full-width, vertically scrollable
- Card-based sections within each tab for visual hierarchy
- Consistent with existing MyIntel design system (card styling, spacing, colors)

---

## Routing & Navigation
- No route change: page stays at `/my-intel`
- Tabs managed via component state (`activeTab`) or URL hash (`#tracked`, `#reviews`, `#billing`)
  - *Recommend state-based for now; can add hash support later for deep linking*
- Notification badge on Control Centre nav link counts pending + rejected submissions (from MySubmissions logic)

---

## Components Affected

1. **Shell.tsx** — Remove 3 nav links from `navLinks` array
2. **MyIntel.tsx** — Refactor to tab-based layout, preserve all existing logic
   - Move header profile section into Billing & Account tab
   - Move Tracked Accounts section into dedicated tab
   - Embed MySubmissions + Workspace History in My Reviews tab
   - Preserve all Firestore subscription/notification logic
3. **MySubmissions.tsx** — No changes (embedded in tab 2)

---

## Accessibility & Mobile
- Tab buttons use semantic `<button>` with proper aria labels
- Focus order flows left to right through tabs, then into tab content
- Mobile: tabs remain horizontal at top (don't stack) for clarity
- Icon + text on each tab for clarity (not icon-only)

---

## Testing Checklist
- [ ] Header displays correct links for authenticated, unauthenticated, enterprise, and admin users
- [ ] All three tabs render without error
- [ ] Tracked Accounts tab shows companies and settings
- [ ] My Reviews tab shows submissions and history stacked correctly
- [ ] Billing & Account tab shows profile, plan, and subscription controls
- [ ] Cancel subscription flow works (modal, confirmation, state update)
- [ ] Notification badge updates on My Reviews tab
- [ ] Tab switching doesn't lose state
- [ ] Mobile layout remains usable (tabs don't wrap)
- [ ] Footer links to removed header pages work as fallback

---

## Out of Scope
- Payment method UI (Stripe integration) — placeholder only
- Password change / advanced account security — defer to next phase
- Analytics dashboard optimization — separate roadmap item
- Deep linking via URL hash — can add post-launch
