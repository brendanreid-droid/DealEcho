import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import FlagList from "./FlagList";
import { Flag } from "../../../services/accountSignal";

const flags: Flag[] = [
  { type: "champion_loss", severity: "critical", evidence: "The champion left.", reviewIds: ["a", "b", "c"] },
  { type: "brutal_procurement", severity: "caution", evidence: "40% discount demand.", reviewIds: ["d"] },
];

describe("FlagList", () => {
  it("shows evidence quotes for Pro users", () => {
    render(<FlagList flags={flags} isPro={true} />);
    expect(screen.getByText(/The champion left\./)).toBeInTheDocument();
  });

  it("hides evidence and shows an unlock CTA for free users", () => {
    render(<FlagList flags={flags} isPro={false} />);
    expect(screen.queryByText(/The champion left\./)).not.toBeInTheDocument();
    expect(screen.getByText(/unlock 2 flags/i)).toBeInTheDocument();
  });
});
