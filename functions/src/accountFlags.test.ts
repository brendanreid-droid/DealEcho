import { describe, it, expect } from "vitest";
import { corpusFingerprint, validateAiFlags, MAX_AI_FLAGS } from "./accountFlags";

describe("corpusFingerprint", () => {
  const corpus = [
    { id: "r1", content: "slow legal" },
    { id: "r2", content: "champion left" },
  ];

  it("is stable for the same corpus", () => {
    expect(corpusFingerprint(corpus)).toBe(corpusFingerprint(corpus));
  });

  it("ignores review order", () => {
    expect(corpusFingerprint(corpus)).toBe(corpusFingerprint([corpus[1], corpus[0]]));
  });

  it("changes when a review is added", () => {
    expect(corpusFingerprint([...corpus, { id: "r3", content: "new" }])).not.toBe(
      corpusFingerprint(corpus),
    );
  });

  it("changes when a review is removed", () => {
    expect(corpusFingerprint([corpus[0]])).not.toBe(corpusFingerprint(corpus));
  });

  it("changes when a review is edited but the count stays the same", () => {
    expect(corpusFingerprint([corpus[0], { id: "r2", content: "champion stayed" }])).not.toBe(
      corpusFingerprint(corpus),
    );
  });
});

describe("validateAiFlags", () => {
  const known = ["r1", "r2", "r3"];

  const raw = (over: Record<string, unknown> = {}) => ({
    label: "Champion lacks budget authority",
    stat: "3 of 9 deals",
    qualify: ["who controls the budget line"],
    reviewIds: ["r1", "r2"],
    severity: "caution",
    ...over,
  });

  it("keeps a well-formed flag and marks it as coming from reports", () => {
    const out = validateAiFlags([raw()], known);
    expect(out).toHaveLength(1);
    expect(out[0].source).toBe("reports");
    expect(out[0].label).toBe("Champion lacks budget authority");
    expect(out[0].reviewIds).toEqual(["r1", "r2"]);
  });

  it("gives each flag a stable id derived from its label", () => {
    expect(validateAiFlags([raw()], known)[0].id).toBe(validateAiFlags([raw()], known)[0].id);
    expect(validateAiFlags([raw()], known)[0].id).toMatch(/^ai-[0-9a-f]{8}$/);
  });

  it("drops invented review ids and keeps the flag when two real citations remain", () => {
    expect(validateAiFlags([raw({ reviewIds: ["r1", "r2", "r99"] })], known)[0].reviewIds).toEqual([
      "r1",
      "r2",
    ]);
  });

  it("drops a flag that falls below two citations once invented ids are stripped", () => {
    expect(validateAiFlags([raw({ reviewIds: ["r1", "r99"] })], known)).toEqual([]);
  });

  it("drops a flag when every citation is invented", () => {
    expect(validateAiFlags([raw({ reviewIds: ["r99"] })], known)).toEqual([]);
  });

  it("drops a flag citing fewer than two reviews", () => {
    expect(validateAiFlags([raw({ reviewIds: ["r1"] })], known)).toEqual([]);
  });

  it("drops a flag whose stat carries no number", () => {
    expect(validateAiFlags([raw({ stat: "several deals" })], known)).toEqual([]);
  });

  it("drops a flag with no qualification points", () => {
    expect(validateAiFlags([raw({ qualify: [] })], known)).toEqual([]);
  });

  it("coerces an unknown severity to caution rather than trusting it", () => {
    expect(validateAiFlags([raw({ severity: "apocalyptic" })], known)[0].severity).toBe("caution");
  });

  it("drops malformed entries without throwing", () => {
    const out = validateAiFlags(
      [null, {}, { label: "" }, raw(), "string"] as any,
      known,
    );
    expect(out).toHaveLength(1);
  });

  it("caps the number of AI flags", () => {
    const many = Array.from({ length: 10 }, (_, i) => raw({ label: `Flag ${i}` }));
    expect(validateAiFlags(many, known)).toHaveLength(MAX_AI_FLAGS);
  });

  it("returns nothing for a non-array", () => {
    expect(validateAiFlags("nope" as any, known)).toEqual([]);
  });
});
