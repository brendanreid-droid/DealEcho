import * as React from 'react';
import { Text, Heading, Button, Section } from '@react-email/components';
import { DealEchoEmailLayout } from './Layout';

interface ReferralInviteEmailProps {
  referrerName: string;
  inviteUrl: string;
  recipientEmail: string;
}

export const ReferralInviteEmail: React.FC<ReferralInviteEmailProps> = ({
  referrerName,
  inviteUrl,
  recipientEmail,
}) => (
  <DealEchoEmailLayout
    previewTextText={`${referrerName} thinks Dealecho would be useful to you.`}
    userEmail={recipientEmail}
    footerReason={`You received this because ${referrerName} invited you to Dealecho. You are not subscribed to anything.`}
  >
    <Heading style={h1}>{referrerName} invited you to Dealecho</Heading>

    <Text style={paragraph}>
      Dealecho is where sales teams share what actually happened inside deals:
      who really held the budget, how long procurement took, why the deal was
      won or lost.
    </Text>

    <Text style={paragraph}>
      Your invite includes <strong>30 days of Sales Pro, free</strong>. No card
      charged until the trial ends.
    </Text>

    <Section style={ctaContainer}>
      <Button href={inviteUrl} style={primaryButton}>
        Claim your free month
      </Button>
    </Section>

    <Text style={subtext}>
      This invite expires in 60 days. If you weren't expecting it, you can
      safely ignore this email and we won't contact you again.
    </Text>

    <Text style={signoff}>
      Good selling,
      <br />
      <strong>The Dealecho Team</strong>
    </Text>
  </DealEchoEmailLayout>
);

const h1 = { color: '#0f172a', fontSize: '26px', fontWeight: '800', letterSpacing: '-0.02em', margin: '0 0 24px 0' };
const paragraph = { color: '#334155', fontSize: '15px', lineHeight: '1.6', margin: '0 0 20px 0' };
const ctaContainer = { textAlign: 'center' as const, margin: '32px 0 24px 0' };
const primaryButton = { backgroundColor: '#4f46e5', borderRadius: '14px', color: '#ffffff', fontSize: '14px', fontWeight: '800', textDecoration: 'none', textAlign: 'center' as const, display: 'inline-block', padding: '16px 32px' };
const subtext = { color: '#64748b', fontSize: '12px', lineHeight: '1.6', margin: '24px 0 0 0' };
const signoff = { color: '#334155', fontSize: '14px', lineHeight: '1.6', marginTop: '32px' };
