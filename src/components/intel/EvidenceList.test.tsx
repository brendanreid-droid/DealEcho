import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import EvidenceList from "./EvidenceList";
import { Review } from "../../../types";

// The hook reads the caller's own vote from Firestore and toggles via a
// callable. Both are stubbed: this file is about what the list renders and
// which votes it permits, not about transport.
const getDoc = vi.fn(async () => ({ exists: () => false }));
const callable = vi.fn(async () => ({ data: { helpful: true, helpfulCount: 3 } }));

vi.mock("firebase/firestore", () => ({
  doc: (...args: unknown[]) => args,
  getDoc: (...args: unknown[]) => getDoc(...(args as [])),
}));
vi.mock("firebase/functions", () => ({
  getFunctions: () => ({}),
  httpsCallable: () => callable,
}));
vi.mock("../../firebase/config", () => ({
  auth: { get currentUser() { return currentUser; } },
  db: {},
}));

let currentUser: { uid: string } | null = { uid: "reader" };

const review = (over: Partial<Review> = {}): Review => ({
  id: "r1", companyId: "c1", companyName: "Acme", userId: "u1",
  userName: "Verified", currency: "USD", tcvBracket: "$50k - $100k",
  cycleDuration: "3-6 Months", status: "Won", isTender: false,
  buyingTeam: ["Procurement"], location: "US",
  communicationRating: 4, negotiationLevel: 3, timeWasterLevel: 5,
  clarityOfScope: 4, industry: "SaaS", country: "US",
  content: "Smooth, technical-led deal.", createdAt: "2026-03-01T00:00:00.000Z",
  ...over,
});

describe("EvidenceList", () => {
  beforeEach(() => {
    currentUser = { uid: "reader" };
    getDoc.mockClear();
    callable.mockClear();
    callable.mockResolvedValue({ data: { helpful: true, helpfulCount: 3 } });
  });

  it("renders review content and the count", () => {
    render(<EvidenceList reviews={[review()]} />);
    expect(screen.getByText(/Smooth, technical-led deal\./)).toBeInTheDocument();
    expect(screen.getByText(/1 verified report/i)).toBeInTheDocument();
  });

  it("shows the stored helpful count", () => {
    render(<EvidenceList reviews={[review({ helpfulCount: 4 })]} currentUserId="reader" />);
    expect(screen.getByText(/4 people found this helpful/i)).toBeInTheDocument();
  });

  it("uses the singular for one vote", () => {
    render(<EvidenceList reviews={[review({ helpfulCount: 1 })]} currentUserId="reader" />);
    expect(screen.getByText(/1 person found this helpful/i)).toBeInTheDocument();
  });

  it("says so when nobody has voted", () => {
    render(<EvidenceList reviews={[review()]} currentUserId="reader" />);
    expect(screen.getByText(/no one has marked this helpful yet/i)).toBeInTheDocument();
  });

  it("blocks the author from voting on their own review", () => {
    render(<EvidenceList reviews={[review({ userId: "reader" })]} currentUserId="reader" />);
    const btn = screen.getByRole("button", { name: /cannot mark your own review/i });
    expect(btn).toBeDisabled();
  });

  it("blocks a signed-out reader and says why", () => {
    currentUser = null;
    render(<EvidenceList reviews={[review()]} currentUserId={null} />);
    expect(screen.getByRole("button", { name: /sign in to mark a review helpful/i })).toBeDisabled();
  });

  it("counts up optimistically and settles on the server total", async () => {
    callable.mockResolvedValue({ data: { helpful: true, helpfulCount: 9 } });
    render(<EvidenceList reviews={[review({ helpfulCount: 2 })]} currentUserId="reader" />);

    await userEvent.click(screen.getByRole("button", { name: /mark this review helpful/i }));

    // Server is authoritative, so the optimistic 3 is replaced by its 9.
    await waitFor(() => expect(screen.getByText(/9 people found this helpful/i)).toBeInTheDocument());
    expect(callable).toHaveBeenCalledWith({ reviewId: "r1" });
  });

  it("rolls the count back when the vote fails", async () => {
    callable.mockRejectedValue(new Error("offline"));
    render(<EvidenceList reviews={[review({ helpfulCount: 2 })]} currentUserId="reader" />);

    await userEvent.click(screen.getByRole("button", { name: /mark this review helpful/i }));

    await waitFor(() =>
      expect(screen.getByText(/2 people found this helpful/i)).toBeInTheDocument(),
    );
  });

  it("marks the button pressed when the reader has already voted", async () => {
    getDoc.mockResolvedValue({ exists: () => true });
    render(<EvidenceList reviews={[review({ helpfulCount: 5 })]} currentUserId="reader" />);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /undo helpful/i })).toHaveAttribute(
        "aria-pressed",
        "true",
      ),
    );
  });
});
