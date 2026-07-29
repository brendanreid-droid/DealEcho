// scripts/generate-sitemap.mjs
//
// Writes dist/sitemap.xml at build time. Replaces the hand-maintained
// public/sitemap.xml, which listed 5 static URLs and had no way of knowing
// about blog posts — a sitemap that drifts is worse than no sitemap, since it
// is the one file crawlers trust to be current.
//
// Static routes live in STATIC_URLS below; blog URLs come from the same
// loader the prerenderer uses, so a post is either in both or in neither.

import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadPublishedPosts } from "../src/blog/loadPosts.mjs";
import { SITE_URL, postUrl, blogUrl } from "../src/blog/seo.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST_DIR = resolve(__dirname, "..", "dist");

const STATIC_URLS = [
  { loc: `${SITE_URL}/`, changefreq: "daily", priority: "1.0" },
  { loc: `${SITE_URL}/search`, changefreq: "daily", priority: "0.9" },
  { loc: `${SITE_URL}/pricing`, changefreq: "weekly", priority: "0.8" },
  { loc: blogUrl(), changefreq: "weekly", priority: "0.8" },
  { loc: `${SITE_URL}/terms`, changefreq: "monthly", priority: "0.3" },
  { loc: `${SITE_URL}/privacy`, changefreq: "monthly", priority: "0.3" },
];

function urlEntry({ loc, changefreq, priority, lastmod }) {
  return [
    "  <url>",
    `    <loc>${loc}</loc>`,
    lastmod ? `    <lastmod>${lastmod}</lastmod>` : null,
    `    <changefreq>${changefreq}</changefreq>`,
    `    <priority>${priority}</priority>`,
    "  </url>",
  ]
    .filter(Boolean)
    .join("\n");
}

function main() {
  const posts = loadPublishedPosts();
  const urls = [
    ...STATIC_URLS,
    ...posts.map((post) => ({
      loc: postUrl(post.slug),
      lastmod: post.publishDate,
      changefreq: "monthly",
      priority: "0.7",
    })),
  ];

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map(urlEntry),
    "</urlset>",
    "",
  ].join("\n");

  mkdirSync(DIST_DIR, { recursive: true });
  writeFileSync(resolve(DIST_DIR, "sitemap.xml"), xml, "utf-8");
  console.log(
    `[sitemap] wrote dist/sitemap.xml — ${STATIC_URLS.length} static + ${posts.length} blog URLs`,
  );
}

main();
