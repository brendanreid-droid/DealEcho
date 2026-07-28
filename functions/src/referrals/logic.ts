import { randomBytes } from "crypto";

/** Rewarded referrals allowed per referrer per rolling 365 days. */
export const REWARD_CAP_PER_YEAR = 12;
/** Invites a referrer may send per UTC day. */
export const DAILY_INVITE_LIMIT = 20;
/** Invites a referrer may send in total, ever. */
export const LIFETIME_INVITE_LIMIT = 200;
/** Addresses accepted in a single sendReferralInvites call. */
export const MAX_EMAILS_PER_CALL = 10;
/** Days an unclaimed invite stays valid. */
export const INVITE_EXPIRY_DAYS = 60;
/** Rolling reward-cap window, in milliseconds. */
export const REWARD_WINDOW_MS = 365 * 24 * 60 * 60 * 1000;

export type InviteStatus =
  | "sent"
  | "signed_up"
  | "rewarding"
  | "rewarded"
  | "capped"
  | "expired"
  | "void";

export interface QuotaState {
  dayKey: string;
  sentToday: number;
  sentLifetime: number;
}

/**
 * 32-character URL-safe token. 24 random bytes base64url-encode to exactly 32
 * characters with no padding, so the token can go straight into a query string.
 */
export function generateInviteToken(): string {
  return randomBytes(24).toString("base64url");
}

export function normaliseEmail(raw: string): string {
  return typeof raw === "string" ? raw.trim().toLowerCase() : "";
}

/**
 * Deliberately conservative: one @, no whitespace, a dot in the domain. We are
 * gatekeeping outbound mail to third parties, so a false negative (user retypes
 * the address) is much cheaper than a false positive (we spray invalid sends
 * and hurt our sending reputation).
 */
export function isValidEmail(email: string): boolean {
  if (typeof email !== "string") return false;
  if (email.length === 0 || email.length > 254) return false;
  return /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(email);
}

export function expiryFor(sentAtIso: string): string {
  return new Date(Date.parse(sentAtIso) + INVITE_EXPIRY_DAYS * 86_400_000).toISOString();
}

/** A missing or unparseable expiry counts as expired: fail closed. */
export function isInviteExpired(invite: { expiresAt?: string }, now: Date): boolean {
  const ms = Date.parse(invite.expiresAt ?? "");
  if (Number.isNaN(ms)) return true;
  return now.getTime() > ms;
}

/**
 * The anti-fraud gate. New Pro subscriptions get a 30-day trial, so a
 * subscription existing proves nothing. Only a real payment counts.
 *
 * `subscription` moved to `parent.subscription_details` in Stripe API
 * 2025-03-31.basil. We are pinned to 2025-01-27.acacia, but read both so a
 * future API bump degrades to "no reward" rather than "reward everyone".
 */
export function qualifiesForReward(invoice: {
  subscription?: unknown;
  amount_paid?: number;
  billing_reason?: string | null;
  parent?: { subscription_details?: { subscription?: unknown } | null } | null;
}): boolean {
  const subscription =
    invoice.subscription ?? invoice.parent?.subscription_details?.subscription ?? null;
  if (!subscription) return false;
  if (!invoice.amount_paid || invoice.amount_paid <= 0) return false;
  return (
    invoice.billing_reason === "subscription_cycle" ||
    invoice.billing_reason === "subscription_create"
  );
}

export function isCapReached(rewardedInWindow: number): boolean {
  return rewardedInWindow >= REWARD_CAP_PER_YEAR;
}

/** UTC calendar day, e.g. "2026-07-28". Quotas reset at UTC midnight. */
export function dayKeyFor(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/**
 * Works out how many of `requested` invites may actually be sent, and the
 * counter state to persist. Pure so the caller can run it inside a Firestore
 * transaction, which is what makes the limit safe against concurrent calls.
 */
export function nextQuotaState(
  prior: QuotaState | undefined,
  requested: number,
  now: Date,
): { allowed: number; state: QuotaState } {
  const dayKey = dayKeyFor(now);
  const sameDay = prior?.dayKey === dayKey;
  const sentToday = sameDay ? (prior?.sentToday ?? 0) : 0;
  const sentLifetime = prior?.sentLifetime ?? 0;

  const dailyRoom = Math.max(0, DAILY_INVITE_LIMIT - sentToday);
  const lifetimeRoom = Math.max(0, LIFETIME_INVITE_LIMIT - sentLifetime);
  const allowed = Math.max(0, Math.min(requested, dailyRoom, lifetimeRoom));

  return {
    allowed,
    state: {
      dayKey,
      sentToday: sentToday + allowed,
      sentLifetime: sentLifetime + allowed,
    },
  };
}
