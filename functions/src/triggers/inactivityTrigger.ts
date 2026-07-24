import { onSchedule } from "firebase-functions/v2/scheduler";
import { db } from "../lib/firebaseAdmin";
import { sendReactEmail } from "../lib/email";
import * as React from "react";
import { ReengagementEmail } from "../emails/ReengagementEmail";

export const checkInactiveUsers = onSchedule(
  {
    schedule: "0 0 * * *", // Once per day at midnight
    timeZone: "Australia/Sydney", // Sydney timezone matches existing setup
    secrets: ["RESEND_API_KEY"],
  },
  async (event) => {
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const thirtyDaysAgoIso = thirtyDaysAgo.toISOString();

      console.log(`Running checkInactiveUsers scheduled cron... Looking for users inactive since ${thirtyDaysAgoIso}`);

      // Query users whose last active stamp was before 30 days ago
      // and who haven't been nudged in the last 30 days (prevents spamming them daily)
      const inactiveUsersSnapshot = await db
        .collection("users")
        .where("lastActive", "<", thirtyDaysAgoIso)
        .limit(100) // Batch limit to respect execution time caps
        .get();

      if (inactiveUsersSnapshot.empty) {
        console.log("No inactive users found.");
        return;
      }

      console.log(`Found ${inactiveUsersSnapshot.size} inactive users to re-engage.`);

      const emailPromises = inactiveUsersSnapshot.docs.map(async (doc) => {
        const userData = doc.data();
        const email = userData.email || doc.id;
        const name = userData.name || "there";

        // Validate email
        if (!email || !email.includes("@")) {
          console.log(`Skipping invalid email for inactive user doc ${doc.id}`);
          return;
        }

        // Re-engagement is marketing mail, so honour the same opt-out that
        // gates the newsletter.
        if (userData.notificationPreferences?.weeklyDigest === false) {
          console.log(`Skipping user ${email} - opted out of marketing email.`);
          return;
        }

        // Never nudge a suspended account.
        if (userData.suspended === true) {
          console.log(`Skipping suspended user ${email}.`);
          return;
        }

        // Check if already nudged in the last 30 days to protect user experience
        if (userData.lastNudgedAt) {
          const lastNudgeDate = new Date(userData.lastNudgedAt);
          const thirtyDaysAgoNudgeCheck = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
          if (lastNudgeDate > thirtyDaysAgoNudgeCheck) {
            console.log(`Skipping user ${email} - already received re-engagement nudge in last 30 days.`);
            return;
          }
        }

        const component = React.createElement(ReengagementEmail, { name, email, uid: doc.id });
        
        // Update user document first to mark nudge timestamp (prevents race conditions / double sends)
        await doc.ref.update({
          lastNudgedAt: new Date().toISOString(),
        });

        // Send email via Resend React helper
        return sendReactEmail({
          to: email,
          subject: "Stay ahead of your pipeline with Dealecho",
          component,
        });
      });

      await Promise.all(emailPromises);
      console.log(`Dispatched inactivity re-engagement emails to active batch.`);
    } catch (err) {
      console.error("Failed to execute inactivity scheduled trigger:", err);
    }
  }
);
