import { describe, it, expect } from "vitest";
import { isProRole } from "./gating";

describe("isProRole", () => {
  it("is true for paid/admin/free_full", () => {
    expect(isProRole("paid")).toBe(true);
    expect(isProRole("admin")).toBe(true);
    expect(isProRole("free_full")).toBe(true);
  });
  it("is false for free or undefined", () => {
    expect(isProRole("free")).toBe(false);
    expect(isProRole(undefined)).toBe(false);
  });
});
