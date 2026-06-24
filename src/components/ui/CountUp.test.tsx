import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import CountUp from "./CountUp";

beforeEach(() => {
  window.matchMedia = ((q: string) =>
    ({ matches: true, media: q, addEventListener() {}, removeEventListener() {},
       addListener() {}, removeListener() {}, onchange: null,
       dispatchEvent: () => false })) as unknown as typeof window.matchMedia;
});

describe("CountUp", () => {
  it("jumps to the final value with reduced motion", () => {
    render(<CountUp end={1840} suffix="" />);
    expect(screen.getByText("1,840")).toBeInTheDocument();
  });
});
