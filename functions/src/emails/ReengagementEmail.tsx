import * as React from "react";
import { Text, Heading, Button, Section } from "@react-email/components";
import { DealEchoEmailLayout } from "./Layout";
import { CONTROL_CENTRE_URL } from "../lib/constants";

interface ReengagementEmailProps {
  name: string;
  email: string;
  uid?: string;
}

export const ReengagementEmail: React.FC<ReengagementEmailProps> = ({ name, email, uid }) => (
  <DealEchoEmailLayout
    previewTextText="New verified reviews have landed since your last login."
    userEmail={email}
    userUid={uid}
  >
    <Heading style={h1}>It's been a month, {name.split(" ")[0]}</Heading>

    <Text style={paragraph}>
      Since your last login, sellers have filed new verified reviews on enterprise accounts:
      how the buying team negotiated, where the scope moved, and what the process actually cost them.
    </Text>

    <Text style={paragraph}>
      Worth a read before you commit another quarter to a deal.
    </Text>

    <Section style={ctaContainer}>
      <Button href={CONTROL_CENTRE_URL} style={primaryButton}>
        See what's new
      </Button>
    </Section>
  </DealEchoEmailLayout>
);

const h1 = { color: "#0f172a", fontSize: "24px", fontWeight: "850", margin: "0 0 16px 0" };
const paragraph = { color: "#334155", fontSize: "14px", lineHeight: "1.6", margin: "0 0 20px 0" };
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
