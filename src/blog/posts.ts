// src/blog/posts.ts
//
// Loads every approved post from content/blog/*.md into the bundle at build
// time via Vite's import.meta.glob (eager + ?raw). Nothing is fetched at
// runtime: posts are files in this repo, so publishing is a PR merge and the
// content ships with the deploy. Only the /blog routes import this module,
// and those routes are lazy, so the markdown never lands in the main chunk.

import { parsePost, isPublished, sortByPublishDate } from "./frontmatter.mjs";

export interface BlogPost {
  slug: string;
  title: string;
  metaDescription: string;
  publishDate: string;
  pillar?: number;
  keywords?: string;
  schema: string;
  body: string;
}

const rawPosts = import.meta.glob("/content/blog/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

/**
 * All published posts, newest first.
 *
 * A malformed file is skipped rather than blanking the whole index — the same
 * file also fails `npm run build` loudly in scripts/prerender-seo.mjs, which
 * is where a broken post is meant to be caught.
 */
export function getPosts(now: Date = new Date()): BlogPost[] {
  const posts: BlogPost[] = [];
  for (const [path, raw] of Object.entries(rawPosts)) {
    try {
      const post = parsePost(raw, path) as BlogPost;
      if (isPublished(post, now)) posts.push(post);
    } catch (err) {
      console.error("[blog] skipping unparseable post:", err);
    }
  }
  return sortByPublishDate(posts) as BlogPost[];
}

export function getPost(slug: string, now: Date = new Date()): BlogPost | undefined {
  return getPosts(now).find((post) => post.slug === slug);
}

/** e.g. "4 August 2026" — matches the site's plain-English date style. */
export function formatPublishDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
