import { describe, it, expect } from "vitest";
import { validatePostInput, serializePost, PostInput } from "./postFile";

const VALID: PostInput = {
  slug: "a-good-post",
  title: "A Good Post",
  metaDescription: "What the post is about.",
  publishDate: "2026-08-04",
  body: "Lead paragraph.\n",
};

describe("validatePostInput", () => {
  it("accepts a well-formed post", () => {
    expect(() => validatePostInput(VALID)).not.toThrow();
  });

  it.each(["slug", "title", "metaDescription", "publishDate", "body"] as const)(
    "rejects a missing %s",
    (field) => {
      const input = { ...VALID, [field]: "" };
      expect(() => validatePostInput(input)).toThrow(new RegExp(field, "i"));
    },
  );

  it("rejects a slug that is not lowercase-kebab", () => {
    expect(() => validatePostInput({ ...VALID, slug: "Not A Slug" })).toThrow(/slug/i);
    expect(() => validatePostInput({ ...VALID, slug: "trailing-" })).toThrow(/slug/i);
    expect(() => validatePostInput({ ...VALID, slug: "../escape" })).toThrow(/slug/i);
  });

  it("rejects a non-ISO publishDate", () => {
    expect(() => validatePostInput({ ...VALID, publishDate: "4 Aug 2026" })).toThrow(
      /publishDate/,
    );
  });

  it("rejects a metaDescription over 200 chars", () => {
    expect(() =>
      validatePostInput({ ...VALID, metaDescription: "x".repeat(201) }),
    ).toThrow(/metaDescription/);
  });

  it("rejects a pillar outside 1-3", () => {
    expect(() => validatePostInput({ ...VALID, pillar: 9 })).toThrow(/pillar/);
    expect(() => validatePostInput({ ...VALID, pillar: 2 })).not.toThrow();
  });
});

describe("serializePost", () => {
  it("writes frontmatter the app parser accepts", () => {
    const md = serializePost({ ...VALID, pillar: 3, keywords: "a, b" });
    const lines = md.split("\n");

    expect(lines[0]).toBe("---");
    expect(md).toContain("slug: a-good-post");
    expect(md).toContain('title: "A Good Post"');
    expect(md).toContain('metaDescription: "What the post is about."');
    expect(md).toContain("publishDate: 2026-08-04");
    expect(md).toContain("pillar: 3");
    expect(md).toContain('keywords: "a, b"');
    expect(md).toContain("schema: BlogPosting");
    expect(md).toContain("Lead paragraph.");
  });

  it("omits optional fields that were not supplied", () => {
    const md = serializePost(VALID);
    expect(md).not.toContain("pillar:");
    expect(md).not.toContain("keywords:");
    expect(md).not.toContain("ogImage:");
  });

  it("escapes double quotes so the frontmatter block stays parseable", () => {
    const md = serializePost({ ...VALID, title: 'The "Best" Post' });
    expect(md).toContain('title: "The \\"Best\\" Post"');
  });

  it("strips a leading H1 from the body, which the page already renders", () => {
    const md = serializePost({ ...VALID, body: "# A Good Post\n\nLead paragraph.\n" });
    expect(md).not.toContain("# A Good Post");
    expect(md).toContain("Lead paragraph.");
  });

  it("normalises CRLF and guarantees a trailing newline", () => {
    const md = serializePost({ ...VALID, body: "One.\r\n\r\nTwo." });
    expect(md).not.toContain("\r");
    expect(md.endsWith("\n")).toBe(true);
  });
});
