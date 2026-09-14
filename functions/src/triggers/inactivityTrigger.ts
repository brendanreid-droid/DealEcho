import { onSchedule } from "firebase-functions/v2/scheduler";
import * as React from "react";
import { loadRecipients } from "../lib/recipients";
import { selectReengagementTargets } from "../lib/lifecycle";
import { dispatchLifecycleEmails } from "../lib/lifecycleDispatch";
import { ReengagementEmail } from "../emails/ReengagementEmail";

/** Cap on one run, so a backlog drains over several days instead of at once. */
const MAX_PER_RUN = 200;

/**
 * 30-day re-engagement nudge.
 *
 * Previously this queried `users` for `lastActive < cutoff`. Nothing in the
 * repo writes `lastActive` - the field recordActivity maintains is
 * `behavior.lastActiveAt` - so the query matched nobody and this cron sent zero
 * emails for its entire life. It now shares the recipient loader with the other
 * lifecycle emails, which also reaches dormant accounts carrying no `behavior`
 * map at all, and so unreachable by any Firestore query.
 */
export const checkInactiveUsers = onSchedule(
  {
    schedule: "0 0 * * *",
    timeZone: "Australia/Sydney",
    timeoutSeconds: 540,
    secrets: ["RESEND_API_KEY"],
  },
  async () => {
    try {
      const recipients = await loadRecipients();
      const targets = selectReengagementTargets(recipients, new Date()).slice(
        0,
        MAX_PER_RUN,
      );

      if (targets.length === 0) {
        console.log("checkInactiveUsers: no dormant users to re-engage.");
        return;
      }

      console.log(
        `checkInactiveUsers: re-engaging ${targets.length} of ${recipients.length} registered users.`,
      );

      const sent = await dispatchLifecycleEmails({
        label: "checkInactiveUsers",
        targets,
        markField: "lastNudgedAt",
        markValue: () => new Date().toISOString(),
        subject: "Stay ahead of your pipeline with Dealecho",
        component: (r) =>
          React.createElement(ReengagementEmail, {
            name: r.name,
            email: r.email,
            uid: r.uid,
          }),
      });

      console.log(`checkInactiveUsers: dispatched ${sent}/${targets.length}.`);
    } catch (err) {
      console.error("checkInactiveUsers: run failed:", err);
    }
  },
);
