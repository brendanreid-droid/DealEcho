import * as React from 'react';
import { Text, Heading, Section } from '@react-email/components';
import { DealEchoEmailLayout } from './Layout';

interface NewSignupAlertEmailProps {
  email: string;
  name: string;
  uid: string;
}

export const NewSignupAlertEmail: React.FC<NewSignupAlertEmailProps> = ({
  email,
  name,
  uid,
}) => (
  <DealEchoEmailLayout
    previewTextText={`New signup: ${email}`}
    userEmail={email}
    transactional
    showExtension={false}
  >
    <Heading style={h1}>New signup</Heading>

    <Section style={box}>
      <Text style={row}><strong>Name:</strong> {name}</Text>
      <Text style={row}><strong>Email:</strong> {email}</Text>
      <Text style={mono}>{uid}</Text>
    </Section>
  </DealEchoEmailLayout>
);

const h1 = { color: '#0f172a', fontSize: '26px', fontWeight: '800', letterSpacing: '-0.02em', margin: '0 0 24px 0' };
const box = { backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '20px', margin: '0 0 20px 0' };
const row = { color: '#334155', fontSize: '14px', lineHeight: '1.6', margin: '0 0 8px 0' };
const mono = { color: '#94a3b8', fontSize: '12px', fontFamily: 'monospace', margin: '4px 0 0 0' };
