import { onSchedule } from "firebase-functions/v2/scheduler";
import * as React from "react";
import { loadRecipients } from "../lib/recipients";
import {
  monthKey,
  pickMonthlyVariant,
  selectMonthlyPromptTargets,
} from "../lib/lifecycle";
import {
  dispatchLifecycleEmails,
  MAX_PER_RUN,
} from "../lib/lifecycleDispatch";
import {
  MonthlyReviewPromptEmail,
  MONTHLY_VARIANTS,
} from "../emails/MonthlyReviewPromptEmail";

/**
 * End-of-month prompt to every registered user, free, paid and admin alike,
 * asking them to review the deals they worked that month.
 *
 * The 25th is deliberate: it reads as month-end, it exists in February, and it
 * lands before the final-week scramble when nobody reads mail that is not a
 * purchase order.
 *
 * Copy rotates across three variants keyed off the calendar month, so the same
 * message never arrives twice running.
 */
export const sendMonthlyReviewPrompt = onSchedule(
  {
    schedule: "0 9 25 * *",
    timeZone: "Australia/Sydney",
    timeoutSeconds: 540,
    secrets: ["RESEND_API_KEY"],
  },
  async () => {
    try {
      const now = new Date();
      const key = monthKey(now);
      const variant = pickMonthlyVariant(now, MONTHLY_VARIANTS.length);

      const recipients = await loadRecipients();
      const all = selectMonthlyPromptTargets(recipients, key, now);
      const targets = all.slice(0, MAX_PER_RUN);

      if (targets.length === 0) {
        console.log(`sendMonthlyReviewPrompt: nothing to send for ${key}.`);
        return;
      }
      if (all.length > targets.length) {
        console.warn(
          `sendMonthlyReviewPrompt: ${all.length - targets.length} users deferred past this run's cap.`,
        );
      }

      console.log(
        `sendMonthlyReviewPrompt: ${key}, variant ${variant}, ${targets.length} of ${recipients.length} registered users.`,
      );

      const sent = await dispatchLifecycleEmails({
        label: "sendMonthlyReviewPrompt",
        targets,
        markField: "monthlyPromptSentAt",
        markValue: () => key,
        subject: MONTHLY_VARIANTS[variant].subject,
        component: (r) =>
          React.createElement(MonthlyReviewPromptEmail, {
            name: r.name,
            email: r.email,
            uid: r.uid,
            variant,
          }),
      });

      console.log(
        `sendMonthlyReviewPrompt: dispatched ${sent}/${targets.length} for ${key}.`,
      );
    } catch (err) {
      console.error("sendMonthlyReviewPrompt: run failed:", err);
    }
  },
);
