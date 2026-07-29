import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { OnboardingChecklistModal, OnboardingSteps } from "./OnboardingChecklist";
import { CHROME_EXTENSION_URL } from "../constants/dealData";

const saveMarketingProfile = vi.fn();
vi.mock("./MarketingProfilePrompt", () => ({
  saveMarketingProfile: (...args: unknown[]) => saveMarketingProfile(...args),
}));
vi.mock("../utils/analytics", () => ({ track: vi.fn() }));

const NONE: OnboardingSteps = {
  hasReview: false,
  hasTracked: false,
  hasProfile: false,
  hasExtension: false,
};

const renderModal = (steps: OnboardingSteps = NONE) =>
  render(
    <MemoryRouter>
      <OnboardingChecklistModal
        open
        steps={steps}
        reviewUnlockUntil={null}
        onClose={() => {}}
        onDismiss={() => {}}
        onAnswerQuestions={() => {}}
      />
    </MemoryRouter>,
  );

describe("OnboardingChecklistModal", () => {
  beforeEach(() => {
    saveMarketingProfile.mockReset();
  });

  it("lists the steps in the order a new user should do them", () => {
    const { container } = renderModal();
    const text = container.textContent ?? "";

    const positions = [
      "Track your first account",
      "Write your first review",
      "Download the browser extension",
      "Tell us about you",
    ].map((title) => {
      const at = text.indexOf(title);
      expect(at, `${title} is missing`).toBeGreaterThan(-1);
      return at;
    });

    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it("opens the live Chrome Web Store listing and marks the step done", async () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByRole("button", { name: /get the extension/i }));

    expect(open).toHaveBeenCalledWith(
      CHROME_EXTENSION_URL,
      "_blank",
      "noopener,noreferrer",
    );
    expect(saveMarketingProfile).toHaveBeenCalledWith({ extensionAdded: true });
    open.mockRestore();
  });

  it("points at a real listing, not the old placeholder", () => {
    expect(CHROME_EXTENSION_URL).toContain("chromewebstore.google.com");
    expect(CHROME_EXTENSION_URL).not.toContain("PLACEHOLDER");
  });
});
