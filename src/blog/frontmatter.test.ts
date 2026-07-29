import { describe, it, expect } from "vitest";
import {
  parsePost,
  isPublished,
  sortByPublishDate,
  slugFromPath,
} from "./frontmatter.mjs";

const VALID = `---
slug: g2-for-vendors-no-glassdoor-for-buying-teams
title: "There's a G2 for Vendors. Why Isn't There One for Buyers?"
metaDescription: "Every vendor gets reviewed. Buying teams never do."
publishDate: 2026-08-04
pillar: 3
keywords: "buying team accountability, review buying teams"
schema: BlogPosting
---

Body paragraph one.

## Sources

- SBI Growth, 2024
`;

describe("parsePost", () => {
  it("parses frontmatter fields and body", () => {
    const post = parsePost(VALID, "content/blog/g2-for-vendors-no-glassdoor-for-buying-teams.md");

    expect(post.slug).toBe("g2-for-vendors-no-glassdoor-for-buying-teams");
    expect(post.title).toBe(
      "There's a G2 for Vendors. Why Isn't There One for Buyers?",
    );
    expect(post.metaDescription).toBe(
      "Every vendor gets reviewed. Buying teams never do.",
    );
    expect(post.publishDate).toBe("2026-08-04");
    expect(post.pillar).toBe(3);
    expect(post.keywords).toBe("buying team accountability, review buying teams");
    expect(post.schema).toBe("BlogPosting");
    expect(post.body).toContain("Body paragraph one.");
    expect(post.body).toContain("## Sources");
    // Frontmatter must not leak into the rendered body.
    expect(post.body).not.toContain("metaDescription");
  });

  it("defaults schema to BlogPosting when omitted", () => {
    const post = parsePost(
      `---
slug: a
title: A
metaDescription: D
publishDate: 2026-01-01
---
body`,
      "content/blog/a.md",
    );
    expect(post.schema).toBe("BlogPosting");
  });

  it("keeps single-quoted and unquoted values intact", () => {
    const post = parsePost(
      `---
slug: a
title: 'Quoted: with colon'
metaDescription: Plain description, unquoted
publishDate: 2026-01-01
---
body`,
      "content/blog/a.md",
    );
    expect(post.title).toBe("Quoted: with colon");
    expect(post.metaDescription).toBe("Plain description, unquoted");
  });

  it("throws when the file has no frontmatter block", () => {
    expect(() => parsePost("just a body", "content/blog/a.md")).toThrow(
      /frontmatter/i,
    );
  });

  it("throws when a required field is missing", () => {
    expect(() =>
      parsePost(
        `---
slug: a
title: A
metaDescription: D
---
body`,
        "content/blog/a.md",
      ),
    ).toThrow(/publishDate/);
  });

  it("throws when slug does not match the filename", () => {
    expect(() =>
      parsePost(
        `---
slug: not-the-filename
title: A
metaDescription: D
publishDate: 2026-01-01
---
body`,
        "content/blog/a.md",
      ),
    ).toThrow(/slug/);
  });

  it("throws on an invalid publishDate", () => {
    expect(() =>
      parsePost(
        `---
slug: a
title: A
metaDescription: D
publishDate: 4th of August
---
body`,
        "content/blog/a.md",
      ),
    ).toThrow(/publishDate/);
  });
});

describe("isPublished", () => {
  it("is true for a past or same-day publishDate", () => {
    expect(isPublished({ publishDate: "2026-07-01" }, new Date("2026-07-29T00:00:00Z"))).toBe(true);
    expect(isPublished({ publishDate: "2026-07-29" }, new Date("2026-07-29T09:00:00Z"))).toBe(true);
  });

  it("is false for a future publishDate", () => {
    expect(isPublished({ publishDate: "2026-08-04" }, new Date("2026-07-29T23:59:00Z"))).toBe(false);
  });
});

describe("sortByPublishDate", () => {
  it("sorts newest first", () => {
    const sorted = sortByPublishDate([
      { publishDate: "2026-01-01" },
      { publishDate: "2026-08-04" },
      { publishDate: "2026-05-05" },
    ]);
    expect(sorted.map((p) => p.publishDate)).toEqual([
      "2026-08-04",
      "2026-05-05",
      "2026-01-01",
    ]);
  });

  it("does not mutate the input array", () => {
    const input = [{ publishDate: "2026-01-01" }, { publishDate: "2026-08-04" }];
    sortByPublishDate(input);
    expect(input[0].publishDate).toBe("2026-01-01");
  });
});

describe("slugFromPath", () => {
  it("takes the basename without extension", () => {
    expect(slugFromPath("/content/blog/some-post.md")).toBe("some-post");
    expect(slugFromPath("content/blog/some-post.md")).toBe("some-post");
  });
});
