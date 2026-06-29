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
    listCompanyNames: vi.fn(async () => NAMES),
    canonicalizeViaAI: vi.fn(async () => null),
    ...overrides,
  };
}

describe("resolveCompany", () => {
  it("returns a cached domain hit without scanning names", async () => {
    const deps = makeDeps({
      lookupDomainCache: vi.fn(async () => ({ companyId: "c1", companyName: "Datadog Inc" })),
    });
    const res = await resolveCompany({ domain: "www.datadoghq.com" }, deps);
    expect(res?.companyId).toBe("c1");
    expect(deps.listCompanyNames).not.toHaveBeenCalled();
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

  it("falls back to AI when no direct match, then re-matches", async () => {
    const deps = makeDeps({
      canonicalizeViaAI: vi.fn(async () => ({ name: "Snowflake" })),
    });
    const res = await resolveCompany({ domain: "snowflake.io" }, deps);
    expect(deps.canonicalizeViaAI).toHaveBeenCalled();
    expect(res?.companyId).toBe("c2");
    expect(deps.saveDomainCache).toHaveBeenCalledWith(
      "snowflake.io",
      expect.objectContaining({ companyId: "c2" }),
    );
  });

  it("returns null when nothing resolves", async () => {
    const deps = makeDeps({ canonicalizeViaAI: vi.fn(async () => ({ name: "Microsoft" })) });
    const res = await resolveCompany({ domain: "microsoft.com" }, deps);
    expect(res).toBeNull();
  });
});
