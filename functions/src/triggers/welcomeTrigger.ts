import * as functions from "firebase-functions/v1";
import { sendReactEmail } from "../lib/email";
import * as React from "react";
import { WelcomeEmail } from "../emails/WelcomeEmail";
import { db } from "../lib/firebaseAdmin";

export const sendWelcomeEmail = functions
  .region("australia-southeast1")
  .runWith({
    secrets: ["RESEND_API_KEY"], // Load secret key securely from Google Secret Manager
  })
  .auth.user()
  .onCreate(async (user: any) => {
    const email = user.email;
    const name = user.displayName || "there";

    if (!email) {
      console.log("No email address found for the new user. Skipping welcome email.");
      return;
    }

    // Check if the user was manually created/invited by an admin
    try {
      const emailLower = email.trim().toLowerCase();
      const trackingDoc = await db.collection("admin_created_users").doc(emailLower).get();
      if (trackingDoc.exists) {
        console.log(`Skipping automated welcome email for manually created admin user: ${emailLower}`);
        // Clean up tracking document immediately to prevent orphaned docs
        await trackingDoc.ref.delete();
        return;
      }
    } catch (dbErr) {
      console.error("Non-fatal: Failed to check admin_created_users collection:", dbErr);
    }

    console.log(`Processing welcome email for new user: ${email} (${name})`);

    const welcomeComponent = React.createElement(WelcomeEmail, {
      name,
      email,
    });

    try {
      await sendReactEmail({
        to: email,
        subject: "Welcome to DealEcho.io - Let's optimize your sales intelligence",
        component: welcomeComponent,
      });
    } catch (err) {
      console.error("Failed to execute welcome email trigger:", err);
    }
  });
