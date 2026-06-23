import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import TrendArrow from "./TrendArrow";

describe("TrendArrow", () => {
  it("labels direction for screen readers", () => {
    render(<TrendArrow direction="down" />);
    expect(screen.getByLabelText(/declining/i)).toBeInTheDocument();
  });
});
