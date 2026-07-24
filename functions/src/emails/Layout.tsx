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
  Img,
} from "@react-email/components";
import { ExtensionCallout } from "./ExtensionCallout";
import { CONTROL_CENTRE_URL, APP_URL, EMAIL_LOGO_URL } from "../lib/constants";

interface EmailLayoutProps {
  previewTextText: string;
  children: React.ReactNode;
  userEmail?: string;
  userUid?: string;
  /** Security/account mail (resets, activations). Hides the unsubscribe link. */
  transactional?: boolean;
  /**
   * The extension prompt rides along on every email by default. Set false only
   * where it would compete with the message (e.g. a template that already makes
   * the extension its primary call to action).
   */
  showExtension?: boolean;
}

export const DealEchoEmailLayout: React.FC<EmailLayoutProps> = ({
  previewTextText,
  children,
  userEmail,
  userUid,
  transactional = false,
  showExtension = true,
}) => {
  return (
    <Html>
      <Head />
      <Body style={mainBg}>
        {/* Hidden text for email client preview */}
        <span style={{ display: "none", fontSize: 0 }}>{previewTextText}</span>
        
        <Container style={container}>
          {/* Header banner. Background matches the lockup PNG so the two blend. */}
          <Section style={headerSection}>
            <Img
              src={EMAIL_LOGO_URL}
              width="200"
              height="56"
              alt="Dealecho"
              style={logoImage}
            />
            <Text style={taglineText}>Sales Intelligence Hub</Text>
          </Section>

          {/* Email Body Content */}
          <Section style={bodyContentSection}>
            {children}
            {showExtension && <ExtensionCallout />}
          </Section>

          {/* Footer Section */}
          <Section style={footerSection}>
            <Hr style={divider} />
            <Text style={footerText}>
              &copy; {new Date().getFullYear()} Dealecho Pty Ltd. All rights reserved.
            </Text>
            <Text style={footerSubtext}>
              {transactional
                ? "This is an account security email sent to you as a registered member of Dealecho."
                : "You received this email because you are a registered member of Dealecho."}
              {userEmail && ` Sent to ${userEmail}.`}
            </Text>
            <Text style={footerLinks}>
              <Link href={CONTROL_CENTRE_URL} style={footerLink}>Control Centre</Link>
              {!transactional && (
                <>
                  {" • "}
                  <Link href={`${APP_URL}/unsubscribe?email=${encodeURIComponent(userEmail || "")}&uid=${userUid || ""}`} style={footerLink}>Unsubscribe / Preferences</Link>
                </>
              )}
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
  backgroundColor: "#0e1426",
  padding: "30px 40px 26px 40px",
  textAlign: "center" as const,
};

const logoImage = {
  display: "block",
  margin: "0 auto 8px auto",
  border: "0",
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
