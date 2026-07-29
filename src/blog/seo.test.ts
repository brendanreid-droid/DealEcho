import { describe, it, expect } from "vitest";
import { ogImageUrl, linkedInShareUrl, postUrl, DEFAULT_OG_IMAGE } from "./seo.mjs";

const post = (over = {}) => ({
  slug: "a-post",
  title: "A Post",
  metaDescription: "D",
  publishDate: "2026-08-04",
  schema: "BlogPosting",
  body: "",
  ...over,
});

describe("ogImageUrl", () => {
  it("falls back to the site card when a post has no image", () => {
    expect(ogImageUrl(post())).toBe(DEFAULT_OG_IMAGE);
  });

  it("makes a repo-relative image absolute", () => {
    expect(ogImageUrl(post({ ogImage: "/blog/cards/a-post.png" }))).toBe(
      "https://dealecho.io/blog/cards/a-post.png",
    );
  });

  it("leaves an already-absolute image alone", () => {
    expect(ogImageUrl(post({ ogImage: "https://cdn.example.com/a.png" }))).toBe(
      "https://cdn.example.com/a.png",
    );
  });
});

describe("linkedInShareUrl", () => {
  it("points at LinkedIn's share endpoint with the encoded post URL", () => {
    const url = new URL(linkedInShareUrl(post()));
    expect(url.origin + url.pathname).toBe(
      "https://www.linkedin.com/sharing/share-offsite/",
    );

    const shared = new URL(url.searchParams.get("url") ?? "");
    expect(shared.origin + shared.pathname).toBe(postUrl("a-post"));
  });

  it("tags the shared link so reader shares are distinguishable from campaign posts", () => {
    const shared = new URL(
      new URL(linkedInShareUrl(post())).searchParams.get("url") ?? "",
    );
    expect(shared.searchParams.get("utm_source")).toBe("linkedin");
    expect(shared.searchParams.get("utm_medium")).toBe("organic");
    expect(shared.searchParams.get("utm_campaign")).toBe("blog-share");
    expect(shared.searchParams.get("utm_content")).toBe("a-post");
  });
});
