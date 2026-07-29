// src/blog/frontmatter.mjs
//
// Blog post frontmatter parsing, shared by the app bundle (src/blog/posts.ts)
// and the Node build scripts (scripts/prerender-seo.mjs,
// scripts/generate-sitemap.mjs). Plain ESM JavaScript on purpose: the build
// scripts run under bare `node`, so a .ts module would need a compile step
// just to be shared. Keeping one copy matters more than the file extension —
// if the app and the prerenderer disagreed about what a post is, bots and
// humans would see different pages, which is exactly the bug this whole
// feature exists to avoid.
//
// The frontmatter format is a deliberately small YAML subset: a flat block of
// `key: value` scalars, optionally quoted. No nesting, no lists, no anchors.
// That is the entire content contract (see docs/superpowers/specs/
// 2026-07-29-blog-section-file-based-content-pipeline.md), so a ~40-line
// parser beats pulling in gray-matter/js-yaml and a Buffer polyfill.

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const REQUIRED_FIELDS = ["slug", "title", "metaDescription", "publishDate"];

/** `/content/blog/my-post.md` -> `my-post` */
export function slugFromPath(path) {
  const base = path.split("/").pop() ?? path;
  return base.replace(/\.md$/, "");
}

function unquote(value) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length > 1) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'") && trimmed.length > 1)
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseFrontmatterBlock(block) {
  const fields = {};
  for (const rawLine of block.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const sep = line.indexOf(":");
    if (sep === -1) continue;
    fields[line.slice(0, sep).trim()] = unquote(line.slice(sep + 1));
  }
  return fields;
}

/**
 * Parse one `content/blog/[slug].md` file into a post object.
 *
 * Throws on anything malformed rather than silently dropping the post: a
 * broken post that fails the build is recoverable, a post that quietly never
 * renders is not. Callers that must survive one bad file (the app's runtime
 * loader) catch per-file.
 *
 * @param {string} raw   full file contents
 * @param {string} path  file path, used for the slug/filename check and errors
 */
export function parsePost(raw, path) {
  const match = FRONTMATTER_RE.exec(raw.replace(/^﻿/, ""));
  if (!match) {
    throw new Error(`${path}: missing or malformed YAML frontmatter block`);
  }

  const fields = parseFrontmatterBlock(match[1]);
  const body = match[2].replace(/^\r?\n/, "");

  for (const field of REQUIRED_FIELDS) {
    if (!fields[field]) {
      throw new Error(`${path}: missing required frontmatter field "${field}"`);
    }
  }

  const expectedSlug = slugFromPath(path);
  if (fields.slug !== expectedSlug) {
    throw new Error(
      `${path}: frontmatter slug "${fields.slug}" does not match filename "${expectedSlug}"`,
    );
  }

  if (!ISO_DATE_RE.test(fields.publishDate)) {
    throw new Error(
      `${path}: publishDate "${fields.publishDate}" must be an ISO date (YYYY-MM-DD)`,
    );
  }

  return {
    slug: fields.slug,
    title: fields.title,
    metaDescription: fields.metaDescription,
    publishDate: fields.publishDate,
    pillar: fields.pillar ? Number(fields.pillar) : undefined,
    keywords: fields.keywords || undefined,
    ogImage: fields.ogImage || undefined,
    schema: fields.schema || "BlogPosting",
    body,
  };
}

/**
 * A post is live once its publishDate has arrived (UTC day boundary).
 *
 * Note the deploy caveat: snapshots and the sitemap are filtered at build
 * time, so a post dated in the future needs a deploy on or after that date to
 * become visible to crawlers. See the spec's Scheduling note.
 */
export function isPublished(post, now = new Date()) {
  return post.publishDate <= now.toISOString().slice(0, 10);
}

/** Newest first. Returns a new array. */
export function sortByPublishDate(posts) {
  return [...posts].sort((a, b) => b.publishDate.localeCompare(a.publishDate));
}
