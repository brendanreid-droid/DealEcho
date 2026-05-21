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
    admin: "DealEcho Administrator",
    free_full: "Free Full (Complimentary Full Access)",
  };
  const roleLabel = roleLabels[role] || role;

  return (
    <DealEchoEmailLayout 
      previewTextText="You have been invited to join DealEcho.io. Activate your account now."
      userEmail={email}
    >
      <Heading style={h1}>Welcome to DealEcho, {firstName}!</Heading>
      
      <Text style={paragraph}>
        An administrator has manually created an account for you on **DealEcho.io**—the premier crowdsourced intelligence layer for enterprise B2B sales cycles.
      </Text>

      <Text style={paragraph}>
        Your account has been pre-configured with the following membership level:
      </Text>

      <Section style={roleContainer}>
        <Text style={roleText}>
          Membership Type: <span style={roleHighlight}>{roleLabel}</span>
        </Text>
      </Section>

      <Text style={paragraph}>
        To finalize your setup and choose your secure password, please click the account activation button below:
      </Text>

      <Section style={ctaContainer}>
        <Button href={setupLink} style={primaryButton}>
          Activate Account & Set Password
        </Button>
      </Section>

      <Text style={subtext}>
        For security, this link will expire. If the button above does not work, please copy and paste the following URL into your browser address bar:
        <br />
        <span style={linkText}>{setupLink}</span>
      </Text>

      <Text style={signoff}>
        Good selling,<br />
        <strong>The DealEcho Team</strong>
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

const linkText = {
  color: "#4f46e5",
  fontSize: "11px",
  wordBreak: "break-all" as const,
};

const signoff = {
  color: "#334155",
  fontSize: "14px",
  lineHeight: "1.6",
  marginTop: "32px",
};
