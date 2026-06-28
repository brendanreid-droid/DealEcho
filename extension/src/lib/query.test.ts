import { describe, it, expect } from "vitest";
import { buildLookupInput } from "./query";

describe("buildLookupInput", () => {
  it("uses hostname as domain and selection as name", () => {
    expect(buildLookupInput({ hostname: "www.acme.com", selection: "Datadog", capturedAt: 1 }))
      .toEqual({ domain: "www.acme.com", name: "Datadog" });
  });

  it("omits name when nothing is selected", () => {
    expect(buildLookupInput({ hostname: "acme.com", selection: "", capturedAt: 1 }))
      .toEqual({ domain: "acme.com" });
  });

  it("omits domain when hostname is empty", () => {
    expect(buildLookupInput({ hostname: "", selection: "Snowflake", capturedAt: 1 }))
      .toEqual({ name: "Snowflake" });
  });

  it("returns empty object when both are empty", () => {
    expect(buildLookupInput({ hostname: "", selection: "", capturedAt: 1 })).toEqual({});
  });
});
