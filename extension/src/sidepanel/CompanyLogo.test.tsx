import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CompanyLogo, initials } from "./CompanyLogo";

describe("initials", () => {
  it("takes first letters of up to two words", () => {
    expect(initials("Datadog Inc")).toBe("DI");
    expect(initials("miro")).toBe("M");
    expect(initials("  Crown   Resorts  Limited ")).toBe("CR");
  });
});

describe("CompanyLogo", () => {
  it("renders the favicon when a domain is given", () => {
    render(<CompanyLogo name="Datadog Inc" domain="datadoghq.com" />);
    const img = screen.getByRole("presentation");
    expect(img.getAttribute("src")).toBe(
      "https://www.google.com/s2/favicons?domain=datadoghq.com&sz=64",
    );
  });
  it("renders initials when no domain", () => {
    render(<CompanyLogo name="Datadog Inc" domain={null} />);
    expect(screen.getByText("DI")).toBeTruthy();
  });
});
