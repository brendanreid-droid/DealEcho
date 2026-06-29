import { describe, it, expect } from "vitest";
import { registrableDomain, isCrmHost } from "./domains";

describe("registrableDomain", () => {
  it("strips www and protocol", () => {
    expect(registrableDomain("https://www.acme.com/path")).toBe("acme.com");
  });
  it("keeps multi-part TLDs distinct (no collapsing to com.au)", () => {
    expect(registrableDomain("https://www.kokodaproperty.com.au")).toBe("kokodaproperty.com.au");
    expect(registrableDomain("www.villageroadshow.com.au")).toBe("villageroadshow.com.au");
  });
  it("keeps subdomains (avoids wrongly merging hosts)", () => {
    expect(registrableDomain("careers.acme.com")).toBe("careers.acme.com");
  });
  it("handles a bare hostname", () => {
    expect(registrableDomain("acme.com")).toBe("acme.com");
  });
  it("returns empty string for junk", () => {
    expect(registrableDomain("")).toBe("");
  });
});

describe("isCrmHost", () => {
  it("flags salesforce", () => {
    expect(isCrmHost("acme.lightning.force.com")).toBe(true);
    expect(isCrmHost("salesforce.com")).toBe(true);
  });
  it("flags hubspot", () => {
    expect(isCrmHost("app.hubspot.com")).toBe(true);
  });
  it("does not flag a normal prospect site", () => {
    expect(isCrmHost("acme.com")).toBe(false);
  });
});
