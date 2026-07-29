// functions/src/blog/publishPost.ts
//
// Admin-only callables that publish blog posts by committing markdown files to
// this repo through the GitHub Contents API. Vercel picks up the commit and
// deploys, so a post goes live roughly two minutes after Publish.
//
// Why commit a file instead of writing a Firestore doc: the blog's whole value
// is that crawlers get real prerendered HTML (see scripts/prerender-seo.mjs).
// That only works if posts exist as files at build time. Storing posts in
// Firestore would mean bots — GPTBot, PerplexityBot, LinkedInBot, none of
// which run JavaScript — see an empty shell, which is the exact problem the
// blog was built to fix. Committing keeps prerendering, the sitemap, social
// cards, git history and rollback, and costs only publish latency.
//
// Auth: admin custom claim required, same guard as the rest of the admin
// surface. The GitHub token is server-side only (functions/.env, written by CI
// from the GITHUB_CONTENT_TOKEN secret) and never reaches the client.

import { onCall, HttpsError, CallableRequest } from "firebase-functions/v2/https";
import { validatePostInput, serializePost, PostInput } from "./postFile";

const REPO = "brendanreid-droid/DealEcho";
const BRANCH = "main";
const CONTENT_DIR = "content/blog";
const GITHUB_API = "https://api.github.com";

function requireAdmin(request: CallableRequest<any>): string {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be signed in.");
  }
  if ((request.auth.token as any).role !== "admin") {
    throw new HttpsError("permission-denied", "Admin access required.");
  }
  return request.auth.token.email ?? request.auth.uid;
}

function githubToken(): string {
  const token = process.env.GITHUB_CONTENT_TOKEN;
  if (!token) {
    throw new HttpsError(
      "failed-precondition",
      "GITHUB_CONTENT_TOKEN is not configured on the server. Publishing is unavailable until it is set.",
    );
  }
  return token;
}

async function github(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${GITHUB_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${githubToken()}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

/** Maps a GitHub failure to something an admin can act on. */
async function githubError(res: Response, action: string): Promise<HttpsError> {
  const body = await res.text().catch(() => "");
  if (res.status === 401 || res.status === 403) {
    return new HttpsError(
      "failed-precondition",
      `GitHub rejected the ${action} (${res.status}). The content token is likely expired or missing Contents: write on ${REPO}.`,
    );
  }
  if (res.status === 409) {
    return new HttpsError(
      "aborted",
      "This post was changed in the repo since it was loaded. Reload the post and try again.",
    );
  }
  return new HttpsError("internal", `GitHub ${action} failed (${res.status}): ${body.slice(0, 300)}`);
}

const filePath = (slug: string) => `${CONTENT_DIR}/${slug}.md`;

/** Current file sha, or null when the post does not exist yet. */
async function currentSha(slug: string): Promise<string | null> {
  const res = await github(
    `/repos/${REPO}/contents/${filePath(slug)}?ref=${BRANCH}`,
  );
  if (res.status === 404) return null;
  if (!res.ok) throw await githubError(res, "lookup");
  const json = (await res.json()) as { sha: string };
  return json.sha;
}

// ── adminPublishBlogPost ─────────────────────────────────────────────────────
/**
 * Creates or updates content/blog/[slug].md and commits it to main.
 * Returns the commit URL and whether this replaced an existing post.
 */
export const adminPublishBlogPost = onCall({ cors: true }, async (request) => {
  const actor = requireAdmin(request);
  const input = (request.data ?? {}) as PostInput;

  try {
    validatePostInput(input);
  } catch (err: any) {
    throw new HttpsError("invalid-argument", err.message);
  }

  const sha = await currentSha(input.slug);
  const markdown = serializePost(input);

  const res = await github(`/repos/${REPO}/contents/${filePath(input.slug)}`, {
    method: "PUT",
    body: JSON.stringify({
      message: `content: ${sha ? "update" : "publish"} ${input.slug}\n\nPublished from the Admin panel by ${actor}.`,
      content: Buffer.from(markdown, "utf-8").toString("base64"),
      branch: BRANCH,
      ...(sha ? { sha } : {}),
    }),
  });

  if (!res.ok) throw await githubError(res, "commit");

  const json = (await res.json()) as { commit: { html_url: string } };
  return {
    updated: sha !== null,
    path: filePath(input.slug),
    commitUrl: json.commit.html_url,
  };
});

// ── adminListBlogPosts ───────────────────────────────────────────────────────
/** Slugs currently committed under content/blog/. */
export const adminListBlogPosts = onCall({ cors: true }, async (request) => {
  requireAdmin(request);

  const res = await github(`/repos/${REPO}/contents/${CONTENT_DIR}?ref=${BRANCH}`);
  if (res.status === 404) return { posts: [] };
  if (!res.ok) throw await githubError(res, "listing");

  const files = (await res.json()) as { name: string; type: string }[];
  const posts = files
    .filter((f) => f.type === "file" && f.name.endsWith(".md"))
    .map((f) => ({ slug: f.name.replace(/\.md$/, "") }))
    .sort((a, b) => a.slug.localeCompare(b.slug));

  return { posts };
});

// ── adminGetBlogPost ─────────────────────────────────────────────────────────
/** Raw markdown for one post, so the Admin form can load it for editing. */
export const adminGetBlogPost = onCall({ cors: true }, async (request) => {
  requireAdmin(request);
  const slug = (request.data?.slug ?? "") as string;
  if (!slug) throw new HttpsError("invalid-argument", "slug is required.");

  const res = await github(
    `/repos/${REPO}/contents/${filePath(slug)}?ref=${BRANCH}`,
  );
  if (res.status === 404) {
    throw new HttpsError("not-found", `No post found at ${filePath(slug)}.`);
  }
  if (!res.ok) throw await githubError(res, "fetch");

  const json = (await res.json()) as { content: string };
  return {
    slug,
    markdown: Buffer.from(json.content, "base64").toString("utf-8"),
  };
});
