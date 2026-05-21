import * as React from "react";
import { Text, Heading, Button, Section, Row, Column } from "@react-email/components";
import { DealEchoEmailLayout } from "./Layout";

interface TrackedAlertProps {
  name: string;
  email: string;
  companyName: string;
  companyId: string;
  reviewSummary: string;
  metrics: {
    resp: number;
    negot: number;
    intent: number;
    scope: number;
  };
}

export const TrackedAlertEmail: React.FC<TrackedAlertProps> = ({
  name,
  email,
  companyName,
  companyId,
  reviewSummary,
  metrics,
}) => {
  const scoreTotal = (metrics.resp + metrics.negot + metrics.intent + metrics.scope);
  const healthIndex = Math.round((scoreTotal / 20) * 100);

  return (
    <DealEchoEmailLayout
      previewTextText={`New buyer intelligence just posted for ${companyName}.`}
      userEmail={email}
    >
      <Text style={alertBadge}>NEW INTELLIGENCE DEPLOYED</Text>
      <Heading style={h1}>Update on {companyName}</Heading>

      <Text style={paragraph}>
        Hi {name.split(" ")[0]}, a new verified buyer report was just vetted and approved for an account you are currently tracking:
      </Text>

      {/* Mini Scorecard Card */}
      <Section style={card}>
        <Row style={{ marginBottom: "16px" }}>
          <Column>
            <Text style={companyTitle}>{companyName}</Text>
            <Text style={companySub}>Recently Analyzed Account</Text>
          </Column>
          <Column style={{ textAlign: "right" }}>
            <Section style={scoreBadge}>
              <Text style={scoreLabel}>INDEX SCORE</Text>
              <Text style={scoreValue}>{healthIndex}%</Text>
            </Section>
          </Column>
        </Row>

        <Text style={reviewLabel}>VETTED SYNOPSIS</Text>
        <Text style={reviewText}>"{reviewSummary}"</Text>

        <Section style={{ marginTop: "20px" }}>
          <Row style={metricRow}>
            <Column><Text style={metricName}>💬 Responsiveness</Text></Column>
            <Column style={{ textAlign: "right" }}><Text style={metricValue}>{metrics.resp.toFixed(1)}/5.0</Text></Column>
          </Row>
          <Row style={metricRow}>
            <Column><Text style={metricName}>🤝 Negotiation Ease</Text></Column>
            <Column style={{ textAlign: "right" }}><Text style={metricValue}>{metrics.negot.toFixed(1)}/5.0</Text></Column>
          </Row>
          <Row style={metricRow}>
            <Column><Text style={metricName}>🎯 Buyer Intent</Text></Column>
            <Column style={{ textAlign: "right" }}><Text style={metricValue}>{metrics.intent.toFixed(1)}/5.0</Text></Column>
          </Row>
          <Row style={metricRow}>
            <Column><Text style={metricName}>🗺️ Scope Maturity</Text></Column>
            <Column style={{ textAlign: "right" }}><Text style={metricValue}>{metrics.scope.toFixed(1)}/5.0</Text></Column>
          </Row>
        </Section>
      </Section>

      <Section style={ctaContainer}>
        <Button href={`https://dealecho.io/company/${companyId}`} style={primaryButton}>
          Unlock Full Intel Report
        </Button>
      </Section>
    </DealEchoEmailLayout>
  );
};

const alertBadge = {
  backgroundColor: "#e0e7ff",
  color: "#4f46e5",
  fontSize: "10px",
  fontWeight: "800",
  letterSpacing: "0.15em",
  padding: "6px 12px",
  borderRadius: "8px",
  display: "inline-block",
  margin: "0 0 12px 0",
};

const h1 = {
  color: "#0f172a",
  fontSize: "26px",
  fontWeight: "800",
  letterSpacing: "-0.02em",
  margin: "0 0 20px 0",
};

const paragraph = {
  color: "#334155",
  fontSize: "15px",
  lineHeight: "1.6",
  margin: "0 0 24px 0",
};

const card = {
  backgroundColor: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: "20px",
  padding: "24px",
  boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)",
};

const companyTitle = {
  color: "#0f172a",
  fontSize: "20px",
  fontWeight: "800",
  margin: "0 0 2px 0",
};

const companySub = {
  color: "#94a3b8",
  fontSize: "11px",
  fontWeight: "700",
  textTransform: "uppercase" as const,
  margin: "0",
};

const scoreBadge = {
  backgroundColor: "#101426",
  padding: "6px 12px",
  borderRadius: "10px",
  display: "inline-block",
  textAlign: "center" as const,
};

const scoreLabel = {
  color: "#94a3b8",
  fontSize: "7px",
  fontWeight: "900",
  margin: "0",
};

const scoreValue = {
  color: "#818cf8",
  fontSize: "13px",
  fontWeight: "950",
  margin: "2px 0 0 0",
};

const reviewLabel = {
  color: "#64748b",
  fontSize: "10px",
  fontWeight: "800",
  letterSpacing: "0.1em",
  margin: "20px 0 6px 0",
};

const reviewText = {
  color: "#334155",
  fontSize: "13px",
  fontStyle: "italic",
  lineHeight: "1.5",
  backgroundColor: "#f8fafc",
  padding: "12px 16px",
  borderRadius: "12px",
  margin: "0 0 20px 0",
};

const metricRow = {
  borderBottom: "1px solid #f1f5f9",
  padding: "8px 0",
};

const metricName = {
  color: "#475569",
  fontSize: "12px",
  fontWeight: "700",
  margin: "0",
};

const metricValue = {
  color: "#0f172a",
  fontSize: "12px",
  fontWeight: "800",
  margin: "0",
};

const ctaContainer = {
  textAlign: "center" as const,
  margin: "36px 0 24px 0",
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
