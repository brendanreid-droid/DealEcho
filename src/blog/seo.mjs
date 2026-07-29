// src/blog/seo.mjs
//
// Canonical URLs and JSON-LD for blog posts. Shared by the React page
// (pages/BlogPost.tsx) and the build-time prerenderer so the schema a crawler
// sees in a static snapshot is byte-identical to the one the SPA injects.

export const SITE_URL = "https://dealecho.io";

export const blogUrl = () => `${SITE_URL}/blog`;

export const postUrl = (slug) => `${SITE_URL}/blog/${slug}`;

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
