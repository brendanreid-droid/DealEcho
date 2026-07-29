import * as React from 'react';
import { Text, Heading, Section } from '@react-email/components';
import { DealEchoEmailLayout } from './Layout';

interface HealthAlertEmailProps {
  recipientEmail: string;
  webhookSilent: boolean;
  hoursSinceLastWebhook: number | null;
  lastWebhookAt: string | null;
  stuckInvites: Array<{ token: string; referrerUid: string; since: string }>;
}

export const HealthAlertEmail: React.FC<HealthAlertEmailProps> = ({
  recipientEmail,
  webhookSilent,
  hoursSinceLastWebhook,
  lastWebhookAt,
  stuckInvites,
}) => (
  <DealEchoEmailLayout
    previewTextText="Dealecho health check found something that needs attention."
    userEmail={recipientEmail}
    transactional
    showExtension={false}
  >
    <Heading style={h1}>Health check alert</Heading>

    {webhookSilent && (
      <Section style={alertBox}>
        <Text style={alertTitle}>Stripe webhook has gone quiet</Text>
        <Text style={paragraph}>
          {lastWebhookAt
            ? `The last successfully processed webhook was ${hoursSinceLastWebhook} hours ago (${lastWebhookAt}).`
            : 'No successful webhook has ever been recorded.'}
        </Text>
        <Text style={paragraph}>
          While this is happening, people who pay are not being granted access,
          and people who cancel are not losing it. Check that the endpoint still
          exists in the Stripe dashboard and that its signing secret matches
          STRIPE_WEBHOOK_SECRET.
        </Text>
      </Section>
    )}

    {stuckInvites.length > 0 && (
      <Section style={alertBox}>
        <Text style={alertTitle}>
          {stuckInvites.length} referral payout
          {stuckInvites.length === 1 ? '' : 's'} stuck mid-flight
        </Text>
        <Text style={paragraph}>
          These invites have been in the "rewarding" state for over an hour,
          which means a payout started and did not finish. They are not at risk
          of paying twice, but each needs checking against Stripe to see whether
          the credit was actually granted.
        </Text>
        {stuckInvites.map((i) => (
          <Text key={i.token} style={mono}>
            {i.token} - referrer {i.referrerUid} - since {i.since}
          </Text>
        ))}
      </Section>
    )}

    <Text style={signoff}>
      This is an automated check. It only emails when something is wrong.
    </Text>
  </DealEchoEmailLayout>
);

const h1 = { color: '#0f172a', fontSize: '26px', fontWeight: '800', letterSpacing: '-0.02em', margin: '0 0 24px 0' };
const paragraph = { color: '#334155', fontSize: '14px', lineHeight: '1.6', margin: '0 0 12px 0' };
const alertBox = { backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '14px', padding: '20px', margin: '0 0 20px 0' };
const alertTitle = { color: '#b91c1c', fontSize: '15px', fontWeight: '800', margin: '0 0 12px 0' };
const mono = { color: '#475569', fontSize: '12px', fontFamily: 'monospace', margin: '0 0 4px 0' };
const signoff = { color: '#64748b', fontSize: '12px', lineHeight: '1.6', marginTop: '24px' };
