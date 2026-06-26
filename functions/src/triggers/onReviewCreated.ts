import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { db, auth } from "../lib/firebaseAdmin";
import { sendReactEmail } from "../lib/email";
import * as React from "react";
import { TrackedAlertEmail } from "../emails/TrackedAlertEmail";
import { DEFAULT_NOTIFICATION_EMAIL } from "../lib/constants";

// Fires as soon as a review document is created, regardless of moderation status.
export const onReviewCreated = onDocumentCreated(
  {
    document: "reviews/{reviewId}",
    secrets: ["RESEND_API_KEY"],
  },
  async (event) => {
    const afterData = event.data?.data();
    if (!afterData) return;

    const companyId = afterData.companyId;
    const companyName = afterData.companyName;
    if (!companyId || !companyName) {
      console.log("Missing company metadata in newly created review. Skipping alert.");
      return;
    }

    console.log(`New review created for ${companyName} (${companyId}). Looking up subscribers…`);

    try {
      const usersSnapshot = await db
        .collection("users")
        .where("trackedCompanies", "array-contains", companyId)
        .get();

      if (usersSnapshot.empty) {
        console.log(`No users tracking ${companyName}. No email sent.`);
        return;
      }

      const metrics = {
        resp: Number(afterData.communicationRating) || 3,
        negot: Number(afterData.negotiationLevel) || 3,
        intent: Number(afterData.timeWasterLevel) || 3,
        scope: Number(afterData.clarityOfScope) || 3,
      };

      const reviewSummary = afterData.content || "No description provided.";

      const sendPromises = usersSnapshot.docs.map(async (doc) => {
        const userData = doc.data();
        
        // Check if user has explicitly opted out of real-time alerts
        const prefs = userData.notificationPreferences;
        if (prefs && prefs.realTimeAlerts === false) {
          console.log(`Skipping user ${doc.id} – opted out of real-time email alerts.`);
          return;
        }

        // Try to get email from Firestore user doc (email or identifier field)
        let email = userData.email ?? userData.identifier;
        let name = userData.name || "there";

        // If still missing or malformed, fall back to Firebase Auth
        if (!email || !email.includes("@")) {
          try {
            const userRecord = await auth.getUser(doc.id);
            email = userRecord.email ?? email;
            name = userRecord.displayName || name;

            // If still invalid, use the default notification email
            if (!email || !email.includes("@")) {
              console.warn(`User ${doc.id} missing email in Auth; using fallback ${DEFAULT_NOTIFICATION_EMAIL}`);
              email = DEFAULT_NOTIFICATION_EMAIL;
            }

            // Update Firestore with any discovered email/name
            const updates: any = {};
            if (userRecord.email) updates.email = userRecord.email;
            if (userRecord.displayName) updates.name = userRecord.displayName;
            if (Object.keys(updates).length) {
              await db.collection('users').doc(doc.id).set(updates, { merge: true });
            }
          } catch (e) {
            console.warn(`Unable to fetch Auth for ${doc.id}: ${e}`);
            email = DEFAULT_NOTIFICATION_EMAIL;
          }
        }

        // Final sanity check – if still invalid, skip sending
        if (!email || !email.includes("@")) {
          console.log(`Skipping user ${doc.id} – email still invalid after all fallbacks`);
          return;
        }
        const component = React.createElement(TrackedAlertEmail, {
          name,
          email,
          userUid: doc.id,
          companyName,
          companyId,
          reviewSummary,
          metrics,
        });
        return sendReactEmail({
          to: email,
          subject: `🔔 dealecho Alert: New Review for ${companyName}`,
          component,
        });
      });

      await Promise.all(sendPromises);
      console.log(`Dispatched review‑created alerts to ${usersSnapshot.size} users.`);
    } catch (err) {
      console.error("Error in onReviewCreated trigger:", err);
    }
  }
);
