import { describe, it, expect } from "vitest";
import { pointId } from "./accountFlags";

describe("pointId", () => {
  it("is stable for the same flag and point text", () => {
    expect(pointId("security-review", "who signs off")).toBe(
      pointId("security-review", "who signs off"),
    );
  });

  it("differs when the point text differs", () => {
    expect(pointId("security-review", "who signs off")).not.toBe(
      pointId("security-review", "which tier applies"),
    );
  });

  it("differs when the flag differs, so identical wording under two flags is tracked apart", () => {
    expect(pointId("security-review", "who signs off")).not.toBe(
      pointId("legal-redlines", "who signs off"),
    );
  });

  it("ignores surrounding whitespace and case so trivial rewording keeps the tick", () => {
    expect(pointId("security-review", "  Who Signs Off  ")).toBe(
      pointId("security-review", "who signs off"),
    );
  });

  it("produces a short printable id", () => {
    expect(pointId("security-review", "who signs off")).toMatch(/^[a-z0-9-]+:[0-9a-f]{8}$/);
  });
});
