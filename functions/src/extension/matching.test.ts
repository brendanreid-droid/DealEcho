import { describe, it, expect } from "vitest";
import { normalizeName, bestNameMatch } from "./matching";

const candidates = [
  { companyId: "c1", companyName: "Datadog Inc" },
  { companyId: "c2", companyName: "Palantir Technologies" },
  { companyId: "c3", companyName: "Snowflake" },
];

describe("normalizeName", () => {
  it("lowercases and strips suffixes/punctuation", () => {
    expect(normalizeName("Datadog, Inc.")).toBe("datadog");
    expect(normalizeName("Palantir Technologies")).toBe("palantir technologies");
  });
});

describe("bestNameMatch", () => {
  it("matches a short query to the fuller name", () => {
    expect(bestNameMatch("Datadog", candidates)?.companyId).toBe("c1");
  });
  it("matches case-insensitively", () => {
    expect(bestNameMatch("snowflake", candidates)?.companyId).toBe("c3");
  });
  it("returns null when nothing is close", () => {
    expect(bestNameMatch("Microsoft", candidates)).toBeNull();
  });
  it("returns null for empty query", () => {
    expect(bestNameMatch("", candidates)).toBeNull();
  });
});
