// scripts/prerender-seo.mjs
//
// Bot-aware prerendering: generates static, fully-formed HTML snapshots for a
// fixed set of marketing routes so that crawlers/bots that don't execute
// JavaScript (curl, most non-Google AI crawlers, link-unfurlers, and some
// classic SEO tools) see real per-page <title>/<meta>/JSON-LD instead of the
// one generic shell every route currently serves.
//
// This does NOT change what real users see. Human traffic still gets the
// normal Vite/React SPA via index.html. Only requests carrying a known bot
// user-agent are routed (via vercel.json rewrites) to the static snapshots
// this script produces at build time.
//
// Why this approach instead of a headless-browser prerender: every route
// covered here (Home, Pricing, Terms, Privacy) already has fixed,
// build-time-known title/description strings (see each page's `useSEO({...})`
// call, or the fallback below for pages that don't call useSEO yet). No data
// fetching or auth state is involved, so we can generate correct HTML by
// string-templating dist/index.html rather than spinning up a browser.
//
// Scope: static marketing routes plus the file-based blog (/blog and every
// content/blog/*.md post). Dynamic/data-backed routes (/search, /company/:id,
// /trends, authenticated app views) are NOT prerendered here — see research/seo
// audit for the longer-term programmatic-SEO recommendation for /company/:id
// pages.
//
// Blog snapshots differ from the marketing ones in that they also carry the
// post body as real HTML inside #root. Meta tags alone would give crawlers a
// page with no indexable content, which is the entire reason the blog exists.
// Humans never see these files (only bot user-agents are rewritten to them),
// and React overwrites #root on mount if one ever does.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { marked } from "marked";
import { loadPublishedPosts } from "../src/blog/loadPosts.mjs";
import { blogPostingSchema, blogIndexSchema, postUrl } from "../src/blog/seo.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST_DIR = resolve(__dirname, "..", "dist");
const SITE_URL = "https://dealecho.io";

const ORG_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "dealecho",
  url: SITE_URL,
  logo: `${SITE_URL}/logo.png`,
};

// One entry per prerendered route. `title`/`description`/`keywords` mirror
// the values each page already passes to `useSEO()` at runtime (kept in sync
// by hand — if you change a page's useSEO() call, update its entry here too).
const ROUTES = [
  {
    path: "/",
    outFile: "seo/home.html",
    title: "dealecho - Sales Intelligence",
    description:
      "Know the buyer before the first call. Verified B2B buyer intelligence, red-flag analysis, and deal mechanics for elite tech accounts.",
    keywords:
      "B2B sales intelligence, deal mechanics, procurement intelligence, buying teams, account planning, Dealecho",
    schema: [
      ORG_SCHEMA,
      {
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: "dealecho",
        url: SITE_URL,
      },
    ],
  },
  {
    path: "/pricing",
    outFile: "seo/pricing.html",
    title: "Dealecho Pricing - Unlock Deal Mechanics and Buyer Intelligence",
    description:
      "Scale your closing rate. Start a 30-day free trial of Sales Pro to access unlimited account tracking, deal mechanics on every account, and flags to qualify built from verified seller reports.",
    keywords:
      "Sales Pro pricing, sales intelligence subscription, deal mechanics, procurement intelligence, B2B deal close rate, Dealecho",
    schema: [ORG_SCHEMA],
  },
  {
    path: "/terms",
    outFile: "seo/terms.html",
    title: "Terms of Use - dealecho",
    description:
      "Terms of Use for dealecho, the peer-sourced B2B sales intelligence platform.",
    keywords: "dealecho terms of use, dealecho terms and conditions",
    schema: [ORG_SCHEMA],
  },
  {
    path: "/privacy",
    outFile: "seo/privacy.html",
    title: "Privacy Policy - dealecho",
    description:
      "Privacy Policy for dealecho, the peer-sourced B2B sales intelligence platform.",
    keywords: "dealecho privacy policy",
    schema: [ORG_SCHEMA],
  },
];

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function setOrInsertMeta(html, matchAttr, matchVal, content) {
  const re = new RegExp(
    `<meta\\s+${matchAttr}=["']${matchVal}["'][^>]*>`,
    "i",
  );
  const tag = `<meta ${matchAttr}="${matchVal}" content="${escapeHtml(content)}" />`;
  if (re.test(html)) {
    return html.replace(re, tag);
  }
  return html.replace("</head>", `  ${tag}\n</head>`);
}

