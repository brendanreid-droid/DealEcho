/**
 * Pure selection logic for the automated lifecycle emails. No Firestore, no
 * Resend, no clock of its own - every function takes `now` explicitly so the
 * rules can be unit tested without mocking the world.
 */

/** A registered user flattened from Firebase Auth + their Firestore profile. */
export interface Recipient {
  uid: string;
  email: string;
  /** Display name, already defaulted to "there" when unknown. */
  name: string;
  /** ISO timestamp from Firebase Auth `metadata.creationTime`. */
  createdAt: string;
  /** ISO timestamp from `behavior.lastActiveAt`, or "" when never active. */
  lastActiveAt: string;
  suspended: boolean;
  /** `notificationPreferences.weeklyDigest === false`. */
  optedOutOfMarketing: boolean;
  /** ISO timestamp, or "" when the day-2 nudge has not been sent. */
  signupNudgeSentAt: string;
  /** Month key ("2026-09") of the last monthly prompt, or "". */
  monthlyPromptSentAt: string;
  /** ISO timestamp of the last 30-day re-engagement nudge, or "". */
  lastNudgedAt: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Account must be at least this old before the signup nudge fires. */
export const SIGNUP_NUDGE_MIN_AGE_DAYS = 2;
/**
 * Upper bound on the nudge window. Without it, the first deployment would mail
 * every dormant account ever created; with it, a cron run that fails still gets
 * a second chance the following day.
 */
export const SIGNUP_NUDGE_MAX_AGE_DAYS = 7;

function time(iso: string): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : t;
}

/**
 * Both of these emails are bulk marketing, so both respect the same opt-out
 * that gates the newsletter. Suspended accounts never receive marketing.
 */
export function isMarketable(r: Recipient): boolean {
  if (!r.email || !r.email.includes("@")) return false;
  if (r.suspended) return false;
  if (r.optedOutOfMarketing) return false;
  return true;
}

/**
 * True when the account has recorded no app activity since it was created.
 * An unparseable or missing `lastActiveAt` counts as no activity: the user doc
 * has no `behavior` map at all until the first search or profile view.
 */
export function hasNoActivitySinceSignup(r: Recipient): boolean {
  const active = time(r.lastActiveAt);
  if (active === null) return true;
  const created = time(r.createdAt);
  if (created === null) return false;
  return active <= created;
}

/** Users due the day-2 "you haven't logged a deal yet" nudge. */
export function selectSignupNudgeTargets(
  recipients: Recipient[],
  now: Date,
): Recipient[] {
  const nowMs = now.getTime();
  return recipients.filter((r) => {
    if (!isMarketable(r)) return false;
    if (r.signupNudgeSentAt) return false;
    const created = time(r.createdAt);
    if (created === null) return false;
    const ageDays = (nowMs - created) / DAY_MS;
    if (ageDays < SIGNUP_NUDGE_MIN_AGE_DAYS) return false;
    if (ageDays > SIGNUP_NUDGE_MAX_AGE_DAYS) return false;
    return hasNoActivitySinceSignup(r);
  });
}

/**
 * "2026-09" in UTC. The monthly cron fires at 09:00 Sydney on the 25th, which
 * is the 24th or 25th in UTC - never a different month - so a UTC key is stable
 * and matches the convention already used for search-stat buckets.
 */
export function monthKey(now: Date): string {
  return now.toISOString().slice(0, 7);
}

/**
 * Which of the three monthly copy variants this month uses. Deterministic on
 * the calendar rather than stored per user: everyone gets the same mail in a
 * given month, the cycle is A/B/C/A/B/C, and there is no extra write per send.
 */
export function pickMonthlyVariant(now: Date, variantCount = 3): number {
  const index = now.getUTCFullYear() * 12 + now.getUTCMonth();
  return index % variantCount;
}

/**
 * Accounts younger than this are left out of the monthly prompt. They have just
 * had a welcome email and are inside the day-2 nudge window, and both crons run
 * at 09:00 Sydney - so without a floor, a user who signed up on the 23rd would
 * receive two prompts in the same morning. They are picked up next month.
 */
export const MONTHLY_PROMPT_MIN_ACCOUNT_AGE_DAYS = 8;

/**
 * Every registered user - free, paid, admin - who has not already had this
 * month's prompt and is not brand new.
 */
export function selectMonthlyPromptTargets(
  recipients: Recipient[],
  key: string,
  now: Date,
): Recipient[] {
  const nowMs = now.getTime();
  return recipients.filter((r) => {
    if (!isMarketable(r)) return false;
    if (r.monthlyPromptSentAt === key) return false;
    const created = time(r.createdAt);
    if (created !== null) {
      const ageDays = (nowMs - created) / DAY_MS;
      if (ageDays < MONTHLY_PROMPT_MIN_ACCOUNT_AGE_DAYS) return false;
    }
    return true;
  });
}

/** First name for salutations, safe on empty and multi-word names. */
export function firstName(name: string): string {
  return (name || "there").trim().split(/\s+/)[0] || "there";
}

/** An account is considered dormant this long before the re-engagement nudge. */
export const REENGAGEMENT_INACTIVE_DAYS = 30;
/** And is not nudged again for at least this long afterwards. */
export const REENGAGEMENT_COOLDOWN_DAYS = 30;

/**
 * Users due the 30-day re-engagement nudge.
 *
 * Selection is in memory for the same reason as the signup nudge: the previous
 * implementation queried `lastActive`, a field nothing in the codebase writes,
 * so the cron matched nobody. The real field is `behavior.lastActiveAt`, and it
 * is absent entirely on accounts that never did anything - which Firestore
 * cannot express as a query. An account that has never been active falls back
 * to its signup date.
 */
export function selectReengagementTargets(
  recipients: Recipient[],
  now: Date,
): Recipient[] {
  const nowMs = now.getTime();
  return recipients.filter((r) => {
    if (!isMarketable(r)) return false;

    const lastSeen = time(r.lastActiveAt) ?? time(r.createdAt);
    if (lastSeen === null) return false;
    if ((nowMs - lastSeen) / DAY_MS < REENGAGEMENT_INACTIVE_DAYS) return false;

    const nudged = time(r.lastNudgedAt);
    if (nudged !== null && (nowMs - nudged) / DAY_MS < REENGAGEMENT_COOLDOWN_DAYS) {
      return false;
    }
    return true;
  });
}
