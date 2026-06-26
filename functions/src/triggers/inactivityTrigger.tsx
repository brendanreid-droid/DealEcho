import { onSchedule } from "firebase-functions/v2/scheduler";
import { db } from "../lib/firebaseAdmin";
import { sendReactEmail } from "../lib/email";
import * as React from "react";
import { DealEchoEmailLayout } from "../emails/Layout";
import { Text, Heading, Button, Section } from "@react-email/components";

// React Email template defined inside the file to keep things modular and simple
const ReengagementEmail: React.FC<{ name: string; email: string }> = ({ name, email }) => (
  <DealEchoEmailLayout previewTextText="Stay ahead of your pipeline with B2B buyer intelligence." userEmail={email}>
    <Heading style={{ color: "#0f172a", fontSize: "24px", fontWeight: "850", margin: "0 0 16px 0" }}>
      We miss you, {name.split(" ")[0]}!
    </Heading>
    <Text style={{ color: "#334155", fontSize: "14px", lineHeight: "1.6", margin: "0 0 20px 0" }}>
      It's been a while since your last log in on **dealecho.io**. Since you left, our sales intelligence network has added fresh verified buy-side ratings, pricing structures, and stakeholder patterns on key enterprise accounts.
    </Text>
    <Text style={{ color: "#334155", fontSize: "14px", lineHeight: "1.6", margin: "0 0 24px 0" }}>
      Stay ahead of your pipeline. Access the latest buyer intelligence and adjust your closing strategies.
    </Text>
    <Section style={{ textAlign: "center", margin: "32px 0" }}>
      <Button href="https://dealecho.io" style={{ backgroundColor: "#4f46e5", color: "#ffffff", padding: "16px 32px", borderRadius: "14px", fontWeight: "800", textDecoration: "none", display: "inline-block" }}>
        Re-explore Live Intel
      </Button>
    </Section>
  </DealEchoEmailLayout>
);

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

        // Check if already nudged in the last 30 days to protect user experience
        if (userData.lastNudgedAt) {
          const lastNudgeDate = new Date(userData.lastNudgedAt);
          const thirtyDaysAgoNudgeCheck = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
          if (lastNudgeDate > thirtyDaysAgoNudgeCheck) {
            console.log(`Skipping user ${email} - already received re-engagement nudge in last 30 days.`);
            return;
          }
        }

        const component = React.createElement(ReengagementEmail, { name, email });
        
        // Update user document first to mark nudge timestamp (prevents race conditions / double sends)
        await doc.ref.update({
          lastNudgedAt: new Date().toISOString(),
        });

        // Send email via Resend React helper
        return sendReactEmail({
          to: email,
          subject: "Stay ahead of your pipeline with dealecho.io",
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
