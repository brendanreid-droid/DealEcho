import { onCall, HttpsError, CallableRequest } from "firebase-functions/v2/https";
import * as React from "react";
import { sendReactEmail } from "../lib/email";
import {
  FirstReviewNudgeEmail,
  FIRST_REVIEW_NUDGE_SUBJECT,
} from "../emails/FirstReviewNudgeEmail";
import {
  MonthlyReviewPromptEmail,
  MONTHLY_VARIANTS,
} from "../emails/MonthlyReviewPromptEmail";
import { ReengagementEmail } from "../emails/ReengagementEmail";

function requireAdmin(request: CallableRequest<any>) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be signed in.");
  }
  if ((request.auth.token as any).role !== "admin") {
    throw new HttpsError("permission-denied", "Admin access required.");
  }
}

type Template = "signupNudge" | "monthlyReviewPrompt" | "reengagement";

/**
 * Sends one lifecycle email to a test address so any variant can be inspected
 * on demand. Without this, variant 2 of the monthly prompt is only observable
 * in whichever month the rotation happens to select it.
 *
 * Admin only.
 *
 * Subject and headers are IDENTICAL to the real send. Previews used to carry a
 * "[TEST]" subject prefix, which meant every preview measured the
 * deliverability of a message no recipient ever receives - useless as a test
 * instrument, which is exactly what these get used for. (The prefix itself
 * scored nothing on SpamAssassin when checked 2026-09-14; it was removed for
 * fidelity, not for filter points.) A preview is marked by a banner inside the
 * body instead.
 */
export const adminPreviewLifecycleEmail = onCall(
  { cors: true, secrets: ["RESEND_API_KEY"] },
  async (request) => {
    requireAdmin(request);

    const template = request.data?.template as Template;
    const rawVariant = request.data?.variant;
    const testEmail =
      (request.data?.testEmail as string) || request.auth!.token.email || "";

    if (!testEmail || !testEmail.includes("@")) {
      throw new HttpsError(
        "invalid-argument",
        "A testEmail is required (or the caller must have an email on their token).",
      );
    }

    const name = (request.auth!.token.name as string) || "there";
    const email = testEmail;
    const uid = request.auth!.uid;

    if (template === "signupNudge") {
      await sendReactEmail({
        to: testEmail,
        subject: FIRST_REVIEW_NUDGE_SUBJECT,
        component: React.createElement(FirstReviewNudgeEmail, {
          name,
          email,
          uid,
          previewBanner: true,
        }),
        unsubscribe: { email, uid },
      });
      return { success: true, template, sentTo: testEmail };
    }

    if (template === "monthlyReviewPrompt") {
      const variant = Number.isInteger(rawVariant) ? (rawVariant as number) : 0;
      if (variant < 0 || variant >= MONTHLY_VARIANTS.length) {
        throw new HttpsError(
          "invalid-argument",
          `variant must be 0..${MONTHLY_VARIANTS.length - 1}.`,
        );
      }
      await sendReactEmail({
        to: testEmail,
        subject: MONTHLY_VARIANTS[variant].subject,
        component: React.createElement(MonthlyReviewPromptEmail, {
          name,
          email,
          uid,
          variant,
          previewBanner: true,
        }),
        unsubscribe: { email, uid },
      });
      return { success: true, template, variant, sentTo: testEmail };
    }

    if (template === "reengagement") {
      await sendReactEmail({
        to: testEmail,
        subject: "Stay ahead of your pipeline with Dealecho",
        component: React.createElement(ReengagementEmail, {
          name,
          email,
          uid,
          previewBanner: true,
        }),
        unsubscribe: { email, uid },
      });
      return { success: true, template, sentTo: testEmail };
    }

    throw new HttpsError(
      "invalid-argument",
      "template must be one of: signupNudge, monthlyReviewPrompt, reengagement.",
    );
  },
);
