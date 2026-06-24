import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import StatStrip from "./StatStrip";

beforeEach(() => {
  window.matchMedia = ((q: string) =>
    ({ matches: true, media: q, addEventListener() {}, removeEventListener() {},
       addListener() {}, removeListener() {}, onchange: null,
       dispatchEvent: () => false })) as unknown as typeof window.matchMedia;
});

describe("StatStrip", () => {
  it("renders each stat label and value", () => {
    render(<StatStrip stats={[{ n: 420, l: "Accounts" }, { n: 38, l: "Industries" }]} />);
    expect(screen.getByText("420")).toBeInTheDocument();
    expect(screen.getByText("Accounts")).toBeInTheDocument();
    expect(screen.getByText("Industries")).toBeInTheDocument();
  });
});
