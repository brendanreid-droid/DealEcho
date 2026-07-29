# content/

Source content that ships with the app build. Nothing here is fetched at
runtime — files are bundled by Vite and prerendered into `dist/seo/` at build
time, so publishing is a PR merge and a Vercel deploy.

## content/blog/

One markdown file per published blog post, named `[slug].md`. Approval happens
before a file gets here (in the separate marketing repo) — this directory holds
approved, ready-to-publish posts only. There is no draft state, no admin UI,
and no database.

### Frontmatter contract

```markdown
---
slug: g2-for-vendors-no-glassdoor-for-buying-teams
title: "There's a G2 for Vendors. Why Isn't There One for Buyers?"
metaDescription: "Every vendor gets reviewed. Buying teams never do. Here's why that one-way accountability gap costs sales executives more than bad deals."
publishDate: 2026-08-04
pillar: 3
keywords: "buying team accountability, review buying teams"
schema: BlogPosting
---

Body markdown here. Headings, paragraphs, lists, tables, bold/italic, links.
No custom components.

## Sources

- SBI Growth, "Next Era of Commercial Differentiation," 2024
```

| Field | Required | Notes |
| --- | --- | --- |
| `slug` | yes | Must match the filename. Becomes `/blog/[slug]`. |
| `title` | yes | `<title>` and the page H1. |
| `metaDescription` | yes | Meta description + OG/Twitter description. Keep to 155 chars. |
| `publishDate` | yes | `YYYY-MM-DD`. Future dates are treated as unpublished. |
| `pillar` | no | Internal content-pillar number, not rendered. |
| `keywords` | no | `<meta name="keywords">`. |
| `schema` | no | Defaults to `BlogPosting`. |

Values are a flat YAML subset: one `key: value` per line, quotes optional. No
nesting or lists — see `src/blog/frontmatter.mjs`.

### Publishing a post

1. Copy the approved file to `content/blog/[slug].md`.
2. Set `publishDate`.
3. Open a PR, merge to `main`. Vercel deploys and `/blog/[slug]` goes live.

A malformed post fails `npm run build` rather than shipping broken.

### Scheduling caveat

Future-dated posts are excluded from the index, the sitemap, and the bot
snapshots at **build time**. A post dated ahead of the deploy therefore stays
invisible until the next deploy on or after that date — merging early does not
self-publish on the date.