function buildSnapshot(baseHtml, route) {
  let html = baseHtml;

  html = html.replace(
    /<title>.*?<\/title>/i,
    `<title>${escapeHtml(route.title)}</title>`,
  );
  html = setOrInsertMeta(html, "name", "description", route.description);
  if (route.keywords) {
    html = setOrInsertMeta(html, "name", "keywords", route.keywords);
  }
  html = setOrInsertMeta(html, "property", "og:title", route.title);
  html = setOrInsertMeta(html, "property", "og:description", route.description);
  html = setOrInsertMeta(html, "property", "og:url", `${SITE_URL}${route.path}`);
  html = setOrInsertMeta(html, "name", "twitter:title", route.title);
  html = setOrInsertMeta(html, "name", "twitter:description", route.description);

  // Canonical tag (site currently has none at all — see SEO audit finding).
  const canonicalTag = `<link rel="canonical" href="${SITE_URL}${route.path}" />`;
  html = /rel=["']canonical["']/i.test(html)
    ? html.replace(/<link\s+rel=["']canonical["'][^>]*>/i, canonicalTag)
    : html.replace("</head>", `  ${canonicalTag}\n</head>`);

  // JSON-LD schema blocks.
  const schemaScripts = (route.schema ?? [])
    .map(
      (obj) =>
        `<script type="application/ld+json">${JSON.stringify(obj)}</script>`,
    )
    .join("\n  ");
  html = html.replace("</head>", `  ${schemaScripts}\n</head>`);

  // Blog routes carry real body content so crawlers have something to index.
  if (route.bodyHtml) {
    html = html.replace(
      /<div id="root"><\/div>/,
      `<div id="root">${route.bodyHtml}</div>`,
    );
  }

  return html;
}

/** Snapshot routes for /blog and every published post. */
function blogRoutes(posts) {
  const indexBody = [
    "<main>",
    "<h1>Dealecho Blog</h1>",
    "<ul>",
    ...posts.map(
      (post) =>
        `<li><a href="/blog/${post.slug}">${escapeHtml(post.title)}</a>` +
        `<p>${escapeHtml(post.metaDescription)}</p>` +
        `<time datetime="${post.publishDate}">${post.publishDate}</time></li>`,
    ),
    "</ul>",
    "</main>",
  ].join("");

  const routes = [
    {
      path: "/blog",
      outFile: "seo/blog.html",
      title: "Blog - Dealecho",
      description:
        "Field notes on buying teams, procurement, and what actually happens inside B2B deals.",
      keywords:
        "B2B sales blog, buying teams, procurement intelligence, Dealecho",
      schema: [ORG_SCHEMA, blogIndexSchema(posts)],
      bodyHtml: indexBody,
    },
  ];

  for (const post of posts) {
    routes.push({
      path: `/blog/${post.slug}`,
      outFile: `seo/blog-${post.slug}.html`,
      title: `${post.title} - Dealecho`,
      description: post.metaDescription,
      keywords: post.keywords,
      schema: [blogPostingSchema(post)],
      bodyHtml:
        `<main><article>` +
        `<h1>${escapeHtml(post.title)}</h1>` +
        `<time datetime="${post.publishDate}">${post.publishDate}</time>` +
        marked.parse(post.body, { async: false }) +
        `</article></main>`,
    });
  }

  return routes;
}

function main() {
  let baseHtml;
  try {
    baseHtml = readFileSync(resolve(DIST_DIR, "index.html"), "utf-8");
  } catch (err) {
    console.error(
      "[prerender-seo] dist/index.html not found — run `vite build` first.",
    );
    throw err;
  }

  const posts = loadPublishedPosts();
  const routes = [...ROUTES, ...blogRoutes(posts)];

  for (const route of routes) {
    const outPath = resolve(DIST_DIR, route.outFile);
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, buildSnapshot(baseHtml, route), "utf-8");
    console.log(`[prerender-seo] wrote ${route.outFile} for ${route.path}`);
  }
}

main();
