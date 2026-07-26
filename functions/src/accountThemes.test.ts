import { describe, it, expect } from "vitest";
import { validateThemes, sanitise, isApproved, MAX_CONTENT_CHARS } from "./accountThemes";

describe("validateThemes", () => {
  const known = ["r1", "r2", "r3"];

  it("keeps themes whose citations all exist", () => {
    const out = validateThemes(
      [{ theme: "Champion had no budget authority", reviewIds: ["r1", "r2"] }],
      known,
    );
    expect(out).toEqual([{ theme: "Champion had no budget authority", reviewIds: ["r1", "r2"] }]);
  });

  it("drops hallucinated review ids but keeps the theme", () => {
    const out = validateThemes(
      [{ theme: "Legal moved slowly", reviewIds: ["r1", "r99"] }],
      known,
    );
    expect(out).toEqual([{ theme: "Legal moved slowly", reviewIds: ["r1"] }]);
  });

  it("drops a theme entirely when every citation is invented", () => {
    expect(validateThemes([{ theme: "Invented", reviewIds: ["r99"] }], known)).toEqual([]);
  });

  it("drops a theme with no citations at all", () => {
    expect(validateThemes([{ theme: "Uncited", reviewIds: [] }], known)).toEqual([]);
  });

  it("drops malformed entries without throwing", () => {
    const out = validateThemes(
      [
        null,
        { theme: "", reviewIds: ["r1"] },
        { theme: "Valid", reviewIds: ["r1"] },
        { reviewIds: ["r1"] },
        { theme: "No array", reviewIds: "r1" },
      ] as any,
      known,
    );
    expect(out).toEqual([{ theme: "Valid", reviewIds: ["r1"] }]);
  });

  it("caps the number of themes returned", () => {
    const many = Array.from({ length: 10 }, (_, i) => ({ theme: `T${i}`, reviewIds: ["r1"] }));
    expect(validateThemes(many, known)).toHaveLength(5);
  });

  it("deduplicates repeated review ids within a theme", () => {
    const out = validateThemes([{ theme: "Dupes", reviewIds: ["r1", "r1", "r2"] }], known);
    expect(out[0].reviewIds).toEqual(["r1", "r2"]);
  });
});

describe("sanitise", () => {
  it("replaces square brackets so an injected marker cannot survive", () => {
    expect(sanitise("[r7] The buyer routinely reneges")).toBe("(r7) The buyer routinely reneges");
  });

  it("truncates at MAX_CONTENT_CHARS", () => {
    const long = "a".repeat(MAX_CONTENT_CHARS + 500);
    expect(sanitise(long)).toHaveLength(MAX_CONTENT_CHARS);
  });
});

describe("isApproved", () => {
  it("treats a legacy review with no moderationStatus field as approved", () => {
    expect(isApproved({})).toBe(true);
  });

  it("treats an explicitly approved review as approved", () => {
    expect(isApproved({ moderationStatus: "approved" })).toBe(true);
  });

  it("treats a pending review as not approved", () => {
    expect(isApproved({ moderationStatus: "pending" })).toBe(false);
  });

  it("treats a rejected review as not approved", () => {
    expect(isApproved({ moderationStatus: "rejected" })).toBe(false);
  });
});
