import * as React from "react";
import { Text, Heading, Button, Section } from "@react-email/components";
import { DealEchoEmailLayout } from "./Layout";
import { NEW_REVIEW_URL } from "../lib/constants";
import { firstName } from "../lib/lifecycle";

interface FirstReviewNudgeEmailProps {
  name: string;
  email: string;
  uid?: string;
}

export const FIRST_REVIEW_NUDGE_SUBJECT =
  "Start with one deal from last quarter";

/**
 * Sent once, two days after signup, to accounts that have done nothing since.
 * The ask is deliberately small and backward looking: reviewing a deal that has
 * already happened needs no new work, and last quarter is recent enough that
 * the detail is still recoverable.
 */
export const FirstReviewNudgeEmail: React.FC<FirstReviewNudgeEmailProps> = ({
  name,
  email,
  uid,
}) => (
  <DealEchoEmailLayout
    previewTextText="Two minutes on a deal you already ran."
    userEmail={email}
    userUid={uid}
  >
    <Heading style={h1}>You're in, {firstName(name)}. Now the easy part.</Heading>

    <Text style={paragraph}>
      Your account is live but there's nothing on it yet. The fastest way to get
      value out of Dealecho is to put one deal in, and the easiest place to start
      is last quarter, because it already happened.
    </Text>

    <Text style={paragraph}>Pick any deal from the last three months:</Text>

    <Text style={bullet}>
      <strong style={bulletLabel}>Won.</strong> What the buying process actually
      took, and what it cost you to get there.
    </Text>
    <Text style={bullet}>
      <strong style={bulletLabel}>Lost.</strong> Where it went, who moved the
      goalposts, and what you'd warn the next rep about.
    </Text>
    <Text style={bullet}>
      <strong style={bulletLabel}>Ongoing.</strong> No outcome needed. How the
      account is behaving right now is the intel.
    </Text>

    <Text style={paragraph}>
      Two minutes each. Every review you add sharpens what you get back on the
      accounts you're chasing next.
    </Text>

    <Section style={ctaContainer}>
      <Button href={NEW_REVIEW_URL} style={primaryButton}>
        Review a deal
      </Button>
    </Section>
  </DealEchoEmailLayout>
);

const h1 = { color: "#0f172a", fontSize: "24px", fontWeight: "850", margin: "0 0 16px 0" };
const paragraph = { color: "#334155", fontSize: "14px", lineHeight: "1.6", margin: "0 0 20px 0" };
const bullet = { color: "#334155", fontSize: "14px", lineHeight: "1.6", margin: "0 0 10px 0", paddingLeft: "14px", borderLeft: "3px solid #e2e8f0" };
const bulletLabel = { color: "#0f172a" };
const ctaContainer = { textAlign: "center" as const, margin: "32px 0" };
const primaryButton = {
  backgroundColor: "#4f46e5",
  color: "#ffffff",
  padding: "16px 32px",
  borderRadius: "14px",
  fontWeight: "800",
  textDecoration: "none",
  display: "inline-block",
};
