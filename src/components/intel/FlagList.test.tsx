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
    reviewIds: ["a"], strength: 4 / 9, priority: 85, source: "mechanics", polarity: "risk",
  },
  {
    id: "security-review", label: "Security review is a gate", severity: "caution",
    stat: "7 of 9 deals", qualify: ["which review tier applies"],
    reviewIds: ["b"], strength: 7 / 9, priority: 90, source: "mechanics", polarity: "risk",
  },
];

const renderList = (props: Partial<React.ComponentProps<typeof FlagList>> = {}) =>
  render(
    <MemoryRouter>
      <FlagList
        companyId="c1"
        grouped={{ risks: flags, strengths: [] }}
        isPro
        onShowEvidence={() => {}}
        {...props}
      />
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
    // Cards collapse by default now - open the first flag before ticking it.
    fireEvent.click(screen.getAllByRole("button", { expanded: false })[0]);
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
    // Cards collapse by default now - open the first flag before ticking it.
    fireEvent.click(screen.getAllByRole("button", { expanded: false })[0]);
    fireEvent.click(screen.getAllByRole("checkbox")[0]);
    expect(screen.getByText("1 of 2 qualified")).toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <FlagList companyId="c2" grouped={{ risks: flags, strengths: [] }} isPro onShowEvidence={() => {}} />
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
    renderList({ grouped: { risks: [], strengths: [] } });
    expect(screen.getByText(/No red flags detected/)).toBeInTheDocument();
  });
});

describe("FlagList grouping", () => {
  const grouped = {
    risks: [flags[0]],
    strengths: [
      {
        id: "dates-hold", label: "Close dates hold", severity: "watch" as const,
        stat: "0 of 6 deals pushed", qualify: ["what their approval calendar looks like"],
        reviewIds: [], strength: 1, priority: 80, source: "mechanics" as const,
        polarity: "strength" as const,
      },
    ],
  };

  it("renders both groups under their own headings", () => {
    render(
      <MemoryRouter>
        <FlagList companyId="c1" grouped={grouped} isPro onShowEvidence={() => {}} />
      </MemoryRouter>,
    );
    expect(screen.getByText("Watch for")).toBeInTheDocument();
    expect(screen.getByText("In your favour")).toBeInTheDocument();
    expect(screen.getByText("Close dates hold")).toBeInTheDocument();
  });

  it("omits a group heading when that group is empty", () => {
    render(
      <MemoryRouter>
        <FlagList
          companyId="c1"
          grouped={{ risks: grouped.risks, strengths: [] }}
          isPro
          onShowEvidence={() => {}}
        />
      </MemoryRouter>,
    );
    expect(screen.queryByText("In your favour")).not.toBeInTheDocument();
  });
});
