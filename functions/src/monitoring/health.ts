import { db } from "../lib/firebaseAdmin";

/** No successful webhook in this long means something is wrong. */
export const WEBHOOK_SILENCE_MS = 48 * 60 * 60 * 1000;

/**
 * A payout should move through "rewarding" in seconds. Anything still there
 * after this long means the function died mid-payout.
 */
export const STUCK_REWARDING_MS = 60 * 60 * 1000;

export interface HealthReport {
  webhookSilent: boolean;
  /** Hours since the last verified webhook, or null if there has never been one. */
  hoursSinceLastWebhook: number | null;
  lastWebhookAt: string | null;
  /** Invite tokens stuck mid-payout. */
  stuckInvites: Array<{ token: string; referrerUid: string; since: string }>;
}

/**
 * True when the most recent successful webhook is older than the threshold.
 *
 * This exists because a deleted Stripe endpoint took live billing down for two
 * months in 2026 without a single alert: payments kept succeeding in Stripe
 * while access silently stopped being granted, and the only symptom was a
 * Firestore collection that quietly stopped growing.
 */
export function isWebhookSilent(
  lastSuccessAt: string | null,
  now: Date,
  thresholdMs: number = WEBHOOK_SILENCE_MS,
): boolean {
  if (!lastSuccessAt) return true;
  const ms = Date.parse(lastSuccessAt);
  if (Number.isNaN(ms)) return true;
  return now.getTime() - ms > thresholdMs;
}

/** Whole hours since a timestamp, or null when it is missing/unparseable. */
export function hoursSince(iso: string | null, now: Date): number | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return null;
  return Math.floor((now.getTime() - ms) / 3_600_000);
}

/** True when an invite has been mid-payout long enough to be considered stuck. */
export function isStuckRewarding(
  signedUpAt: string | undefined,
  now: Date,
  thresholdMs: number = STUCK_REWARDING_MS,
): boolean {
  const ms = Date.parse(signedUpAt ?? "");
  if (Number.isNaN(ms)) return true;
  return now.getTime() - ms > thresholdMs;
}

/** Gathers the current health picture. Read-only. */
export async function buildHealthReport(now: Date = new Date()): Promise<HealthReport> {
  const successSnap = await db
    .collection("webhooks_debug")
    .where("status", "==", "success")
    .orderBy("startTime", "desc")
    .limit(1)
    .get();

  const lastWebhookAt = successSnap.empty
    ? null
    : ((successSnap.docs[0].data().startTime as string) ?? null);

  const rewardingSnap = await db
    .collection("referral_invites")
    .where("status", "==", "rewarding")
    .get();

  const stuckInvites = rewardingSnap.docs
    .filter((d) => isStuckRewarding(d.data().signedUpAt, now))
    .map((d) => ({
      token: d.id,
      referrerUid: (d.data().referrerUid as string) ?? "unknown",
      since: (d.data().signedUpAt as string) ?? "unknown",
    }));

  return {
    webhookSilent: isWebhookSilent(lastWebhookAt, now),
    hoursSinceLastWebhook: hoursSince(lastWebhookAt, now),
    lastWebhookAt,
    stuckInvites,
  };
}
