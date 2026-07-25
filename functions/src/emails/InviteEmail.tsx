import * as React from "react";
import { Text, Heading, Button, Section } from "@react-email/components";
import { DealEchoEmailLayout } from "./Layout";

interface InviteEmailProps {
  name: string;
  email: string;
  role: string;
  setupLink: string;
}

export const InviteEmail: React.FC<InviteEmailProps> = ({ name, email, role, setupLink }) => {
  const firstName = name ? name.split(" ")[0] : "there";
  
  const roleLabels: Record<string, string> = {
    free: "Free (Pioneer Plan)",
    paid: "Sales Pro Member (Paid)",
    admin: "Dealecho Administrator",
    free_full: "Free Full (Complimentary Full Access)",
    enterprise: "Enterprise Team Manager",
  };
  const roleLabel = roleLabels[role] || role;

  return (
    <DealEchoEmailLayout
      previewTextText="You have been invited to join Dealecho. Activate your account now."
      userEmail={email}
      transactional
    >
      <Heading style={h1}>Welcome to Dealecho, {firstName}!</Heading>

      <Text style={paragraph}>
        An administrator has set up a <strong>Dealecho</strong> account for you. Dealecho equips sales executives with a platform that holds buying teams accountable and adds a layer of intelligence to their pipeline.
      </Text>

      <Text style={paragraph}>
        Your account is already set to this membership level:
      </Text>

      <Section style={roleContainer}>
        <Text style={roleText}>
          Membership: <span style={roleHighlight}>{roleLabel}</span>
        </Text>
      </Section>

      <Text style={paragraph}>
        To finalise your setup and choose a password, activate your account below:
      </Text>

      <Section style={ctaContainer}>
        <Button href={setupLink} style={primaryButton}>
          Activate Account & Set Password
        </Button>
      </Section>

      <Text style={subtext}>
        For your security, this activation link will expire.
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

const roleContainer = {
  backgroundColor: "#f8fafc",
  border: "1px solid #f1f5f9",
  borderRadius: "16px",
  padding: "20px",
  margin: "24px 0",
};

const roleText = {
  color: "#334155",
  fontSize: "14px",
  fontWeight: "600",
  margin: "0",
};

const roleHighlight = {
  color: "#4f46e5",
  fontWeight: "800",
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

const subtext = {
  color: "#64748b",
  fontSize: "12px",
  lineHeight: "1.6",
  margin: "24px 0 0 0",
};

const signoff = {
  color: "#334155",
  fontSize: "14px",
  lineHeight: "1.6",
  marginTop: "32px",
};
