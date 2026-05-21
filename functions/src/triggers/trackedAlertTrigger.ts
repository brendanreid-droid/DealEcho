import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { db } from "../lib/firebaseAdmin";
import { sendReactEmail } from "../lib/email";
import * as React from "react";
import { TrackedAlertEmail } from "../emails/TrackedAlertEmail";

export const onReviewStatusApproved = onDocumentUpdated(
  {
    document: "reviews/{reviewId}",
    secrets: ["RESEND_API_KEY"], // Request Resend API secret from Secret Manager
  },
  async (event) => {
    const change = event.data;
    if (!change) return;

    const beforeData = change.before.data();
    const afterData = change.after.data();

    // Trigger only when moderationStatus is newly updated to "approved"
    if (beforeData.moderationStatus !== "approved" && afterData.moderationStatus === "approved") {
      const companyId = afterData.companyId;
      const companyName = afterData.companyName;

      if (!companyId || !companyName) {
        console.log("Missing company metadata in review document. Skipping alerts.");
        return;
      }

      console.log(`Verified report approved for tracked account: ${companyName} (${companyId}). Querying users...`);

      // 1. Query all user documents tracking this specific company ID
      try {
        const usersSnapshot = await db
          .collection("users")
          .where("trackedCompanies", "array-contains", companyId)
          .get();

        if (usersSnapshot.empty) {
          console.log(`No users are tracking company ${companyName} (${companyId}). Skipping alerts.`);
          return;
        }

        // Set up the metrics block
        const metrics = {
          resp: Number(afterData.communicationRating) || 3,
          negot: Number(afterData.negotiationLevel) || 3,
          intent: Number(afterData.timeWasterLevel) || 3,
          scope: Number(afterData.clarityOfScope) || 3,
        };

        const reviewSummary = afterData.content || "No text description provided by buyer.";

        console.log(`Dispatching real-time email alerts to ${usersSnapshot.size} users for ${companyName}`);

        // 2. Loop and send personalized emails
        const sendPromises = usersSnapshot.docs.map(async (doc) => {
          const userData = doc.data();
          const email = userData.email || doc.id; // Fallback to doc ID if no email field, though email is expected
          const name = userData.name || "there";

          // Validate email
          if (!email || !email.includes("@")) {
            console.log(`Skipping invalid email for user doc ${doc.id}`);
            return;
          }

          const alertComponent = React.createElement(TrackedAlertEmail, {
            name,
            email,
            companyName,
            companyId,
            reviewSummary,
            metrics,
          });

          return sendReactEmail({
            to: email,
            subject: `🔔 DealEcho Alert: New Vetted Buyer Activity on ${companyName}`,
            component: alertComponent,
          });
        });

        await Promise.all(sendPromises);
        console.log(`Successfully dispatched tracked company email alerts to ${usersSnapshot.size} users.`);
      } catch (err) {
        console.error("Failed to execute tracked company alerts trigger:", err);
      }
    }
  }
);
