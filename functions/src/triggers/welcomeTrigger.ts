import * as functions from "firebase-functions/v1";
import { sendReactEmail } from "../lib/email";
import * as React from "react";
import { WelcomeEmail } from "../emails/WelcomeEmail";

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
