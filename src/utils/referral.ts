/**
 * Referral invite capture.
 *
 * Invite emails link to https://dealecho.io/?invite=TOKEN. We stash the token
 * on landing and hand it to the claimReferral callable once the account exists.
 *
 * This is functional storage - it delivers a benefit the visitor was explicitly
 * offered - not marketing tracking, so unlike the attribution cookie it is not
 * gated on marketing consent. See src/utils/consent.ts.
 */

export const REFERRAL_STORAGE_KEY = "dealecho_referral_invite";

/** Must match the 60-day server-side invite expiry. */
const MAX_AGE_MS = 60 * 24 * 60 * 60 * 1000;

/** Tokens are 32 URL-safe base64 characters, generated server-side. */
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

interface StoredInvite {
  token: string;
  capturedAt: number;
}

function read(): StoredInvite | null {
  try {
    const raw = localStorage.getItem(REFERRAL_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredInvite;
    if (typeof parsed?.token !== "string" || typeof parsed?.capturedAt !== "number") {
      return null;
    }
    return parsed;
  } catch {
    // Private browsing, disabled storage, or corrupt content. Never throw:
    // this runs on every app load and must not be able to break the page.
    return null;
  }
}

/**
 * Reads ?invite= from the URL, stores it, and strips the parameter so the token
 * does not leak into analytics or get copy-pasted onward by the recipient.
 * Safe to call on every app load.
 */
export function captureInviteToken(): void {
  try {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("invite");
    if (!token) return;

    // Always strip, even if we reject the value.
    params.delete("invite");
    const query = params.toString();
    window.history.replaceState(
      {},
      "",
      `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`,
    );

    if (!TOKEN_PATTERN.test(token)) return;

    // First invite wins. Re-writing would let a later link steal attribution
    // from the person who actually made the introduction.
    if (read()) return;

    localStorage.setItem(
      REFERRAL_STORAGE_KEY,
      JSON.stringify({ token, capturedAt: Date.now() } satisfies StoredInvite),
    );
  } catch {
    // Non-fatal by design.
  }
}

export function storedInviteToken(): string | null {
  const stored = read();
  if (!stored) return null;
  if (Date.now() - stored.capturedAt > MAX_AGE_MS) {
    clearInviteToken();
    return null;
  }
  return stored.token;
}

export function clearInviteToken(): void {
  try {
    localStorage.removeItem(REFERRAL_STORAGE_KEY);
  } catch {
    // Non-fatal by design.
  }
}
