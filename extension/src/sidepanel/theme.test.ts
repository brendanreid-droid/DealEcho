import { describe, it, expect } from "vitest";
import { statusColor, theme } from "./theme";

describe("statusColor", () => {
  it("maps all five review outcomes plus unknown", () => {
    expect(statusColor("Won")).toBe(theme.healthy);
    expect(statusColor("Lost")).toBe(theme.risk);
    expect(statusColor("No Decision")).toBe(theme.risk);
    expect(statusColor("Withdrew")).toBe(theme.caution);
    expect(statusColor("Ongoing")).toBe(theme.accent);
    expect(statusColor("garbage")).toBe(theme.sub);
  });
});
