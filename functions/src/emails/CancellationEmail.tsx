import * as React from 'react';
import { Text, Heading, Button, Section } from '@react-email/components';
import { DealEchoEmailLayout } from './Layout';
import { APP_URL } from '../lib/constants';

interface CancellationEmailProps {
  name: string;
  recipientEmail: string;
}

export const CancellationEmail: React.FC<CancellationEmailProps> = ({
  name,
  recipientEmail,
}) => (
  <DealEchoEmailLayout
    previewTextText="Your Dealecho Sales Pro subscription has been cancelled."
    userEmail={recipientEmail}
    transactional
  >
    <Heading style={h1}>Your subscription has been cancelled</Heading>

    <Text style={paragraph}>
      Hi {name}, this is just to confirm your Dealecho Sales Pro subscription has
      been cancelled. You won't be charged again.
    </Text>

    <Text style={paragraph}>
      Your account is still here, and any reports you've contributed stay yours.
      You can pick up where you left off whenever you want - resubscribing takes
      about a minute.
    </Text>

    <Text style={paragraph}>
      If something wasn't working for you, we'd genuinely like to know. Just
      reply to this email and it comes straight to us.
    </Text>

    <Section style={ctaContainer}>
      <Button href={`${APP_URL}/pricing`} style={primaryButton}>
        Resubscribe
      </Button>
    </Section>

    <Text style={signoff}>
      Sorry to see you go,
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
