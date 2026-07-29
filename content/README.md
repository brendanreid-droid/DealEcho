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
| `ogImage` | no | Social card for LinkedIn/Twitter unfurls. Site-relative (`/blog/cards/x.png`, file lives in `public/`) or a full URL. Defaults to the site-wide `og-image.png`. 1200x630 works best. |
| `schema` | no | Defaults to `BlogPosting`. |

Values are a flat YAML subset: one `key: value` per line, quotes optional. No
nesting or lists — see `src/blog/frontmatter.mjs`.

### Publishing a post

**From the Admin panel (usual way).** Admin > Blog. Paste the approved copy in,
fill the fields, hit Publish. That calls `adminPublishBlogPost`, which commits
this file to `main` for you; Vercel deploys and the post is live in about two
minutes. Existing posts can be loaded back into the form and updated.

Requires `BLOG_CONTENT_TOKEN` set as a GitHub Actions secret (a fine-grained
PAT scoped to this repo with `Contents: read and write`). Without it, publishing
returns a clear "not configured" error and nothing else breaks.

**By hand.** Drop the file at `content/blog/[slug].md`, set `publishDate`,
commit and push. Same result; the Admin panel is just a form over this.

A malformed post fails `npm run build` rather than shipping broken. The Admin
form validates the same rules up front so you find out at the form, not at the
deploy.

### Sharing to LinkedIn

Each post page has a "Share on LinkedIn" button. It opens LinkedIn's share
sheet with the post URL UTM-tagged as campaign `blog-share`, so reader shares
stay separable from the marketing team's own campaign posts (which use
`<pillar>-week<NN>` — see `docs/UTM_SCHEME.md`).

The card LinkedIn shows comes from the bot snapshot in `dist/seo/`, not the
SPA: `LinkedInBot` is rewritten there by `vercel.json`. Set `ogImage` to give a
post its own card image.

LinkedIn caches unfurls aggressively. After publishing, run the URL through
LinkedIn's Post Inspector once, or the first share's card is the one that
sticks.

### Scheduling caveat

Future-dated posts are excluded from the index, the sitemap, and the bot
snapshots at **build time**. A post dated ahead of the deploy therefore stays
invisible until the next deploy on or after that date — merging early does not
self-publish on the date.
