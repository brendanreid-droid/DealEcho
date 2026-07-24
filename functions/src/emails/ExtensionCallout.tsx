import * as React from "react";
import { Text, Link, Section } from "@react-email/components";
import { CHROME_EXTENSION_URL } from "../lib/constants";

/**
 * Slim extension prompt that rides along at the foot of every email, above the
 * layout footer. Deliberately quieter than the primary CTA so it never competes
 * with the reason the email was sent.
 */
export const ExtensionCallout: React.FC = () => (
  <Section style={container}>
    <Text style={label}>Chrome extension</Text>
    <Text style={body}>
      Pull deal intel and log reviews without leaving your CRM or inbox.{" "}
      <Link href={CHROME_EXTENSION_URL} style={link}>
        Add Dealecho to Chrome &rarr;
      </Link>
    </Text>
  </Section>
);

const container = {
  backgroundColor: "#f8fafc",
  border: "1px solid #e8ecf3",
  borderRadius: "14px",
  padding: "16px 20px",
  margin: "32px 0 0 0",
};

const label = {
  color: "#64748b",
  fontSize: "10px",
  fontWeight: "800",
  letterSpacing: "0.12em",
  textTransform: "uppercase" as const,
  margin: "0 0 6px 0",
};

const body = {
  color: "#475569",
  fontSize: "13px",
  lineHeight: "1.55",
  margin: "0",
};

const link = {
  color: "#4f46e5",
  fontWeight: "800",
  textDecoration: "none",
  whiteSpace: "nowrap" as const,
};
