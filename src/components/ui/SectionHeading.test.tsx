import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import SectionHeading from "./SectionHeading";

describe("SectionHeading", () => {
  it("renders the title and the LIVE pill when live", () => {
    render(<SectionHeading title="Recent intelligence" live />);
    expect(screen.getByRole("heading", { name: /Recent intelligence/ })).toBeInTheDocument();
    expect(screen.getByText("LIVE")).toBeInTheDocument();
  });

  it("omits the pill when not live", () => {
    render(<SectionHeading title="Pricing" />);
    expect(screen.queryByText("LIVE")).not.toBeInTheDocument();
  });
});
