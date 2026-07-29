# Blog Section — File-Based Content Pipeline

**Date:** 2026-07-29
**Status:** Ready to build
**Scope:** New `/blog` and `/blog/:slug` routes, reading markdown files with frontmatter checked into this repo. No CMS, no new database, no new auth surface.

---

## Overview

DealEcho's marketing team (a separate Hermes agent workflow, not part of this app) produces blog post drafts as markdown files with YAML frontmatter. Founder review/approval already happens outside this repo. This spec covers **only** the app-side piece: rendering approved posts at `/blog` and `/blog/:slug`, with real per-page SEO (title, meta, schema) — the whole reason this blog exists is to fix DealEcho's current lack of indexable content (see `research/seo/2026-07-28-dealecho-io-seo-audit.md` in the marketing repo).

**Why file-based, not Firestore/CMS:** Posts are approved by a human (the founder) reading a markdown file and deciding it's ready. The simplest, lowest-risk way to "publish" is: move the file into this repo, merge to `main`, Vercel deploys. No new backend, no new Firestore rules, no new auth flow, no webhook. Publishing a post becomes exactly like every other change to this app: a PR merge.

**Content lifecycle stays in the separate marketing repo up until approval.** Only *approved, ready-to-publish* posts land in this repo, at `content/blog/*.md`. Do not build any draft/review/approval UI in this app.

---

## The Content Contract (frontmatter schema)

Every post file at `content/blog/[slug].md` must follow this exact shape. This is the interface the marketing pipeline already produces (adjust key names here if you want something different, but this is the format to build against):

```markdown
---
slug: g2-for-vendors-no-glassdoor-for-buying-teams
title: "There's a G2 for Vendors. Why Isn't There One for Buyers?"
metaDescription: "Every vendor gets reviewed. Buying teams never do. Here's why that one-way accountability gap is costing sales executives more than bad deals."
publishDate: 2026-08-04
pillar: 3
keywords: "buying team accountability, review buying teams"
schema: BlogPosting
---

Full markdown body of the post goes here. Standard markdown: headings,
paragraphs, lists, tables, bold/italic. No custom components.

## Sources

- Any cited stat's source goes here, e.g. "SBI Growth, 'Next Era of
  Commercial Differentiation,' 2024"
```

**Field notes:**
- `slug` — must match the filename (`[slug].md`) and becomes the URL: `/blog/[slug]`
- `title` — used as `<title>` and the page H1
- `metaDescription` — used as `<meta name="description">` and OG/Twitter description, keep ≤155 chars
- `publishDate` — ISO date (`YYYY-MM-DD`). Posts with a future `publishDate` should not appear on `/blog` or be directly reachable yet (see Scheduling below) — but this is optional for v1, see Build Steps
- `pillar` — internal reference (1, 2, or 3), not required to be rendered anywhere on the page, just useful metadata to keep in the frontmatter for later filtering/analytics
- `keywords` — optional, maps to `<meta name="keywords">`
- `schema` — always `BlogPosting` for now; keeping the field for future post types (e.g. `FAQPage`)
- A "Sources" section at the end of the body is a DealEcho content-policy requirement (no invented stats) — always present when the post cites any claim

---

## Routes to Build

### `/blog` — index page
- Lists all posts from `content/blog/*.md`, sorted by `publishDate` descending
- Each list item: title, meta description (or a truncated excerpt), publish date
- Links to `/blog/[slug]`

### `/blog/:slug` — post page
- Renders the markdown body for the post matching `slug`
- Sets page title = `title`, meta description = `metaDescription`, per-page canonical URL (`https://dealecho.io/blog/[slug]`)
- Injects `BlogPosting` JSON-LD schema (see Schema section below)
- 404s (real HTTP 404, not the existing soft-404 behaviour — see Known Issue below) if no matching file exists

---

## SEO Requirements (the actual point of this feature)

This app is a client-rendered SPA (Vite + React Router, no SSR). The existing `useSEO()` hook (`src/hooks/useSEO.ts`) sets `document.title`/meta tags client-side via `useEffect` — fine for browsers, invisible to crawlers/bots that don't execute JS. **The blog is the main reason this needs to be fixed properly, not worked around a second time.**

There are two existing mechanisms in this repo already handling this problem for other routes — extend the same pattern rather than inventing a third approach:

1. **`scripts/prerender-seo.mjs`** — runs after `vite build`, generates static HTML snapshots per route into `dist/seo/*.html` with real per-page title/meta/canonical/JSON-LD, by string-templating `dist/index.html`. Currently only covers `/`, `/pricing`, `/terms`, `/privacy` (fixed, hardcoded routes). **Extend this script to also loop over every file in `content/blog/` and generate a snapshot per post** (e.g. `dist/seo/blog-[slug].html`), plus one for the `/blog` index itself.
2. **`middleware.ts`** — Vercel Edge Middleware using `@vercel/edge`, currently only matches `/` (because `/` maps to a real `dist/index.html` file on disk, so Vercel's static-file resolution beats a plain `vercel.json` rewrite — this was a hard-won fix, see git history on `main`, PR #4). **Extend the middleware's matcher to also cover `/blog` and `/blog/:slug`-shaped paths**, rewriting bot user-agent requests to the matching static snapshot. `/pricing`, `/terms`, `/privacy` already work correctly via plain `vercel.json` rewrites (no physical file collision for those routes) — check whether `/blog/:slug` has the same physical-file collision as `/` or not before deciding if it needs the middleware path or the simpler `vercel.json` rewrite path. (It will NOT have a physical file per slug, since these are dynamically read at runtime — so it should be safe to handle via `vercel.json` rewrites like `/pricing`, not middleware. Confirm this before building, don't assume.)

**Bot user-agent list already established** (keep consistent): `Googlebot`, `Google-Extended`, `Bingbot`, `GPTBot`, `ChatGPT-User`, `PerplexityBot`, `ClaudeBot`, `anthropic-ai`, `LinkedInBot`, `Slackbot`, `Twitterbot`, `facebookexternalhit`, `Applebot`.

### Schema (JSON-LD)
Each post page needs a `BlogPosting` schema block:
```json
{
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  "headline": "[title]",
  "description": "[metaDescription]",
  "datePublished": "[publishDate]",
  "author": { "@type": "Organization", "name": "dealecho" },
  "publisher": { "@type": "Organization", "name": "dealecho", "logo": "https://dealecho.io/logo.png" },
  "mainEntityOfPage": "https://dealecho.io/blog/[slug]"
}
```

### Sitemap
`public/sitemap.xml` currently lists 5 static URLs only. Add every published blog post's URL, and regenerate this at build time (script, not hand-maintained) so it never drifts out of sync as posts are added.

### robots.txt / soft-404 note (pre-existing issue, not blog-specific — do not silently fix as a side effect)
The current `vercel.json` catch-all (`"/(.*)" → "/index.html"`) means **any** unknown path returns HTTP 200, not 404 — this predates the blog and affects the whole site. If you want a real 404 for `/blog/nonexistent-slug`, you'll need to solve this at the same time (e.g. an Edge Middleware check against the known slug list, returning a real 404 status). This is a separate, slightly bigger change — flag it as a decision point rather than silently building `/blog/:slug` with the same soft-404 behaviour as everything else. Worth doing properly since a broken/mistyped blog link returning 200 defeats a chunk of the SEO benefit of building this at all.

---

## Non-Goals (explicitly out of scope for this build)

- No CMS, no admin UI for writing/editing posts in-app
- No Firestore collection for posts
- No draft/review/approval workflow in this app (that already happens in the separate marketing repo before a file ever reaches here)
- No comments, no author profile pages, no tags/category pages (v1 is just index + post page)
- No RSS feed (nice-to-have later, not required for launch)

---

## Build Steps (suggested order)

1. Add markdown-rendering dependency (e.g. `react-markdown` + `gray-matter` for frontmatter parsing, or `remark`/`mdx` if preferred — pick whatever's lightest, this repo has no existing markdown tooling)
2. Build `/blog` index route + `/blog/:slug` route, reading from `content/blog/*.md` (bundled at build time via Vite's `import.meta.glob`, not fetched at runtime)
3. Extend `scripts/prerender-seo.mjs` to generate one static snapshot per post + the index
4. Extend `vercel.json` (or `middleware.ts`, per the physical-file-collision check above) to route bot user-agents on `/blog` and `/blog/:slug` to their static snapshots
5. Add a build-time sitemap generator that includes all blog post URLs
6. Decide + implement the real-404 approach for unmatched slugs (see note above) — at minimum, don't make it worse than the current site-wide behaviour
7. Verify: `npm run build`, then `curl -A GPTBot` vs a normal user-agent against `/blog` and one real slug, confirm they differ (same verification pattern used for PR #3/#4 — diff bot vs. normal response, check `<title>`/meta/JSON-LD are present for the bot response)

---

## How Posts Actually Get Published (once this is built)

1. Marketing pipeline drafts a post, runs it through brand review, gets founder approval — all in the separate marketing repo (`content/blog/approved/[slug].md` there)
2. Founder (or whoever's approving) copies/moves the approved file into **this** repo at `content/blog/[slug].md`, sets `publishDate`
3. Open a PR, merge to `main`
4. Vercel deploys, `/blog/[slug]` goes live automatically

No new tooling needed for step 2 beyond a file copy — this can be done manually or scripted later once the pattern is proven.
