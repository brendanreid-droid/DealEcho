import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Referrals from "./Referrals";

const mockCallable = vi.fn();
vi.mock("firebase/functions", () => ({
  getFunctions: () => ({}),
  httpsCallable: () => mockCallable,
}));

const status = (over: Record<string, unknown> = {}) => ({
  data: {
    eligible: true,
    invites: [],
    counts: { sent: 0, signedUp: 0, rewarded: 0 },
    monthsEarned: 0,
    cap: { limit: 12, usedThisYear: 0, remaining: 12 },
    quotaRemainingToday: 20,
    ...over,
  },
});

const renderPage = () =>
  render(
    <MemoryRouter>
      <Referrals />
    </MemoryRouter>,
  );

describe("Referrals", () => {
  // Braces matter: a concise arrow body would return the mock (mockReset is
  // chainable), and Vitest treats a value returned from beforeEach as a
  // teardown hook. It would then call mockCallable() after each test, which
  // with mockRejectedValue still installed throws an unhandled rejection.
  beforeEach(() => {
    mockCallable.mockReset();
  });

  it("shows the invite form to an eligible member", async () => {
    mockCallable.mockResolvedValue(status());
    renderPage();
    expect(await screen.findByRole("button", { name: /Send invites/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/email addresses/i)).toBeInTheDocument();
  });

  it("shows an upgrade prompt to a free user instead of the form", async () => {
    mockCallable.mockResolvedValue(status({ eligible: false }));
    renderPage();
    expect(await screen.findByRole("link", { name: /Upgrade/i })).toHaveAttribute("href", "/pricing");
    expect(screen.queryByRole("button", { name: /Send invites/i })).not.toBeInTheDocument();
  });

  it("reports months earned and cap usage", async () => {
    mockCallable.mockResolvedValue(
      status({ monthsEarned: 3, cap: { limit: 12, usedThisYear: 3, remaining: 9 } }),
    );
    renderPage();
    // Exact match, not /3/: the intro copy says "30 days of Sales Pro free",
    // so a regex would match two elements and throw.
    expect(await screen.findByText("3")).toBeInTheDocument();
    expect(screen.getByText(/9 left this year/i)).toBeInTheDocument();
  });

  it("disables sending once the annual cap is reached", async () => {
    mockCallable.mockResolvedValue(
      status({ cap: { limit: 12, usedThisYear: 12, remaining: 0 } }),
    );
    renderPage();
    expect(await screen.findByText(/reached the maximum/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Send invites/i })).toBeDisabled();
  });

  it("disables sending once today's invite quota is spent", async () => {
    mockCallable.mockResolvedValue(status({ quotaRemainingToday: 0 }));
    renderPage();
    expect(await screen.findByRole("button", { name: /Send invites/i })).toBeDisabled();
  });

  it("lists sent invites with their status", async () => {
    mockCallable.mockResolvedValue(
      status({
        invites: [
          { email: "bob@acme.com", status: "rewarded", sentAt: "2026-07-01T00:00:00.000Z", rewardedAt: "2026-08-02T00:00:00.000Z" },
          { email: "sue@acme.com", status: "sent", sentAt: "2026-07-20T00:00:00.000Z", rewardedAt: null },
        ],
      }),
    );
    renderPage();
    expect(await screen.findByText("bob@acme.com")).toBeInTheDocument();
    expect(screen.getByText("sue@acme.com")).toBeInTheDocument();
    expect(screen.getByText("Earned")).toBeInTheDocument();
    expect(screen.getByText("Sent")).toBeInTheDocument();
  });

  it("surfaces an error when the status call fails", async () => {
    mockCallable.mockRejectedValue(new Error("boom"));
    renderPage();
    await waitFor(() =>
      expect(screen.getByText(/couldn't load your referrals/i)).toBeInTheDocument(),
    );
  });
});
