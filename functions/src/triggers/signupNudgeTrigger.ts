import { onSchedule } from "firebase-functions/v2/scheduler";
import * as React from "react";
import { loadRecipients } from "../lib/recipients";
import { selectSignupNudgeTargets } from "../lib/lifecycle";
import {
  dispatchLifecycleEmails,
  MAX_PER_RUN,
} from "../lib/lifecycleDispatch";
import {
  FirstReviewNudgeEmail,
  FIRST_REVIEW_NUDGE_SUBJECT,
} from "../emails/FirstReviewNudgeEmail";

/**
 * Day-2 activation nudge: one prompt to anyone who signed up and then did
 * nothing, asking them to review a deal from last quarter.
 *
 * Runs daily rather than on a signup timer because "did they do anything in
 * their first two days" can only be answered after the fact. Selection happens
 * in memory (lib/lifecycle) because Firestore cannot query for an absent field,
 * and a dormant account has no `behavior` map at all.
 */
export const sendSignupNudges = onSchedule(
  {
    schedule: "0 9 * * *",
    timeZone: "Australia/Sydney",
    timeoutSeconds: 540,
    secrets: ["RESEND_API_KEY"],
  },
  async () => {
    try {
      const recipients = await loadRecipients();
      const targets = selectSignupNudgeTargets(recipients, new Date()).slice(
        0,
        MAX_PER_RUN,
      );

      if (targets.length === 0) {
        console.log("sendSignupNudges: no dormant new accounts to nudge.");
        return;
      }

      console.log(
        `sendSignupNudges: ${targets.length} dormant new accounts of ${recipients.length} registered.`,
      );

      const sent = await dispatchLifecycleEmails({
        label: "sendSignupNudges",
        targets,
        markField: "signupNudgeSentAt",
        markValue: () => new Date().toISOString(),
        subject: FIRST_REVIEW_NUDGE_SUBJECT,
        component: (r) =>
          React.createElement(FirstReviewNudgeEmail, {
            name: r.name,
            email: r.email,
            uid: r.uid,
          }),
      });

      console.log(`sendSignupNudges: dispatched ${sent}/${targets.length}.`);
    } catch (err) {
      console.error("sendSignupNudges: run failed:", err);
    }
  },
);
