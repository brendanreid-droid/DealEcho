import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ThemeList from "./ThemeList";
import { AccountTheme } from "../../../services/accountThemes";

const themes: AccountTheme[] = [
  { theme: "The champion frequently lacked budget authority.", reviewIds: ["r2", "r5", "r7"] },
  { theme: "Security review began only after commercial agreement.", reviewIds: ["r1", "r3"] },
];

describe("ThemeList", () => {
  it("renders each theme with its report count", () => {
    render(<ThemeList themes={themes} />);
    expect(screen.getByText(/champion frequently lacked budget authority/)).toBeInTheDocument();
    expect(screen.getByText("3 reports")).toBeInTheDocument();
    expect(screen.getByText("2 reports")).toBeInTheDocument();
  });

  it("renders nothing when there are no themes", () => {
    const { container } = render(<ThemeList themes={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
