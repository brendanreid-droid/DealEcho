// functions/src/blog/postFile.ts
//
// Validation and serialization for blog posts published from the Admin panel.
//
// The authority on the content contract is the frontend parser
// (src/blog/frontmatter.mjs), which runs at build time and fails the deploy on
// a malformed post. This module is deliberately a separate, smaller copy of
// the same rules: it exists so a bad post is rejected in the Admin form, with
// a useful message, instead of silently failing a Vercel build minutes later.
// The functions workspace compiles from its own rootDir and can't import the
// app module, so the rules are restated here — keep the two in sync.

export interface PostInput {
  slug: string;
  title: string;
  metaDescription: string;
  publishDate: string;
  body: string;
  pillar?: number;
  keywords?: string;
  ogImage?: string;
}

// Lowercase kebab only. This value becomes both a URL path segment and a
// filename, so anything else is either an ugly URL or a path-traversal attempt.
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_META_DESCRIPTION = 200;

export function validatePostInput(input: PostInput): void {
  const required: (keyof PostInput)[] = [
    "slug",
    "title",
    "metaDescription",
    "publishDate",
    "body",
  ];
  for (const field of required) {
    const value = input[field];
    if (typeof value !== "string" || value.trim() === "") {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  if (!SLUG_RE.test(input.slug)) {
    throw new Error(
      `Invalid slug "${input.slug}": use lowercase words separated by single hyphens.`,
    );
  }

  if (!ISO_DATE_RE.test(input.publishDate)) {
    throw new Error(`Invalid publishDate "${input.publishDate}": use YYYY-MM-DD.`);
  }

  if (input.metaDescription.length > MAX_META_DESCRIPTION) {
    throw new Error(
      `metaDescription is ${input.metaDescription.length} chars; keep it under ${MAX_META_DESCRIPTION} (155 is ideal for search results).`,
    );
  }

  if (input.pillar !== undefined && ![1, 2, 3].includes(input.pillar)) {
    throw new Error(`Invalid pillar "${input.pillar}": must be 1, 2 or 3.`);
  }
}

/** Quote a frontmatter value, escaping anything that would break the block. */
function quote(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/**
 * Render a post to the exact `content/blog/[slug].md` format the app parser
 * expects. Body is normalised: CRLF stripped, leading H1 removed (the post
 * page renders its own from `title`), trailing newline guaranteed.
 */
export function serializePost(input: PostInput): string {
  const body = input.body
    .replace(/\r\n/g, "\n")
    .replace(/^\s*#\s+.*\n+/, "")
    .trimEnd();

  const lines = [
    "---",
    `slug: ${input.slug}`,
    `title: ${quote(input.title)}`,
    `metaDescription: ${quote(input.metaDescription)}`,
    `publishDate: ${input.publishDate}`,
  ];

  if (input.pillar !== undefined) lines.push(`pillar: ${input.pillar}`);
  if (input.keywords) lines.push(`keywords: ${quote(input.keywords)}`);
  if (input.ogImage) lines.push(`ogImage: ${input.ogImage}`);

  lines.push("schema: BlogPosting", "---", "", body, "");

  return lines.join("\n");
}
