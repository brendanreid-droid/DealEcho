# Home Page & Site Redesign — "Bold & Energetic" (Option A)

**Date:** 2026-06-24
**Status:** Design — pending implementation plan
**Surfaces:** Home (`pages/Home.tsx`), global shell (`src/components/Shell.tsx`), design tokens (`tailwind.config.js`), and consistent application across the company, pricing, and search pages.

---

## 1. Overview

Re-imagine the DealEcho home page as a **cold-traffic marketing landing** built to convert visitors into **Pro subscribers**, and roll the resulting visual language across the whole site so it feels like one cohesive, world-class SaaS product. The aesthetic direction is **"Bold & energetic"**: confident oversized typography, a vivid accent, tasteful motion, and signal-rich proof — exciting and modern, not sleepy.

The user's explicit goal: a **consistent feel throughout the website**. So this is a design-system change first, expressed most fully on the home page, then inherited everywhere.

### Goals
- Convert cold visitors to a **Pro trial** — the single primary CTA across the site.
- Make the value obvious in seconds for busy salespeople (fast-scan hierarchy).
- Keep the **live intelligence feed prominent** as proof the product is alive and valuable.
- Remove the scrolling marquee.
- Standardise on **Inter** for all type.
- Make every page — home, company, pricing, search — share one nav, footer, type scale, color system, and motion language.

