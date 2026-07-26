import type React from "react";
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import FlagList from "./FlagList";
import { AccountFlag } from "../../../services/accountFlags";

const flags: AccountFlag[] = [
  {
    id: "ghosting", label: "Buyer goes quiet mid-cycle", severity: "critical",
    stat: "4 of 9 deals", qualify: ["who to contact when the thread goes cold"],
    reviewIds: ["a"], strength: 4 / 9, priority: 85, source: "mechanics",
  },
  {
    id: "security-review", label: "Security review is a gate", severity: "caution",
    stat: "7 of 9 deals", qualify: ["which review tier applies"],
    reviewIds: ["b"], strength: 7 / 9, priority: 90, source: "mechanics",
  },
];

const renderList = (props: Partial<React.ComponentProps<typeof FlagList>> = {}) =>
  render(
    <MemoryRouter>
      <FlagList companyId="c1" flags={flags} isPro onShowEvidence={() => {}} {...props} />
    </MemoryRouter>,
  );

describe("FlagList", () => {
  beforeEach(() => localStorage.clear());

  it("renders every flag", () => {
    renderList();
    expect(screen.getByText("Buyer goes quiet mid-cycle")).toBeInTheDocument();
    expect(screen.getByText("Security review is a gate")).toBeInTheDocument();
  });

  it("shows a progress count across all qualification points", () => {
    renderList();
    expect(screen.getByText("0 of 2 qualified")).toBeInTheDocument();
  });

  it("persists a ticked point and updates progress", () => {
    renderList();
    fireEvent.click(screen.getAllByRole("checkbox")[0]);
    expect(screen.getByText("1 of 2 qualified")).toBeInTheDocument();
    expect(localStorage.getItem("dealecho_qq:c1")).toContain("ghosting:");
  });

  it("restores ticks from localStorage on mount", () => {
    localStorage.setItem("dealecho_qq:c1", JSON.stringify(["ghosting:00000000"]));
    renderList();
    expect(screen.getByText("0 of 2 qualified")).toBeInTheDocument();
  });

  it("reloads ticks when companyId changes without remounting", () => {
    const { rerender } = renderList();
    fireEvent.click(screen.getAllByRole("checkbox")[0]);
    expect(screen.getByText("1 of 2 qualified")).toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <FlagList companyId="c2" flags={flags} isPro onShowEvidence={() => {}} />
      </MemoryRouter>,
    );
    expect(screen.getByText("0 of 2 qualified")).toBeInTheDocument();
  });

  it("shows the upsell and no progress count for non-Pro users", () => {
    renderList({ isPro: false });
    expect(screen.getByText(/Unlock 2 flags with Sales Pro/)).toBeInTheDocument();
    expect(screen.queryByText(/qualified/)).not.toBeInTheDocument();
  });

  it("says so when there are no flags", () => {
    renderList({ flags: [] });
    expect(screen.getByText(/No red flags detected/)).toBeInTheDocument();
  });
});
