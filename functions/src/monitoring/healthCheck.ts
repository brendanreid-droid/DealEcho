import { onSchedule } from "firebase-functions/v2/scheduler";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as React from "react";
import { db } from "../lib/firebaseAdmin";
import { sendReactEmail } from "../lib/email";
import { HealthAlertEmail } from "../emails/HealthAlertEmail";
import { DEFAULT_NOTIFICATION_EMAIL } from "../lib/constants";
import { buildHealthReport } from "./health";

/** Where alerts go. Overridable without a deploy via config/alerts.email. */
async function alertRecipient(): Promise<string> {
  const snap = await db.collection("config").doc("alerts").get();
  const configured = snap.data()?.email;
  return typeof configured === "string" && configured.includes("@")
    ? configured
    : DEFAULT_NOTIFICATION_EMAIL;
}

/**
 * Daily health check.
 *
 * Exists because a deleted Stripe webhook endpoint took live billing down for
 * two months in 2026 with no alert of any kind. Payments kept succeeding in
 * Stripe the whole time; the only symptom was a Firestore collection that
 * quietly stopped growing. This is the cheapest thing that would have caught
 * it on day one.
 *
 * Deliberately silent when healthy - an alert that arrives every day is an
 * alert nobody reads.
 */
export const runHealthCheck = onSchedule(
  {
    schedule: "0 9 * * *", // 9am Sydney, daily
    timeZone: "Australia/Sydney",
    secrets: ["RESEND_API_KEY"],
  },
  async () => {
    const report = await buildHealthReport();
    const problems = report.webhookSilent || report.stuckInvites.length > 0;

    // Always record the result so there is a trail even on healthy days.
    await db.collection("health_checks").add({
      ranAt: new Date().toISOString(),
      ...report,
    });

    if (!problems) {
      console.log("Health check passed:", JSON.stringify(report));
      return;
    }

    console.error("Health check FAILED:", JSON.stringify(report));

    const to = await alertRecipient();
    try {
      await sendReactEmail({
        to,
        subject: report.webhookSilent
          ? "Dealecho ALERT: Stripe webhook has gone quiet"
          : "Dealecho ALERT: referral payouts stuck",
        component: React.createElement(HealthAlertEmail, {
          recipientEmail: to,
          ...report,
        }),
      });
    } catch (err) {
      console.error("Health alert email failed:", (err as Error).message);
    }
  },
);

/** Admin-only on-demand run of the same check, for verifying it works. */
export const adminGetHealthReport = onCall({ cors: true }, async (request) => {
  if ((request.auth?.token as any)?.role !== "admin") {
    throw new HttpsError("permission-denied", "Admins only.");
  }
  return await buildHealthReport();
});
