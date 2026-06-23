import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import FlagList from "./FlagList";
import { Flag } from "../../../services/accountSignal";

const flags: Flag[] = [
  { type: "champion_loss", severity: "critical", evidence: "The champion left.", reviewIds: ["a", "b", "c"] },
  { type: "brutal_procurement", severity: "caution", evidence: "40% discount demand.", reviewIds: ["d"] },
];

describe("FlagList", () => {
  it("shows evidence quotes for Pro users", () => {
    render(<MemoryRouter><FlagList flags={flags} isPro={true} /></MemoryRouter>);
    expect(screen.getByText(/The champion left\./)).toBeInTheDocument();
  });

  it("hides evidence and shows an unlock CTA for free users", () => {
    render(<MemoryRouter><FlagList flags={flags} isPro={false} /></MemoryRouter>);
    expect(screen.queryByText(/The champion left\./)).not.toBeInTheDocument();
    expect(screen.getByText(/unlock 2 flags/i)).toBeInTheDocument();
  });
});
