// src/blog/seo.mjs
//
// Canonical URLs and JSON-LD for blog posts. Shared by the React page
// (pages/BlogPost.tsx) and the build-time prerenderer so the schema a crawler
// sees in a static snapshot is byte-identical to the one the SPA injects.

export const SITE_URL = "https://dealecho.io";

/** Site-wide social card, used by any post that doesn't supply its own. */
export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.png`;

export const blogUrl = () => `${SITE_URL}/blog`;

export const postUrl = (slug) => `${SITE_URL}/blog/${slug}`;

/**
 * Absolute social-card URL for a post. `ogImage` in frontmatter may be a
 * site-relative path (`/blog/cards/x.png`, served from public/) or a full URL.
 * LinkedIn and Twitter both reject relative image URLs, so this always
 * returns an absolute one.
 */
export function ogImageUrl(post) {
  const image = post.ogImage;
  if (!image) return DEFAULT_OG_IMAGE;
  return image.startsWith("/") ? `${SITE_URL}${image}` : image;
}

/**
 * LinkedIn share-sheet URL for the reader-facing share button. No API or
 * OAuth involved — LinkedIn fetches the target itself and builds the card
 * from the OG tags in the bot snapshot.
 *
 * The shared link is UTM-tagged as campaign `blog-share` so reader shares
 * stay separable from the marketing team's own campaign posts, which use
 * `<pillar>-week<NN>` (see docs/UTM_SCHEME.md).
 */
export function linkedInShareUrl(post) {
  const target = new URL(postUrl(post.slug));
  target.searchParams.set("utm_source", "linkedin");
  target.searchParams.set("utm_medium", "organic");
  target.searchParams.set("utm_campaign", "blog-share");
  target.searchParams.set("utm_content", post.slug);

  return `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(target.toString())}`;
}

/** schema.org BlogPosting for a single post. */
export function blogPostingSchema(post) {
  return {
    "@context": "https://schema.org",
    "@type": post.schema || "BlogPosting",
    headline: post.title,
    description: post.metaDescription,
    datePublished: post.publishDate,
    author: { "@type": "Organization", name: "dealecho" },
    publisher: {
      "@type": "Organization",
      name: "dealecho",
      logo: `${SITE_URL}/logo.png`,
    },
    mainEntityOfPage: postUrl(post.slug),
  };
}

/** schema.org Blog for the index page, listing published posts. */
export function blogIndexSchema(posts) {
  return {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: "Dealecho Blog",
    url: blogUrl(),
    blogPost: posts.map((post) => ({
      "@type": "BlogPosting",
      headline: post.title,
      description: post.metaDescription,
      datePublished: post.publishDate,
      url: postUrl(post.slug),
    })),
  };
}
