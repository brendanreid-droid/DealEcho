import { onCall, HttpsError } from "firebase-functions/v2/https";
import { auth, db } from "./lib/firebaseAdmin";
import { sendReactEmail } from "./lib/email";
import * as React from "react";
import { ResetPasswordEmail } from "./emails/ResetPasswordEmail";

/**
 * Generates a secure, standard Firebase password reset link and dispatches
 * a highly branded, high-deliverability recovery email from DealEcho via Resend.
 * Secure against account harvesting (email enumeration).
 */
export const sendCustomPasswordResetEmail = onCall(
  { cors: true, secrets: ["RESEND_API_KEY"] },
  async (request) => {
    const { email } = request.data as { email: string };

    if (!email) {
      throw new HttpsError(
        "invalid-argument",
        "Email address is required."
      );
    }

    const emailTrimmed = email.trim().toLowerCase();

    try {
      // 1. Retrieve the user from Firebase Auth
      let userRecord;
      try {
        userRecord = await auth.getUserByEmail(emailTrimmed);
      } catch (err: any) {
        if (err.code === "auth/user-not-found") {
          console.warn(`⚠️ Warning: Custom password reset requested for non-existent email: ${emailTrimmed}. Skipping email sending for anti-harvesting security.`);
          // Return success to client for security (prevents user enumeration)
          return { success: true };
        }
        throw err;
      }

      // 2. Fetch the user's display name from Firestore if it exists
      let displayName = userRecord.displayName || "there";
      try {
        const userDoc = await db.collection("users").doc(userRecord.uid).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          if (userData?.displayName) {
            displayName = userData.displayName;
          }
        }
      } catch (firestoreErr) {
        console.warn(`⚠️ Non-fatal: Failed to fetch display name from Firestore for ${emailTrimmed}:`, firestoreErr);
      }

      // 3. Generate a secure, standard Firebase password reset link
      const actionCodeSettings = {
        url: process.env.FRONTEND_URL ?? "https://dealecho.io",
      };
      const resetLink = await auth.generatePasswordResetLink(emailTrimmed, actionCodeSettings);

      // 4. Send the branded ResetPasswordEmail via Resend
      const resetEmailComponent = React.createElement(ResetPasswordEmail, {
        name: displayName,
        email: emailTrimmed,
        resetLink,
      });

      console.log(`Dispatched custom reset link generation for ${emailTrimmed}. Sending branded email via Resend...`);

      await sendReactEmail({
        to: emailTrimmed,
        subject: "Reset your Dealecho password",
        component: resetEmailComponent,
      });

      return { success: true };
    } catch (err: any) {
      console.error(`❌ Error in sendCustomPasswordResetEmail for ${emailTrimmed}:`, err);
      throw new HttpsError("internal", err.message || "Failed to process password reset request.");
    }
  }
);
