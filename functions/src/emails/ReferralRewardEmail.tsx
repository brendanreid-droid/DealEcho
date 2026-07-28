import * as React from 'react';
import { Text, Heading, Button, Section } from '@react-email/components';
import { DealEchoEmailLayout } from './Layout';
import { CONTROL_CENTRE_URL } from '../lib/constants';

interface ReferralRewardEmailProps {
  referrerName: string;
  refereeEmail: string;
  recipientEmail: string;
}

export const ReferralRewardEmail: React.FC<ReferralRewardEmailProps> = ({
  referrerName,
  refereeEmail,
  recipientEmail,
}) => (
  <DealEchoEmailLayout
    previewTextText="Your referral came through. A free month is on your account."
    userEmail={recipientEmail}
    transactional
  >
    <Heading style={h1}>You've earned a free month</Heading>

    <Text style={paragraph}>
      Nice work, {referrerName}. {refereeEmail} joined Dealecho on Sales Pro and
      their first payment has gone through, so a free month of credit is now
      sitting on your account.
    </Text>

    <Text style={paragraph}>
      The credit applies automatically to your next invoice. Nothing for you to
      do.
    </Text>

    <Section style={ctaContainer}>
      <Button href={`${CONTROL_CENTRE_URL}`} style={primaryButton}>
        View your referrals
      </Button>
    </Section>

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
const signoff = { color: '#334155', fontSize: '14px', lineHeight: '1.6', marginTop: '32px' };
