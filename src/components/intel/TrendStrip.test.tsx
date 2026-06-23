import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import TrendStrip from "./TrendStrip";
import { MetricTrend } from "../../../services/accountSignal";

const trend: MetricTrend[] = [
  { metric: "responsiveness", current: 2.8, direction: "down", points: [4, 2.8] },
  { metric: "negotiation", current: 3.2, direction: "up", points: [3, 3.2] },
  { metric: "intent", current: 3.0, direction: "flat", points: [3, 3] },
  { metric: "scope", current: 3.6, direction: "up", points: [3.2, 3.6] },
];

describe("TrendStrip", () => {
  it("renders one tile per metric with its current value", () => {
    render(<TrendStrip trend={trend} />);
    expect(screen.getByText("2.8")).toBeInTheDocument();
    expect(screen.getByText("Responsiveness")).toBeInTheDocument();
    expect(screen.getAllByLabelText(/improving|declining|steady/).length).toBe(4);
  });
});
