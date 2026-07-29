import { describe, it, expect, vi } from "vitest";
import { resolveCompany, ResolverDeps } from "./resolver";
import { CompanyRef } from "./matching";

const NAMES: CompanyRef[] = [
  { companyId: "c1", companyName: "Datadog Inc" },
  { companyId: "c2", companyName: "Snowflake" },
];

function makeDeps(overrides: Partial<ResolverDeps> = {}): ResolverDeps {
  return {
    lookupDomainCache: vi.fn(async () => null),
    saveDomainCache: vi.fn(async () => {}),
    dropDomainCache: vi.fn(async () => {}),
    listCompanyNames: vi.fn(async () => NAMES),
    canonicalizeViaAI: vi.fn(async () => null),
    ...overrides,
  };
}

describe("resolveCompany", () => {
  it("returns a cached domain hit whose companyId is still live", async () => {
    const deps = makeDeps({
      lookupDomainCache: vi.fn(async () => ({ companyId: "c1", companyName: "Datadog Inc" })),
    });
    const res = await resolveCompany({ domain: "www.datadoghq.com" }, deps);
    expect(res?.companyId).toBe("c1");
    expect(deps.canonicalizeViaAI).not.toHaveBeenCalled();
    expect(deps.dropDomainCache).not.toHaveBeenCalled();
  });

  it("prefers the live company name over a stale cached one", async () => {
    // Cached casing/renames drift. The card must show what the reviews say.
    const deps = makeDeps({
      lookupDomainCache: vi.fn(async () => ({ companyId: "c1", companyName: "datadog inc" })),
    });
    const res = await resolveCompany({ domain: "www.datadoghq.com" }, deps);
    expect(res?.companyName).toBe("Datadog Inc");
  });

  it("drops a cached mapping whose companyId no longer exists, then re-resolves", async () => {
    // The Crown Resorts failure: companyIds are regenerated when reviews are
    // recreated, so a stale mapping resolved "successfully" to an id with zero
    // reviews behind it - a card of zeros over a dead /company/<id> link.
    const deps = makeDeps({
      lookupDomainCache: vi.fn(async () => ({ companyId: "dead-id", companyName: "Datadog Inc" })),
      canonicalizeViaAI: vi.fn(async () => ({ name: "Datadog Inc" })),
    });
    const res = await resolveCompany({ domain: "www.datadoghq.com" }, deps);
    expect(deps.dropDomainCache).toHaveBeenCalledWith("datadoghq.com");
    expect(res?.companyId).toBe("c1");
    expect(deps.saveDomainCache).toHaveBeenCalledWith(
      "datadoghq.com",
      expect.objectContaining({ companyId: "c1" }),
    );
  });

  it("returns null when a stale mapping cannot be re-resolved", async () => {
    const deps = makeDeps({
      lookupDomainCache: vi.fn(async () => ({ companyId: "dead-id", companyName: "Best&Less" })),
    });
    const res = await resolveCompany({ domain: "bestandless.com.au" }, deps);
    expect(deps.dropDomainCache).toHaveBeenCalledWith("bestandless.com.au");
    expect(res).toBeNull();
  });

  it("ignores a CRM host and matches on the highlighted name", async () => {
    const deps = makeDeps();
    const res = await resolveCompany({ domain: "acme.lightning.force.com", name: "Datadog" }, deps);
    expect(res?.companyId).toBe("c1");
    expect(deps.lookupDomainCache).not.toHaveBeenCalled();
    expect(deps.saveDomainCache).not.toHaveBeenCalled();
  });

  it("fuzzy-matches a highlighted name", async () => {
    const deps = makeDeps();
    const res = await resolveCompany({ name: "Snowflake" }, deps);
    expect(res?.companyId).toBe("c2");
  });

  it("matches a highlighted name without reading OR writing the domain cache", async () => {
    // Highlighting a name on a page (e.g. dealecho.io / a CRM) must not cache
    // domain→company — otherwise the next highlight on the same site is ignored.
    const deps = makeDeps();
    const res = await resolveCompany({ domain: "www.dealecho.io", name: "Datadog" }, deps);
    expect(res?.companyId).toBe("c1");
    expect(deps.lookupDomainCache).not.toHaveBeenCalled();
    expect(deps.saveDomainCache).not.toHaveBeenCalled();
  });

  it("falls back to AI when no direct match, then re-matches and caches", async () => {
    // Domain deliberately unlike the company name - "snowflake.io" would now be
    // answered from the register without the model ever being asked.
    const deps = makeDeps({
      canonicalizeViaAI: vi.fn(async () => ({ name: "Snowflake" })),
    });
    const res = await resolveCompany({ domain: "sfdw-analytics.io" }, deps);
    expect(deps.canonicalizeViaAI).toHaveBeenCalled();
    expect(res?.companyId).toBe("c2");
    expect(deps.saveDomainCache).toHaveBeenCalledWith(
      "sfdw-analytics.io",
      expect.objectContaining({ companyId: "c2" }),
    );
  });

  it("resolves a domain from the register without calling the model", async () => {
    // The refresh bug: an uncached domain had only the AI path to an answer, so
    // a model miss returned "no reviews" for a company that has them, and the
    // retry usually succeeded. Deterministic matching removes the dice roll.
    const deps = makeDeps({
      listCompanyNames: vi.fn(async () => [{ companyId: "crown", companyName: "Crown Resorts" }]),
    });
    const res = await resolveCompany({ domain: "www.crownresorts.com.au" }, deps);
    expect(res?.companyId).toBe("crown");
    expect(deps.canonicalizeViaAI).not.toHaveBeenCalled();
    expect(deps.saveDomainCache).toHaveBeenCalledWith(
      "crownresorts.com.au",
      expect.objectContaining({ companyId: "crown" }),
    );
  });

  it("re-resolves a stale mapping from the register, not the model", async () => {
    const deps = makeDeps({
      lookupDomainCache: vi.fn(async () => ({ companyId: "dead-id", companyName: "Crown resorts" })),
      listCompanyNames: vi.fn(async () => [{ companyId: "crown", companyName: "Crown Resorts" }]),
    });
    const res = await resolveCompany({ domain: "crownresorts.com.au" }, deps);
    expect(deps.dropDomainCache).toHaveBeenCalledWith("crownresorts.com.au");
    expect(res?.companyId).toBe("crown");
    expect(deps.canonicalizeViaAI).not.toHaveBeenCalled();
  });

  it("still falls back to the model when the domain does not resemble the company", async () => {
    const deps = makeDeps({ canonicalizeViaAI: vi.fn(async () => ({ name: "Snowflake" })) });
    const res = await resolveCompany({ domain: "sfdata.io" }, deps);
    expect(deps.canonicalizeViaAI).toHaveBeenCalled();
    expect(res?.companyId).toBe("c2");
  });

  it("returns null when nothing resolves", async () => {
    const deps = makeDeps({ canonicalizeViaAI: vi.fn(async () => ({ name: "Microsoft" })) });
    const res = await resolveCompany({ domain: "microsoft.com" }, deps);
    expect(res).toBeNull();
  });
});
