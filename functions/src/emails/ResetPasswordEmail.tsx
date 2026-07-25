import * as React from "react";
import { Text, Heading, Button, Section } from "@react-email/components";
import { DealEchoEmailLayout } from "./Layout";

interface ResetPasswordEmailProps {
  name: string;
  email: string;
  resetLink: string;
}

export const ResetPasswordEmail: React.FC<ResetPasswordEmailProps> = ({ name, email, resetLink }) => {
  const firstName = name ? name.split(" ")[0] : "there";

  return (
    <DealEchoEmailLayout
      previewTextText="Reset your Dealecho password. Choose a new secure password."
      userEmail={email}
      transactional
      /* Security email. Nothing competes with the reset itself. */
      showExtension={false}
    >
      <Heading style={h1}>Reset your password</Heading>
      
      <Text style={paragraph}>
        Hello {firstName},
      </Text>

      <Text style={paragraph}>
        We received a request to reset the password on your <strong>Dealecho</strong> account.
        If that was you, choose a new password below:
      </Text>

      <Section style={ctaContainer}>
        <Button href={resetLink} style={primaryButton}>
          Reset Password
        </Button>
      </Section>

      <Text style={paragraph}>
        For your security, this link expires in 1 hour.
        If you did not request a password reset, you can safely ignore this email and your password will stay the same.
      </Text>

      <Text style={signoff}>
        Good selling,<br />
        <strong>The Dealecho Team</strong>
      </Text>
    </DealEchoEmailLayout>
  );
};

const h1 = {
  color: "#0f172a",
  fontSize: "26px",
  fontWeight: "800",
  letterSpacing: "-0.02em",
  margin: "0 0 24px 0",
};

const paragraph = {
  color: "#334155",
  fontSize: "15px",
  lineHeight: "1.6",
  margin: "0 0 20px 0",
};

const ctaContainer = {
  textAlign: "center" as const,
  margin: "32px 0 24px 0",
};

const primaryButton = {
  backgroundColor: "#4f46e5",
  borderRadius: "14px",
  color: "#ffffff",
  fontSize: "14px",
  fontWeight: "800",
  textDecoration: "none",
  textAlign: "center" as const,
  display: "inline-block",
  padding: "16px 32px",
};

const signoff = {
  color: "#334155",
  fontSize: "14px",
  lineHeight: "1.6",
  marginTop: "32px",
};
