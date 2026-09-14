import * as React from "react";
import { sendReactEmail } from "./email";
import { markSent } from "./recipients";
import type { Recipient } from "./lifecycle";

/**
 * Resend accepts roughly ten requests a second, so a batch of ten followed by a
 * one second pause paces the send at the limit without a token bucket.
 */
const BATCH_SIZE = 10;
const BATCH_PAUSE_MS = 1000;

/**
 * Upper bound on what one run can deliver, derived from the 540s function
 * timeout at the pacing above, with headroom for the Firestore reads at the
 * start. Every caller is idempotent, so an over-large audience simply finishes
 * on the following run rather than being lost.
 */
export const MAX_PER_RUN = 4000;

export type SentMarker = "signupNudgeSentAt" | "monthlyPromptSentAt" | "lastNudgedAt";

interface DispatchOptions {
  /** Function name, for logs. */
  label: string;
  targets: Recipient[];
  /** User-doc field stamped before each send to make the run idempotent. */
  markField: SentMarker;
  /** Value for that field. A month key for monthly mail, otherwise a timestamp. */
  markValue: () => string;
  subject: string;
  component: (r: Recipient) => React.ReactElement;
}

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

/**
 * Shared send loop for the lifecycle crons.
 *
 * The sent-marker is written BEFORE the mail goes out. A crash between the two
 * costs one person one email; the reverse order risks mailing the entire
 * register twice, which is the failure that gets a sending domain blocked.
 * A per-recipient failure is logged and skipped rather than aborting the run.
 */
export async function dispatchLifecycleEmails({
  label,
  targets,
  markField,
  markValue,
  subject,
  component,
}: DispatchOptions): Promise<number> {
  let sent = 0;

  for (let i = 0; i < targets.length; i += BATCH_SIZE) {
    const batch = targets.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (r) => {
        try {
          await markSent(r.uid, markField, markValue());
          await sendReactEmail({
            to: r.email,
            subject,
            component: component(r),
            // Bulk marketing: one-click unsubscribe is mandatory for Gmail and
            // Yahoo bulk senders, and its absence damages the reputation of
            // every message the domain sends, transactional included.
            unsubscribe: { email: r.email, uid: r.uid },
          });
          sent += 1;
        } catch (err) {
          console.error(`${label}: failed for ${r.uid}:`, err);
        }
      }),
    );
    if (i + BATCH_SIZE < targets.length) await sleep(BATCH_PAUSE_MS);
  }

  return sent;
}
