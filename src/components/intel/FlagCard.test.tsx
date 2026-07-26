import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import FlagCard from "./FlagCard";
import { AccountFlag, pointId } from "../../../services/accountFlags";

const flag: AccountFlag = {
  id: "security-review",
  label: "Security review is a gate",
  severity: "caution",
  stat: "7 of 9 deals",
  qualify: ["which review tier applies", "who signs it off"],
  reviewIds: ["a", "b", "c"],
  strength: 7 / 9,
  priority: 90,
  source: "mechanics",
};

describe("FlagCard", () => {
  it("shows the finding, the stat and the report count", () => {
    render(<FlagCard flag={flag} checked={[]} onToggle={() => {}} showDetail />);
    expect(screen.getByText("Security review is a gate")).toBeInTheDocument();
    expect(screen.getByText("7 of 9 deals")).toBeInTheDocument();
    expect(screen.getByText("3 reports")).toBeInTheDocument();
  });

  it("lists each qualification point as a checkbox", () => {
    render(<FlagCard flag={flag} checked={[]} onToggle={() => {}} showDetail />);
    expect(screen.getAllByRole("checkbox")).toHaveLength(2);
    expect(screen.getByText("which review tier applies")).toBeInTheDocument();
  });

  it("reports the point id when a point is ticked", () => {
    const onToggle = vi.fn();
    render(<FlagCard flag={flag} checked={[]} onToggle={onToggle} showDetail />);
    fireEvent.click(screen.getAllByRole("checkbox")[0]);
    expect(onToggle).toHaveBeenCalledWith(pointId("security-review", "which review tier applies"));
  });

  it("reflects an already ticked point", () => {
    render(
      <FlagCard
        flag={flag}
        checked={[pointId("security-review", "who signs it off")]}
        onToggle={() => {}}
        showDetail
      />,
    );
    expect(screen.getAllByRole("checkbox")[1]).toBeChecked();
  });

  it("marks a free-text flag as coming from written reports", () => {
    render(
      <FlagCard flag={{ ...flag, source: "reports" }} checked={[]} onToggle={() => {}} showDetail />,
    );
    expect(screen.getByText("From written reports")).toBeInTheDocument();
  });

  it("does not mark a structured flag", () => {
    render(<FlagCard flag={flag} checked={[]} onToggle={() => {}} showDetail />);
    expect(screen.queryByText("From written reports")).not.toBeInTheDocument();
  });

  it("hides the stat and qualification points for non-Pro users", () => {
    render(<FlagCard flag={flag} checked={[]} onToggle={() => {}} showDetail={false} />);
    expect(screen.getByText("Security review is a gate")).toBeInTheDocument();
    expect(screen.queryByText("7 of 9 deals")).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });
});
