import * as React from "react";
import { Text, Heading, Button, Section } from "@react-email/components";
import { DealEchoEmailLayout } from "./Layout";

interface NewsletterEmailProps {
  title: string;
  preheaderText: string;
  paragraphs: string[];
  ctaText?: string;
  ctaUrl?: string;
  email: string;
  uid: string;
  newsletterId?: string;
}

export const NewsletterEmail: React.FC<NewsletterEmailProps> = ({
  title,
  preheaderText,
  paragraphs,
  ctaText = "Explore Intel Dashboard",
  ctaUrl = "https://dealecho.io",
  email,
  uid,
  newsletterId,
}) => {
  return (
    <DealEchoEmailLayout
      previewTextText={preheaderText}
      userEmail={email}
      userUid={uid}
    >
      <Heading style={h1}>{title}</Heading>

      {paragraphs.map((p, index) => (
        <Text key={index} style={paragraph}>
          {p}
        </Text>
      ))}

      {ctaText && ctaUrl && (
        <Section style={ctaContainer}>
          <Button href={ctaUrl} style={primaryButton}>
            {ctaText}
          </Button>
        </Section>
      )}

      <Text style={signoff}>
        Good selling,<br />
        <strong>The dealecho Team</strong>
      </Text>

      {/* Transparent 1x1 GIF tracking pixel */}
      {newsletterId && uid && (
        <img
          src={`https://australia-southeast1-dealecho-io-sales-intel-hub.cloudfunctions.net/trackNewsletterOpen?newsletterId=${newsletterId}&uid=${uid}`}
          width="1"
          height="1"
          style={{ display: "none" }}
          alt=""
        />
      )}
    </DealEchoEmailLayout>
  );
};

const h1 = {
  color: "#0f172a",
  fontSize: "24px",
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
  marginTop: "24px",
};
