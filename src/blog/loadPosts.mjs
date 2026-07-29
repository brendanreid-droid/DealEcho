// src/blog/loadPosts.mjs
//
// Node-side loader for content/blog/*.md, used by the build scripts
// (prerender + sitemap). The browser gets the same posts through Vite's
// import.meta.glob in src/blog/posts.ts; both funnel through parsePost so the
// two views of a post can't drift.
//
// Unlike the app loader, this one does NOT swallow parse errors: a malformed
// post should fail `npm run build` rather than quietly ship a blog that is
// missing a page the sitemap promises.

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parsePost, isPublished, sortByPublishDate } from "./frontmatter.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BLOG_CONTENT_DIR = resolve(__dirname, "..", "..", "content", "blog");

/** Published posts, newest first. Empty array when no content dir exists. */
export function loadPublishedPosts(now = new Date()) {
  if (!existsSync(BLOG_CONTENT_DIR)) return [];

  const posts = readdirSync(BLOG_CONTENT_DIR)
    .filter((file) => file.endsWith(".md"))
    .map((file) => {
      const path = join("content/blog", file);
      return parsePost(readFileSync(join(BLOG_CONTENT_DIR, file), "utf-8"), path);
    })
    .filter((post) => isPublished(post, now));

  return sortByPublishDate(posts);
}
