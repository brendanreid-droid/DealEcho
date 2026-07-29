import { describe, it, expect } from "vitest";
import { decideInviteTarget } from "./admin";

describe("decideInviteTarget", () => {
  it("creates when the address is unused", () => {
    expect(decideInviteTarget(null)).toEqual({ mode: "create" });
  });

  it("adopts an account that has never signed in", () => {
    // The orphan case: created by a previous invite that failed before it could
    // send the setup link, leaving a retry with nothing it could do.
    expect(decideInviteTarget({ uid: "u1", lastSignInTime: null })).toEqual({
      mode: "adopt",
      uid: "u1",
    });
    expect(decideInviteTarget({ uid: "u1" })).toEqual({ mode: "adopt", uid: "u1" });
  });

  it("refuses an account someone has actually used", () => {
    expect(() =>
      decideInviteTarget({ uid: "u1", lastSignInTime: "Wed, 29 Jul 2026 10:49:28 GMT" }),
    ).toThrowError(/active account already uses that email/i);
  });

  it("refuses with already-exists rather than an internal error", () => {
    // A 500 gives the admin nothing to act on; this code lets the UI say why.
    try {
      decideInviteTarget({ uid: "u1", lastSignInTime: "Wed, 29 Jul 2026 10:49:28 GMT" });
      throw new Error("should have thrown");
    } catch (err: any) {
      expect(err.code).toBe("already-exists");
    }
  });
});
