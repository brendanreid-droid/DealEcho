import * as React from "react";
import { Text, Heading, Button, Section, Row, Column, Link } from "@react-email/components";
import { DealEchoEmailLayout } from "./Layout";
import {
  CONTROL_CENTRE_URL,
  NEW_REVIEW_URL,
  SEARCH_URL,
  CHROME_EXTENSION_URL,
} from "../lib/constants";

interface WelcomeEmailProps {
  name: string;
  email: string;
  uid?: string;
}

/**
 * Mirrors the four steps in the in-app onboarding checklist
 * (src/components/OnboardingChecklist.tsx). Keep the wording in step with it.
 */
const STEPS = [
  {
    title: "Track your first account",
    body: "Follow a company to get alerts when new intel lands.",
    cta: "Find a company",
    href: SEARCH_URL,
  },
  {
    title: "Write your first review",
    body: "Share one deal. It unlocks 7 days of full review access across every company.",
    cta: "Write a review",
    href: NEW_REVIEW_URL,
  },
  {
    title: "Download the browser extension",
    body: "Pull deal intel and log reviews without leaving your CRM or inbox.",
    cta: "Add to Chrome",
    href: CHROME_EXTENSION_URL,
  },
  {
    title: "Tell us about you",
    body: "Two taps, your role and company size. Helps us tailor Dealecho to your patch.",
    cta: "Answer the questions",
    href: CONTROL_CENTRE_URL,
  },
];

export const WelcomeEmail: React.FC<WelcomeEmailProps> = ({ name, email, uid }) => {
  const firstName = name ? name.split(" ")[0] : "there";

  return (
    <DealEchoEmailLayout
      previewTextText="You're in. Four steps to get set up on Dealecho."
      userEmail={email}
      userUid={uid}
      /* Step 4 of the checklist already makes the extension pitch. */
      showExtension={false}
    >
      <Heading style={h1}>You're in, {firstName}</Heading>

      <Text style={paragraph}>
        <strong>Dealecho</strong> equips sales executives with a platform that holds buying teams accountable and adds a layer of intelligence to their pipeline.
      </Text>

      <Text style={paragraph}>
        See how an account behaves before you commit a quarter to it: how fast they respond, how they negotiate, how clear their scope really is. And when a buyer wastes your time, leave an honest review so it counts.
      </Text>

      <Text style={checklistIntro}>Four steps to get you set up</Text>

      <Section style={checklistContainer}>
        {STEPS.map((step, i) => (
          <Row key={step.title} style={i === STEPS.length - 1 ? stepRowLast : stepRow}>
            <Column style={stepNumberCell}>
              <Text style={stepNumber}>{i + 1}</Text>
            </Column>
            <Column>
              <Text style={stepTitle}>{step.title}</Text>
              <Text style={stepBody}>{step.body}</Text>
              <Link href={step.href} style={stepLink}>
                {step.cta} &rarr;
              </Link>
            </Column>
          </Row>
        ))}
      </Section>

      <Text style={checklistFootnote}>
        Your progress is waiting in the Control Centre, so you can pick up wherever you stop.
      </Text>

      <Section style={ctaContainer}>
        <Button href={CONTROL_CENTRE_URL} style={primaryButton}>
          Launch Your Control Centre
        </Button>
      </Section>

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

const checklistIntro = {
  color: "#0f172a",
  fontSize: "12px",
  fontWeight: "800",
  letterSpacing: "0.12em",
  textTransform: "uppercase" as const,
  margin: "32px 0 12px 0",
};

const checklistContainer = {
  backgroundColor: "#f8fafc",
  border: "1px solid #eef1f6",
  borderRadius: "16px",
  padding: "8px 20px",
  margin: "0 0 16px 0",
};

const stepRow = {
  borderBottom: "1px solid #e9edf4",
};

const stepRowLast = {
  borderBottom: "none",
};

const stepNumberCell = {
  width: "34px",
  verticalAlign: "top" as const,
  paddingTop: "18px",
};

const stepNumber = {
  backgroundColor: "#e0e7ff",
  color: "#4f46e5",
  fontSize: "11px",
  fontWeight: "900",
  width: "22px",
  height: "22px",
  lineHeight: "22px",
  borderRadius: "11px",
  textAlign: "center" as const,
  margin: "0",
};

const stepTitle = {
  color: "#0f172a",
  fontSize: "14px",
  fontWeight: "800",
  margin: "16px 0 2px 0",
};

const stepBody = {
  color: "#475569",
  fontSize: "13px",
  lineHeight: "1.5",
  margin: "0 0 6px 0",
};

const stepLink = {
  color: "#4f46e5",
  fontSize: "13px",
  fontWeight: "800",
  textDecoration: "none",
  display: "inline-block",
  marginBottom: "16px",
};

const checklistFootnote = {
  color: "#64748b",
  fontSize: "12px",
  lineHeight: "1.55",
  margin: "0 0 8px 0",
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
