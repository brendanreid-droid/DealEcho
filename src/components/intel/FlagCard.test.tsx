import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import * as Accordion from "@radix-ui/react-accordion";
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
  polarity: "risk",
};

/** Render a card already expanded - most assertions here are about body content. */
const renderOpen = (f: AccountFlag = flag, checked: string[] = [], onToggle = () => {}, onShowEvidence = () => {}) =>
  render(
    <Accordion.Root type="multiple" defaultValue={[f.id]}>
      <FlagCard flag={f} checked={checked} onToggle={onToggle} showDetail onShowEvidence={onShowEvidence} />
    </Accordion.Root>,
  );

describe("FlagCard", () => {
  it("shows the finding, the stat and the report count", () => {
    renderOpen();
    expect(screen.getByText("Security review is a gate")).toBeInTheDocument();
    expect(screen.getByText("7 of 9 deals")).toBeInTheDocument();
    expect(screen.getByText("3 reports")).toBeInTheDocument();
  });

  it("lists each qualification point as a checkbox", () => {
    renderOpen();
    expect(screen.getAllByRole("checkbox")).toHaveLength(2);
    expect(screen.getByText("which review tier applies")).toBeInTheDocument();
  });

  it("reports the point id when a point is ticked", () => {
    const onToggle = vi.fn();
    renderOpen(flag, [], onToggle);
    fireEvent.click(screen.getAllByRole("checkbox")[0]);
    expect(onToggle).toHaveBeenCalledWith(pointId("security-review", "which review tier applies"));
  });

  it("reflects an already ticked point", () => {
    renderOpen(flag, [pointId("security-review", "who signs it off")]);
    expect(screen.getAllByRole("checkbox")[1]).toBeChecked();
  });

  it("marks a free-text flag as coming from written reports", () => {
    renderOpen({ ...flag, source: "reports" });
    expect(screen.getByText("From written reports")).toBeInTheDocument();
  });

  it("does not mark a structured flag", () => {
    renderOpen();
    expect(screen.queryByText("From written reports")).not.toBeInTheDocument();
  });

  it("hides the stat and qualification points for non-Pro users", () => {
    render(<FlagCard flag={flag} checked={[]} onToggle={() => {}} showDetail={false} onShowEvidence={() => {}} />);
    expect(screen.getByText("Security review is a gate")).toBeInTheDocument();
    expect(screen.queryByText("7 of 9 deals")).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });
});

describe("FlagCard evidence link", () => {
  it("reports the backing review ids when the report count is clicked", () => {
    const onShowEvidence = vi.fn();
    renderOpen(flag, [], () => {}, onShowEvidence);
    fireEvent.click(screen.getByRole("button", { name: "3 reports" }));
    expect(onShowEvidence).toHaveBeenCalledWith(["a", "b", "c"]);
  });

  it("renders no evidence link for a flag with no per-review provenance", () => {
    // Modal-driven flags (payment terms, committee size) aggregate a field and
    // carry no reviewIds. "0 reports" beside a "6 of 8 deals" stat looks broken.
    renderOpen({ ...flag, reviewIds: [] });
    expect(screen.queryByText(/report/)).not.toBeInTheDocument();
  });

  it("offers no evidence link to non-Pro users", () => {
    render(
      <FlagCard flag={flag} checked={[]} onToggle={() => {}} showDetail={false} onShowEvidence={() => {}} />,
    );
    expect(screen.queryByRole("button", { name: /report/ })).not.toBeInTheDocument();
  });
});

describe("FlagCard polarity", () => {
  it("renders a strength with the positive accent, not the risk accent", () => {
    const { container } = renderOpen({ ...flag, polarity: "strength", severity: "watch" });
    expect(container.querySelector(".border-l-signal-healthy")).not.toBeNull();
    expect(container.querySelector(".border-l-signal-risk")).toBeNull();
  });

  it("keeps the risk accent for a risk flag", () => {
    const { container } = renderOpen();
    expect(container.querySelector(".border-l-signal-healthy")).toBeNull();
  });
});

describe("FlagCard collapsing", () => {
  const renderCollapsible = (over: Partial<AccountFlag> = {}, checked: string[] = []) =>
    render(
      <Accordion.Root type="multiple">
        <FlagCard
          flag={{ ...flag, ...over }}
          checked={checked}
          onToggle={() => {}}
          showDetail
          onShowEvidence={() => {}}
        />
      </Accordion.Root>,
    );

  it("keeps the finding and its stat visible without expanding", () => {
    renderCollapsible();
    expect(screen.getByText("Security review is a gate")).toBeInTheDocument();
    expect(screen.getByText("7 of 9 deals")).toBeInTheDocument();
  });

  it("hides the qualification points until the flag is expanded", () => {
    renderCollapsible();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Security review is a gate/ }));
    expect(screen.getAllByRole("checkbox")).toHaveLength(2);
    expect(screen.getByText("which review tier applies")).toBeInTheDocument();
  });

  it("shows how many points are outstanding while collapsed", () => {
    renderCollapsible({}, [pointId("security-review", "who signs it off")]);
    expect(screen.getByText("1/2")).toBeInTheDocument();
  });

  it("hides the evidence link until expanded, then offers it", () => {
    renderCollapsible();
    expect(screen.queryByRole("button", { name: "3 reports" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Security review is a gate/ }));
    expect(screen.getByRole("button", { name: "3 reports" })).toBeInTheDocument();
  });

  it("gives non-Pro users no expander at all", () => {
    render(
      <FlagCard flag={flag} checked={[]} onToggle={() => {}} showDetail={false} onShowEvidence={() => {}} />,
    );
    expect(screen.getByText("Security review is a gate")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
