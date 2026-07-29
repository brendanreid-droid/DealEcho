import { describe, it, expect } from "vitest";
import { decideHelpfulToggle, isPubliclyVisible } from "./reviewHelpful";

const review = (over: Record<string, unknown> = {}) => ({
  userId: "author",
  moderationStatus: "approved",
  helpfulCount: 3,
  ...over,
});

describe("isPubliclyVisible", () => {
  it("treats an approved review as visible", () => {
    expect(isPubliclyVisible({ moderationStatus: "approved" })).toBe(true);
  });
  it("treats a legacy review with no moderation field as visible", () => {
    expect(isPubliclyVisible({})).toBe(true);
  });
  it("treats pending and rejected as not visible", () => {
    expect(isPubliclyVisible({ moderationStatus: "pending" })).toBe(false);
    expect(isPubliclyVisible({ moderationStatus: "rejected" })).toBe(false);
  });
});

describe("decideHelpfulToggle", () => {
  it("adds a vote and increments", () => {
    expect(decideHelpfulToggle(review(), false, "voter")).toEqual({ adding: true, helpfulCount: 4 });
  });

  it("removes an existing vote and decrements", () => {
    expect(decideHelpfulToggle(review(), true, "voter")).toEqual({ adding: false, helpfulCount: 2 });
  });

  it("starts from zero when the review has never been voted on", () => {
    expect(decideHelpfulToggle(review({ helpfulCount: undefined }), false, "voter")).toEqual({
      adding: true,
      helpfulCount: 1,
    });
  });

  it("ignores a non-numeric stored count rather than propagating NaN", () => {
    expect(decideHelpfulToggle(review({ helpfulCount: "many" }), false, "voter")).toEqual({
      adding: true,
      helpfulCount: 1,
    });
  });

  it("never returns a negative count", () => {
    // Votes removed by hand would otherwise drive the counter below zero.
    expect(decideHelpfulToggle(review({ helpfulCount: 0 }), true, "voter")).toEqual({
      adding: false,
      helpfulCount: 0,
    });
  });

  it("refuses a self-vote", () => {
    expect(() => decideHelpfulToggle(review(), false, "author")).toThrowError(
      /cannot mark your own review/i,
    );
  });

  it("refuses a missing review", () => {
    expect(() => decideHelpfulToggle(null, false, "voter")).toThrowError(/no longer exists/i);
  });

  it("refuses a review still in moderation, with the same error as a missing one", () => {
    // Distinguishing the two would confirm a hidden review exists to anyone
    // who guessed its id.
    expect(() => decideHelpfulToggle(review({ moderationStatus: "pending" }), false, "voter"))
      .toThrowError(/no longer exists/i);
    expect(() => decideHelpfulToggle(review({ moderationStatus: "rejected" }), false, "voter"))
      .toThrowError(/no longer exists/i);
  });

  it("allows voting on a legacy review with no moderation field", () => {
    expect(
      decideHelpfulToggle({ userId: "author", helpfulCount: 1 }, false, "voter"),
    ).toEqual({ adding: true, helpfulCount: 2 });
  });
});
