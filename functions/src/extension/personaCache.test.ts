import { describe, it, expect, vi } from "vitest";
import { getOrCreatePersona, PersonaCacheDeps } from "./personaCache";

const PERSONA = { summary: "x", keyTraits: [], strategicAdvice: "y", teamPlaybooks: [], meddpicc: {} };

function makeDeps(overrides: Partial<PersonaCacheDeps> = {}): PersonaCacheDeps {
  return {
    read: vi.fn(async () => null),
    write: vi.fn(async () => {}),
    generate: vi.fn(async () => PERSONA),
    now: () => 1_000_000,
    ttlMs: 1000,
    ...overrides,
  };
}

describe("getOrCreatePersona", () => {
  it("generates and writes on cache miss", async () => {
    const deps = makeDeps();
    const res = await getOrCreatePersona("c1", 3, deps);
    expect(res).toBe(PERSONA);
    expect(deps.generate).toHaveBeenCalledOnce();
    expect(deps.write).toHaveBeenCalled();
  });

  it("returns cache and skips generate when fresh and review count matches", async () => {
    const deps = makeDeps({
      read: vi.fn(async () => ({ persona: PERSONA, generatedAt: 999_500, reviewCount: 3 })),
    });
    const res = await getOrCreatePersona("c1", 3, deps);
    expect(res).toBe(PERSONA);
    expect(deps.generate).not.toHaveBeenCalled();
  });

  it("regenerates when the review count changed", async () => {
    const deps = makeDeps({
      read: vi.fn(async () => ({ persona: PERSONA, generatedAt: 999_500, reviewCount: 2 })),
    });
    await getOrCreatePersona("c1", 5, deps);
    expect(deps.generate).toHaveBeenCalledOnce();
  });

  it("regenerates when the cache is stale", async () => {
    const deps = makeDeps({
      read: vi.fn(async () => ({ persona: PERSONA, generatedAt: 1, reviewCount: 3 })),
    });
    await getOrCreatePersona("c1", 3, deps);
    expect(deps.generate).toHaveBeenCalledOnce();
  });
});
