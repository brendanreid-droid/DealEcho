import { describe, it, expect } from "vitest";
import { normalizeName, bestNameMatch, matchByDomainLabel, domainLabel, CompanyRef } from "./matching";

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

describe("domainLabel", () => {
  it("takes the first label of a registrable domain", () => {
    expect(domainLabel("crownresorts.com.au")).toBe("crownresorts");
    expect(domainLabel("victra.com")).toBe("victra");
  });
  it("returns empty for a bare TLD or empty input", () => {
    expect(domainLabel("")).toBe("");
    expect(domainLabel(".com")).toBe("");
  });
});

describe("matchByDomainLabel", () => {
  // The Crown Resorts failure: bestNameMatch scores by token overlap, and a
  // concatenated domain label is one token while the company name is two, so
  // overlap is zero and the lookup fell through to a nondeterministic AI call.
  const live: CompanyRef[] = [
    { companyId: "crown", companyName: "Crown Resorts" },
    { companyId: "affinity", companyName: "Affinity Education Group" },
    { companyId: "genesis", companyName: "Genesis Energy Limited" },
    { companyId: "victra", companyName: "Victra" },
    { companyId: "harris", companyName: "Harris Farm Markets" },
  ];

  it("matches a concatenated label to a multi-word name", () => {
    expect(matchByDomainLabel("crownresorts", live)?.companyId).toBe("crown");
  });
  it("matches a label that is a prefix of a longer name", () => {
    expect(matchByDomainLabel("affinityeducation", live)?.companyId).toBe("affinity");
  });
  it("matches after the corporate suffix is stripped", () => {
    expect(matchByDomainLabel("genesisenergy", live)?.companyId).toBe("genesis");
  });
  it("matches a single-word name exactly", () => {
    expect(matchByDomainLabel("victra", live)?.companyId).toBe("victra");
  });
  it("matches a longer multi-word name", () => {
    expect(matchByDomainLabel("harrisfarmmarkets", live)?.companyId).toBe("harris");
  });
  it("returns null when no company resembles the domain", () => {
    expect(matchByDomainLabel("bestandless", live)).toBeNull();
    expect(matchByDomainLabel("kokodaproperty", live)).toBeNull();
  });
  it("rejects labels too short to be distinctive", () => {
    // "crow" prefixes "crownresorts" but is far too weak to claim the account.
    expect(matchByDomainLabel("crow", live)).toBeNull();
  });
  it("prefers the closest-length candidate when several share a prefix", () => {
    const ambiguous: CompanyRef[] = [
      { companyId: "short", companyName: "Crown" },
      { companyId: "exact", companyName: "Crown Resorts" },
      { companyId: "long", companyName: "Crown Resorts Entertainment Group" },
    ];
    expect(matchByDomainLabel("crownresorts", ambiguous)?.companyId).toBe("exact");
  });
});
