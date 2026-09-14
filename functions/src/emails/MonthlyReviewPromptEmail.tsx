import * as React from "react";
import { Text, Heading, Button, Section } from "@react-email/components";
import { DealEchoEmailLayout } from "./Layout";
import { NEW_REVIEW_URL } from "../lib/constants";
import { firstName } from "../lib/lifecycle";

/**
 * Three angles on the same monthly ask. The mail goes to the entire register
 * twelve times a year, so identical copy every month trains people to delete it
 * on sight. Each variant leads with a different reason to bother: what you owe
 * the pool, what you're about to forget, and what just happened to you.
 *
 * `{name}` in a heading is replaced with the recipient's first name.
 */
export interface MonthlyVariant {
  subject: string;
  preheader: string;
  heading: string;
  paragraphs: string[];
  ctaLabel: string;
}

export const MONTHLY_VARIANTS: MonthlyVariant[] = [
  {
    subject: "Someone logged a deal so you didn't walk in blind",
    preheader: "Return the favour before the month closes.",
    heading: "Your turn, {name}",
    paragraphs: [
      "Every company profile you opened this month exists because a rep somewhere wrote down what actually happened in their deal: the procurement tactics, the real timeline, where the price landed.",
      "That only keeps working if it runs both ways. Log the deals you worked this month and the next person walking into that account gets the same head start you did.",
      "Won, lost or still open. All three are worth recording.",
    ],
    ctaLabel: "Add a review",
  },
  {
    subject: "Log this month's deals while you still remember the detail",
    preheader: "In three months you'll remember the outcome, not the tactics.",
    heading: "Write it down while it's fresh, {name}",
    paragraphs: [
      "The useful part of a deal fades fast. Three months from now you'll remember whether you won. You won't remember the approval layer nobody mentioned at discovery, the week the process stalled, or the number they opened with.",
      "That detail is exactly what makes a review worth reading, and right now it's still in your head.",
      "Take two minutes on whatever moved this month. Ongoing deals count, no outcome required.",
    ],
    ctaLabel: "Log a deal",
  },
  {
    subject: "What did procurement put you through this month?",
    preheader: "Won, lost or still grinding. All of it counts.",
    heading: "Month's nearly done. How did it actually go, {name}?",
    paragraphs: [
      "Pick the deals that moved and put them on record. The stall that cost you three weeks. The competitor that showed up late with a number. The buying committee that doubled in size after you'd already scoped it.",
      "None of that shows up in a CRM field, and none of it reaches the next rep unless someone writes it down.",
      "Two minutes per deal, and ongoing accounts are fair game.",
    ],
    ctaLabel: "Start a review",
  },
];

interface MonthlyReviewPromptEmailProps {
  name: string;
  email: string;
  uid?: string;
  /** Index into MONTHLY_VARIANTS. Out-of-range values wrap. */
  variant: number;
}

export const MonthlyReviewPromptEmail: React.FC<MonthlyReviewPromptEmailProps> = ({
  name,
  email,
  uid,
  variant,
}) => {
  const v = MONTHLY_VARIANTS[
    ((variant % MONTHLY_VARIANTS.length) + MONTHLY_VARIANTS.length) %
      MONTHLY_VARIANTS.length
  ];
  return (
    <DealEchoEmailLayout
      previewTextText={v.preheader}
      userEmail={email}
      userUid={uid}
    >
      <Heading style={h1}>{v.heading.replace("{name}", firstName(name))}</Heading>

      {v.paragraphs.map((p, i) => (
        <Text key={i} style={paragraph}>
          {p}
        </Text>
      ))}

      <Section style={ctaContainer}>
        <Button href={NEW_REVIEW_URL} style={primaryButton}>
          {v.ctaLabel}
        </Button>
      </Section>
    </DealEchoEmailLayout>
  );
};

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
