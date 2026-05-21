import * as React from "react";
import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Link,
  Hr,
} from "@react-email/components";

interface EmailLayoutProps {
  previewTextText: string;
  children: React.ReactNode;
  userEmail?: string;
  userUid?: string;
}

export const DealEchoEmailLayout: React.FC<EmailLayoutProps> = ({
  previewTextText,
  children,
  userEmail,
  userUid,
}) => {
  return (
    <Html>
      <Head />
      <Body style={mainBg}>
        {/* Hidden text for email client preview */}
        <span style={{ display: "none", fontSize: 0 }}>{previewTextText}</span>
        
        <Container style={container}>
          {/* Header Banner matching DealEcho slate-900 / navy */}
          <Section style={headerSection}>
            <Text style={logoText}>DEAL<span style={{ color: "#818cf8" }}>ECHO</span></Text>
            <Text style={taglineText}>Sales Intelligence Hub</Text>
          </Section>

          {/* Email Body Content */}
          <Section style={bodyContentSection}>
            {children}
          </Section>

          {/* Footer Section */}
          <Section style={footerSection}>
            <Hr style={divider} />
            <Text style={footerText}>
              &copy; {new Date().getFullYear()} DealEcho.io. All rights reserved.
            </Text>
            <Text style={footerSubtext}>
              You received this email because you are a registered member of DealEcho.io.
              {userEmail && ` Sent to ${userEmail}.`}
            </Text>
            <Text style={footerLinks}>
              <Link href="https://dealecho.io" style={footerLink}>Dashboard</Link>
              {" • "}
              <Link href="https://dealecho.io/pricing" style={footerLink}>Pricing</Link>
              {" • "}
              <Link href={`https://dealecho.io/unsubscribe?email=${encodeURIComponent(userEmail || "")}&uid=${userUid || ""}`} style={footerLink}>Unsubscribe / Preferences</Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

// Styling Object Map
const mainBg = {
  backgroundColor: "#f8fafc",
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  margin: "0 auto",
  padding: "40px 10px",
};

const container = {
  backgroundColor: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: "24px",
  overflow: "hidden" as const,
  maxWidth: "580px",
  boxShadow: "0 10px 25px -5px rgba(0,0,0,0.02), 0 8px 10px -6px rgba(0,0,0,0.02)",
};

const headerSection = {
  backgroundColor: "#101426",
  padding: "32px 40px",
  textAlign: "center" as const,
};

const logoText = {
  color: "#ffffff",
  fontSize: "24px",
  fontWeight: "900",
  letterSpacing: "0.05em",
  margin: "0 0 4px 0",
};

const taglineText = {
  color: "#94a3b8",
  fontSize: "11px",
  fontWeight: "700",
  textTransform: "uppercase" as const,
  letterSpacing: "0.15em",
  margin: "0",
};

const bodyContentSection = {
  padding: "48px 40px 32px 40px",
};

const footerSection = {
  padding: "0 40px 48px 40px",
  textAlign: "center" as const,
};

const divider = {
  borderColor: "#f1f5f9",
  margin: "24px 0",
};

const footerText = {
  color: "#475569",
  fontSize: "12px",
  fontWeight: "700",
  margin: "0 0 8px 0",
};

const footerSubtext = {
  color: "#94a3b8",
  fontSize: "11px",
  lineHeight: "1.6",
  margin: "0 0 16px 0",
};

const footerLinks = {
  fontSize: "11px",
  fontWeight: "700",
};

const footerLink = {
  color: "#4f46e5",
  textDecoration: "none",
};
