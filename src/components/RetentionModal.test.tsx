import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RetentionModal from "./RetentionModal";

vi.mock("../utils/analytics", () => ({ track: vi.fn() }));

const setup = (props: Partial<React.ComponentProps<typeof RetentionModal>> = {}) =>
  render(
    <RetentionModal
      isOpen
      tier="paid_monthly"
      onClose={vi.fn()}
      onApplyOffer={vi.fn()}
      onConfirmCancel={vi.fn()}
      {...props}
    />,
  );

/** Walks the modal from the confirm step to whatever comes next. */
const continueToCancel = async () => {
  await userEvent.click(screen.getByRole("button", { name: /Continue to cancel/i }));
};

describe("RetentionModal", () => {
  it("offers a discount to a paying subscriber", async () => {
    setup();
    await continueToCancel();
    expect(screen.getByText(/50% off for 2 months/i)).toBeInTheDocument();
  });

  it("skips the discount for someone still in their free trial", async () => {
    setup({ inTrial: true });
    await continueToCancel();
    // Straight to the reason step: discounting a trial would discount the very
    // first invoice they were always going to be charged.
    expect(screen.queryByText(/50% off for 2 months/i)).not.toBeInTheDocument();
    expect(screen.getByText(/why are you leaving/i)).toBeInTheDocument();
  });

  it("skips the discount for someone who already redeemed one", async () => {
    setup({ offerUsed: true });
    await continueToCancel();
    expect(screen.queryByText(/50% off for 2 months/i)).not.toBeInTheDocument();
    expect(screen.getByText(/why are you leaving/i)).toBeInTheDocument();
  });

  it("hides the switch-to-annual offer for annual subscribers", async () => {
    setup({ tier: "paid_annual" });
    await continueToCancel();
    expect(screen.queryByText(/Switch to annual/i)).not.toBeInTheDocument();
  });
});
