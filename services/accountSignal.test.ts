import { describe, it, expect } from "vitest";
import { getAccountSignal } from "./accountSignal";
import { Review } from "../types";

const base: Review = {
  id: "r1", companyId: "c1", companyName: "Acme", userId: "u1",
  userName: "Verified", currency: "USD", tcvBracket: "$50k - $100k",
  cycleDuration: "3-6 Months", status: "Won", isTender: false,
  buyingTeam: ["Procurement"], location: "US",
  communicationRating: 5, negotiationLevel: 5, timeWasterLevel: 5,
  clarityOfScope: 5, industry: "SaaS", country: "US",
  content: "Smooth deal.", createdAt: "2026-03-01T00:00:00.000Z",
};

const r = (over: Partial<Review>): Review => ({ ...base, ...over });

describe("getAccountSignal", () => {
  it("returns negative sentiment when ratings are low", async () => {
    const sig = await getAccountSignal("Acme", [
      r({ id: "a", status: "Lost", communicationRating: 1, negotiationLevel: 1, timeWasterLevel: 1, clarityOfScope: 1 }),
    ]);
    expect(sig.sentiment).toBe("negative");
    expect(sig.headline.length).toBeGreaterThan(0);
  });

  it("raises a ghosting flag for very low responsiveness", async () => {
    const sig = await getAccountSignal("Acme", [
      r({ id: "g", communicationRating: 1, content: "They ghosted us after the POC." }),
    ]);
    const ghost = sig.flags.find((f) => f.type === "ghosting");
    expect(ghost).toBeDefined();
    expect(ghost!.reviewIds).toContain("g");
    expect(ghost!.evidence).toContain("ghosted");
  });

  it("sorts critical flags before caution flags", async () => {
    const sig = await getAccountSignal("Acme", [
      r({ id: "x", negotiationLevel: 2, content: "Procurement opened at a 40% discount demand." }),
      r({ id: "y", content: "The champion left the company two weeks before signature." }),
    ]);
    expect(sig.flags.length).toBeGreaterThanOrEqual(2);
    expect(sig.flags[0].severity).toBe("critical");
  });

  it("computes a downward trend when later reviews score worse", async () => {
    const sig = await getAccountSignal("Acme", [
      r({ id: "old", createdAt: "2025-01-01T00:00:00.000Z", communicationRating: 5 }),
      r({ id: "new", createdAt: "2026-03-01T00:00:00.000Z", communicationRating: 1 }),
    ]);
    const resp = sig.trend.find((t) => t.metric === "responsiveness");
    expect(resp!.direction).toBe("down");
  });
});