### Non-goals
- Backend, data model, auth, or Stripe wiring changes.
- Rebuilding the company page's *content* spine (the Executive Briefing from the prior spec stays); only its hero/header is aligned to the new system.
- New marketing copywriting beyond placeholder-quality hero/benefit lines (final copy is the user's to approve).

---

## 2. Locked decisions

| Decision | Choice |
|---|---|
| Direction | Option A — Bold & energetic |
| Home audience | Cold marketing landing (logged-out); logged-in users get a "Go to app" nav state |
| Primary CTA (site-wide) | **Start 7-day Pro trial** → Pricing/Stripe |
| Live feed | Kept prominent, high on the home page |
| Marquee (`IntelTicker`) | **Removed** |
| Typography | **Inter** for everything (drop Space Grotesk as the display face) |
| Reach | **Site-wide consistency** — shared tokens + shell + per-page alignment |

---

## 3. The "Bold & Energetic" design system

This is the backbone that delivers the consistency. Defined once in `tailwind.config.js` + a small set of shared components, inherited by every page.

### Typography (Inter)
- Replace `font-display` (Space Grotesk) usage with Inter; keep `font-mono` (JetBrains Mono) for scores/data only.
- Weight ramp: 800 for hero headlines, 700 for section headings and primary numbers, 600 for sub-headings/buttons, 500 for emphasis, 400 body.
- Tight tracking on large headings (`letter-spacing: -0.02em` to `-0.03em`); generous line-height (1.5–1.6) on body.
- Type scale (desktop): hero 40–56px / section 24–28px / card title 15px / body 15–16px / label 11px (the existing `2xs` token; nothing smaller).

### Color (energy through contrast, not gradients)
- `navy` (#0e1426) — dark hero band and closing CTA band; the "drama" surfaces.
- `accent` indigo (#4f46e5) — the single vivid action color: primary buttons, "Get Pro", accent keyword in the hero headline.
- `signal` (emerald/amber/rose) — reserved for data only: health scores, red-flag chips, trend.
- Flat fills only (no gradients/glows) for crisp rendering and performance; energy comes from bold type, vivid accent blocks, and motion.

### Motion (tasteful, accessibility-gated)
- Count-up on hero stats (the existing `CountUp` in `Home.tsx` is reused).
- Scroll-reveal fade/slide on sections as they enter the viewport.
- Hover-lift on feed cards and buttons.
- **All motion respects `prefers-reduced-motion`** (jump to final state), matching the existing `CountUp` pattern.

### Shared components (new/standardised)
- `Button` — variants: `primary` (indigo), `dark` (navy), `ghost`/`outline`. One source of truth for CTAs.
- `SectionHeading` — heading + optional LIVE pill.
- `StatStrip` — count-up stat row.
- `CtaBand` — the dark navy closing band with headline + primary button (reused on home, pricing, and other page footers).

---

## 4. Home page information architecture

Top-to-bottom, scannable, every section funnelling to the Pro trial:

1. **Nav** (shared shell) — logo, links, `Sign in`, vivid `Get Pro →`.
2. **Hero (dark navy band):** live-proof eyebrow ("Live · N verified deal reports"), 800-weight headline with an indigo accent keyword ("Know the buyer before the **first call.**"), one-line value subcopy, dual CTA — **Start 7-day Pro trial** (primary indigo) + **Search an account** (secondary). Count-up stat row beneath.
3. **Live intelligence feed:** `Recent intelligence` + LIVE pill, then the existing `CompanyCard` grid (responsive 1/2/3-col) showing buyer-health score + a signal/red-flag chip — a direct taste of paid value. Replaces the old hero ticker as the "alive" proof.
4. **Benefit trio:** three cards — e.g. "See how they buy", "Spot red flags early", "Win faster" — each a one-line outcome for busy sellers.
5. **Closing `CtaBand` (dark):** "Stop walking into deals blind." + Start trial.
6. **Footer** (shared shell).

### F-pattern / scan
Hero headline = scan line 1; CTAs immediately below = the action; feed = the proof scan. A salesperson gets value + CTA without scrolling; proof and benefits reward the scroll.

---

## 5. Shared shell (`src/components/Shell.tsx`)

- **Nav, logged-out:** logo · Product · Pricing · Sign in · **Get Pro →** (vivid). This is the cold-traffic state.
- **Nav, logged-in:** the existing app links (Search, Write review, My intel, Analytics, Pricing) + avatar/sign-out; the marketing CTAs are replaced by the app nav. A single `Navigation` component switches on auth state.
- **Footer:** keep the existing structure/links; restyle to the new type scale and spacing.
- Sticky, 68px, Inter, updated tokens — inherited by every page automatically.

---

## 6. Consistent application to other pages

The shell + tokens propagate the look everywhere for free. Page-specific alignment:

- **Company page (`pages/CompanyProfile.tsx`):** keep the Executive Briefing spine; restyle its header into a bold hero consistent with the home (Inter weights, accent, optional navy header band) so the two pages read as one product.
- **Pricing (`pages/Pricing.tsx`):** align to the system — bold plan headings, indigo primary on the Pro plan, a `CtaBand`. This is where the primary CTA closes, so it gets first-class treatment.
- **Search (`pages/Search.tsx`):** inherit shell + tokens; results use the same `CompanyCard` and headings.
- All pages use the shared `Button`, `SectionHeading`, and `CtaBand` so CTAs and headings are identical everywhere.

---

## 7. Conversion flow

- **Header `Get Pro` + hero CTA + closing band → Pricing → Stripe trial.** Subscribe intent is one click from anywhere on the site.
- **Search box / "Search an account" / feed cards → Search → Company page → deep intel paywall → Pricing.** Product-led path that ends at the same subscribe point.
- **Logged-in users** bypass the marketing CTAs (nav shows the app + "Pro member"/"Upgrade").

---

## 8. Accessibility & performance

- WCAG 2.1 AA: maintain 4.5:1 contrast — verify white/`slate-300` text on the navy hero, and accent-on-white for buttons. Never rely on signal color alone (pair chips with text/icon).
- All motion gated on `prefers-reduced-motion`.
- Keyboard: focus-visible rings on nav, CTAs, search, and cards; logical tab order.
- No sub-11px type. Flat fills (no gradients/blur) keep paint cost low; feed grid lazy-friendly.
- Responsive: hero stacks, stat row wraps, feed collapses 3→2→1 col, nav collapses to the existing mobile menu.

---

## 9. File touchpoints

| File | Change |
|---|---|
| `tailwind.config.js` | Inter as display, weight/scale tokens, confirm color tokens |
| `src/components/IntelTicker.tsx` | **Delete** (and its usage in `Home.tsx`) |
| `pages/Home.tsx` | Rebuild into the section IA above |
| `src/components/Shell.tsx` | Restyle nav (logged-out marketing state + logged-in app state) + footer |
| `src/components/ui/` (new) | `Button`, `SectionHeading`, `StatStrip`, `CtaBand` |
| `src/components/CompanyCard.tsx` | Align to new card style (health + signal chip) |
| `pages/CompanyProfile.tsx` | Bold hero header aligned to the system |
| `pages/Pricing.tsx` | Conversion-focused alignment + `CtaBand` |
| `pages/Search.tsx` | Inherit shell/tokens; consistent headings/cards |

---

## 10. Open items for the plan
- Final hero/benefit/CTA copy (placeholder-quality in the build; user approves real copy).
- Exact trial mechanics (does "Start trial" go to Pricing, or straight to Stripe checkout?).
- Whether the benefit trio uses icons (lucide) or numbers.
- Confirm Inter is loaded (self-host vs Google Fonts) and remove the Space Grotesk font load if unused.
