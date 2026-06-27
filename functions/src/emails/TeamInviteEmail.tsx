import * as React from 'react';
import { Text, Heading, Button, Section } from '@react-email/components';
import { DealEchoEmailLayout } from './Layout';

interface TeamInviteEmailProps {
  inviterName: string;
  teamRole: 'manager' | 'user';
  acceptUrl: string;
  recipientEmail: string;
}

export const TeamInviteEmail: React.FC<TeamInviteEmailProps> = ({
  inviterName,
  teamRole,
  acceptUrl,
  recipientEmail,
}) => (
  <DealEchoEmailLayout
    previewTextText={`${inviterName} invited you to join their DealEcho Enterprise team.`}
    userEmail={recipientEmail}
  >
    <Heading style={h1}>You've been invited to DealEcho Enterprise</Heading>

    <Text style={paragraph}>
      {inviterName} has invited you to join their DealEcho Enterprise team as a{' '}
      <strong>{teamRole === 'manager' ? 'Team Manager' : 'Team Member'}</strong>.
    </Text>

    <Text style={paragraph}>
      As an Enterprise member you'll get full Pro access — plus{' '}
      {teamRole === 'manager' ? "the ability to manage your team's seats and members." : 'access to all deal intelligence features.'}
    </Text>

    <Section style={ctaContainer}>
      <Button href={acceptUrl} style={primaryButton}>
        Accept Invitation
      </Button>
    </Section>

    <Text style={subtext}>
      This invite link expires in 7 days. If you didn't expect this email, you can safely ignore it.
      <br />
      <span style={linkText}>{acceptUrl}</span>
    </Text>

    <Text style={signoff}>
      Good selling,
      <br />
      <strong>The dealecho Team</strong>
    </Text>
  </DealEchoEmailLayout>
);

const h1 = { color: '#0f172a', fontSize: '26px', fontWeight: '800', letterSpacing: '-0.02em', margin: '0 0 24px 0' };
const paragraph = { color: '#334155', fontSize: '15px', lineHeight: '1.6', margin: '0 0 20px 0' };
const ctaContainer = { textAlign: 'center' as const, margin: '32px 0 24px 0' };
const primaryButton = { backgroundColor: '#4f46e5', borderRadius: '14px', color: '#ffffff', fontSize: '14px', fontWeight: '800', textDecoration: 'none', textAlign: 'center' as const, display: 'inline-block', padding: '16px 32px' };
const subtext = { color: '#64748b', fontSize: '12px', lineHeight: '1.6', margin: '24px 0 0 0' };
const linkText = { color: '#4f46e5', fontSize: '11px', wordBreak: 'break-all' as const };
const signoff = { color: '#334155', fontSize: '14px', lineHeight: '1.6', marginTop: '32px' };
