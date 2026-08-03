import { describe, it, expect } from "vitest";
import { companyLogoUrl, guessDomainFromName } from "./companyLogo";

/** The domain encoded inside a favicon-service URL, for readable assertions. */
function domainOf(url: string | undefined): string | undefined {
  if (!url) return undefined;
  return new URL(url).searchParams.get("domain") ?? undefined;
}

describe("companyLogoUrl", () => {
  it("returns undefined when no domain is known", () => {
    expect(companyLogoUrl({ name: "Country Road Group" })).toBeUndefined();
  });

  it("returns undefined for an implausible domain", () => {
    expect(companyLogoUrl({ name: "Acme", domain: "not a domain" })).toBeUndefined();
  });

  it("builds a favicon URL from a real domain", () => {
    expect(domainOf(companyLogoUrl({ name: "Atlassian", domain: "atlassian.com" })))
      .toBe("atlassian.com");
  });

  // Holding-company domains often ship no favicon at all, so the service 404s
  // and the UI drops to initials. The alias points at the trading brand instead.
  it("resolves a holding-company domain to its verified brand domain", () => {
    expect(
      domainOf(
        companyLogoUrl({
          name: "Country Road Group Holdings Pty Ltd",
          domain: "countryroadgroup.com.au",
        }),
      ),
    ).toBe("countryroad.com.au");
  });

  it("matches aliases regardless of case, www and stray whitespace", () => {
    expect(domainOf(companyLogoUrl({ name: "CRG", domain: " WWW.CountryRoadGroup.com.au " })))
      .toBe("countryroad.com.au");
  });

  it("leaves un-aliased domains alone", () => {
    expect(domainOf(companyLogoUrl({ name: "Country Road", domain: "countryroad.com.au" })))
      .toBe("countryroad.com.au");
  });
});

describe("guessDomainFromName", () => {
  it("guesses for a single-token name", () => {
    expect(guessDomainFromName("Atlassian")).toBe("atlassian.com");
  });

  it("refuses to guess for a multi-word name", () => {
    expect(guessDomainFromName("Country Road Group")).toBeUndefined();
  });
});
