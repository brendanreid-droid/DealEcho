import * as React from "react";
import { Text, Heading, Button, Section } from "@react-email/components";
import { DealEchoEmailLayout } from "./Layout";

interface WelcomeEmailProps {
  name: string;
  email: string;
}

export const WelcomeEmail: React.FC<WelcomeEmailProps> = ({ name, email }) => {
  const firstName = name ? name.split(" ")[0] : "there";
  
  return (
    <DealEchoEmailLayout 
      previewTextText="Welcome to DealEcho! Access crowdsourced enterprise deal mechanics."
      userEmail={email}
    >
      <Heading style={h1}>Welcome, {firstName}!</Heading>
      
      <Text style={paragraph}>
        We are thrilled to welcome you to **DealEcho.io**—the premier crowdsourced intelligence layer for enterprise B2B sales cycles.
      </Text>

      <Text style={paragraph}>
        By joining our verified network of B2B sales professionals, you now have access to crowdsourced account insights, buying team behaviors, and real-time deal mechanics to optimize your close rate.
      </Text>

      <Section style={valuePropsContainer}>
        <Text style={valueTitle}>📈 Live Buyer Intel</Text>
        <Text style={valueDesc}>
          Track real-time responsiveness, negotiation tactics, and scope clarity of tier-1 accounts before submitting your proposal.
        </Text>

        <Text style={valueTitle}>🔔 Smart Bookmarks & Alerts</Text>
        <Text style={valueDesc}>
          Bookmark critical target companies on your dashboard. We'll automatically email you the second a new vetted buyer report is published.
        </Text>
      </Section>

      <Section style={ctaContainer}>
        <Button href="https://dealecho.io" style={primaryButton}>
          Launch Your Dashboard
        </Button>
      </Section>

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

const valuePropsContainer = {
  backgroundColor: "#f8fafc",
  border: "1px solid #f1f5f9",
  borderRadius: "16px",
  padding: "24px 20px",
  margin: "24px 0",
};

const valueTitle = {
  color: "#0f172a",
  fontSize: "14px",
  fontWeight: "800",
  margin: "0 0 4px 0",
};

const valueDesc = {
  color: "#475569",
  fontSize: "13px",
  lineHeight: "1.5",
  margin: "0 0 16px 0",
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
  marginTop: "24px",
};
