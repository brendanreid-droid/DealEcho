import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { randomBytes } from 'crypto';
import { db, auth } from './lib/firebaseAdmin';
import { getStripe } from './lib/stripe';
import { sendReactEmail } from './lib/email';
import { TeamInviteEmail } from './emails/TeamInviteEmail';
import * as React from 'react';

const FRONTEND_URL = process.env.FRONTEND_URL ?? 'https://dealecho.io';
const MIN_SEATS = 5;

// ── Helpers ──────────────────────────────────────────────────────────────────

async function assertManager(uid: string, teamId: string) {
  const memberSnap = await db
    .collection('teams')
    .doc(teamId)
    .collection('members')
    .doc(uid)
    .get();
  if (!memberSnap.exists || memberSnap.data()?.teamRole !== 'manager') {
    throw new HttpsError('permission-denied', 'Only team managers can perform this action.');
  }
}

async function getTeamOrThrow(teamId: string) {
  const teamSnap = await db.collection('teams').doc(teamId).get();
  if (!teamSnap.exists) throw new HttpsError('not-found', 'Team not found.');
  return { id: teamId, ...teamSnap.data() } as any;
}

// ── inviteTeamMember ─────────────────────────────────────────────────────────

export const inviteTeamMember = onCall({ cors: true, secrets: ['RESEND_API_KEY'] }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required.');

  const uid = request.auth.uid;
  const teamId: string = (request.auth.token as any).teamId;
  if (!teamId) throw new HttpsError('failed-precondition', 'Not part of an enterprise team.');

  await assertManager(uid, teamId);

  const { email: rawEmail, teamRole }: { email: string; teamRole: 'manager' | 'user' } = request.data;
  const email = (rawEmail ?? '').trim().toLowerCase();
  if (!email || !teamRole) throw new HttpsError('invalid-argument', 'email and teamRole required.');
  if (!['manager', 'user'].includes(teamRole)) throw new HttpsError('invalid-argument', 'teamRole must be manager or user.');

  const team = await getTeamOrThrow(teamId);

  // Check seat capacity
  const membersSnap = await db.collection('teams').doc(teamId).collection('members').get();
  const activeCount = membersSnap.docs.filter((d) => d.data().status === 'active').length;
  if (activeCount >= team.seats) {
    throw new HttpsError('resource-exhausted', 'No seats available. Add more seats first.');
  }

  // Check not already a member
  const existing = membersSnap.docs.find((d) => d.data().email === email);
  if (existing) throw new HttpsError('already-exists', 'This email is already a team member or has a pending invite.');

  // Check not on another team (query by email directly; '!= null' is not a valid Firestore filter)
  const usersByEmail = await db.collection('users').where('email', '==', email).get();
  const conflict = usersByEmail.docs.find((d) => {
    const t = d.data().teamId;
    return t && t !== teamId;
  });
  if (conflict) throw new HttpsError('already-exists', 'This user is already a member of another team.');

  const inviteToken = randomBytes(32).toString('hex');
  const now = new Date().toISOString();
  const inviteDocRef = db.collection('teams').doc(teamId).collection('members').doc();

  await inviteDocRef.set({
    uid: inviteDocRef.id, // placeholder; replaced on accept
    email,
    teamRole,
    status: 'invited',
    inviteToken,
    invitedAt: now,
  });

  const inviterRecord = await auth.getUser(uid);
  const inviterName = inviterRecord.displayName || inviterRecord.email?.split('@')[0] || 'Your team manager';
  const acceptUrl = `${FRONTEND_URL}/invite/accept?token=${inviteToken}`;

  // Member doc is already written above; don't fail the whole invite if email send errors.
  let emailSent = true;
  let emailError = '';
  try {
    await sendReactEmail({
      to: email,
      subject: `${inviterName} invited you to DealEcho Enterprise`,
      component: React.createElement(TeamInviteEmail, { inviterName, teamRole, acceptUrl, recipientEmail: email }),
    });
  } catch (e: any) {
    emailSent = false;
    emailError = e?.message || String(e);
    console.error('inviteTeamMember email send failed:', e);
  }

  return { success: true, emailSent, emailError };
});

// ── acceptTeamInvite ─────────────────────────────────────────────────────────

export const acceptTeamInvite = onCall({ cors: true }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required.');

  const uid = request.auth.uid;
  const { token }: { token: string } = request.data;
  if (!token) throw new HttpsError('invalid-argument', 'token required.');

  // Find invite by token across all teams
  const teamsSnap = await db.collection('teams').get();
  let foundTeamId: string | null = null;
  let foundMemberRef: FirebaseFirestore.DocumentReference | null = null;
  let foundMemberData: any = null;

  for (const teamDoc of teamsSnap.docs) {
    const membersSnap = await teamDoc.ref.collection('members').where('inviteToken', '==', token).limit(1).get();
    if (!membersSnap.empty) {
      foundTeamId = teamDoc.id;
      foundMemberRef = membersSnap.docs[0].ref;
      foundMemberData = membersSnap.docs[0].data();
      break;
    }
  }

  if (!foundTeamId || !foundMemberRef || !foundMemberData) {
    throw new HttpsError('not-found', 'Invalid or expired invite token.');
  }

  if (foundMemberData.status !== 'invited') {
    throw new HttpsError('failed-precondition', 'This invite has already been used.');
  }

  const userRecord = await auth.getUser(uid);
  if ((userRecord.email ?? '').toLowerCase() !== (foundMemberData.email ?? '').toLowerCase()) {
    throw new HttpsError('permission-denied', 'This invite was sent to a different email address.');
  }

  const now = new Date().toISOString();
  const { teamRole } = foundMemberData;

  // Replace placeholder member doc with real uid
  await foundMemberRef.delete();
  await db
    .collection('teams')
    .doc(foundTeamId)
    .collection('members')
    .doc(uid)
    .set({
      uid,
      email: userRecord.email ?? '',
      teamRole,
      status: 'active',
      invitedAt: foundMemberData.invitedAt,
      joinedAt: now,
    });

  // Update user doc
  await db.collection('users').doc(uid).set(
    { teamId: foundTeamId, teamRole },
    { merge: true },
  );

  // Set claims
  await auth.setCustomUserClaims(uid, {
    role: 'paid',
    tier: 'enterprise',
    teamId: foundTeamId,
    teamRole,
  });

  return { success: true, teamId: foundTeamId, teamRole };
});

// ── updateTeamMemberRole ─────────────────────────────────────────────────────

export const updateTeamMemberRole = onCall({ cors: true }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required.');

  const callerUid = request.auth.uid;
  const teamId: string = (request.auth.token as any).teamId;
  if (!teamId) throw new HttpsError('failed-precondition', 'Not part of an enterprise team.');

  await assertManager(callerUid, teamId);

  const { targetUid, newRole }: { targetUid: string; newRole: 'manager' | 'user' } = request.data;
  if (!targetUid || !newRole) throw new HttpsError('invalid-argument', 'targetUid and newRole required.');
  if (!['manager', 'user'].includes(newRole)) throw new HttpsError('invalid-argument', 'newRole must be manager or user.');

  // Block demoting self if last manager
  if (targetUid === callerUid && newRole === 'user') {
    const membersSnap = await db.collection('teams').doc(teamId).collection('members').get();
    const managerCount = membersSnap.docs.filter((d) => d.data().teamRole === 'manager' && d.data().status === 'active').length;
    if (managerCount <= 1) {
      throw new HttpsError('failed-precondition', 'Cannot demote yourself — promote another manager first.');
    }
  }

  const memberRef = db.collection('teams').doc(teamId).collection('members').doc(targetUid);
  const memberSnap = await memberRef.get();
  if (!memberSnap.exists) throw new HttpsError('not-found', 'Member not found in team.');

  await memberRef.update({ teamRole: newRole });
  await db.collection('users').doc(targetUid).set({ teamRole: newRole }, { merge: true });

  const existingClaims = (await auth.getUser(targetUid)).customClaims ?? {};
  await auth.setCustomUserClaims(targetUid, { ...existingClaims, teamRole: newRole });

  return { success: true };
});

// ── removeTeamMember ─────────────────────────────────────────────────────────

export const removeTeamMember = onCall({ cors: true }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required.');

  const callerUid = request.auth.uid;
  const teamId: string = (request.auth.token as any).teamId;
  if (!teamId) throw new HttpsError('failed-precondition', 'Not part of an enterprise team.');

  await assertManager(callerUid, teamId);

  const { targetUid }: { targetUid: string } = request.data;
  if (!targetUid) throw new HttpsError('invalid-argument', 'targetUid required.');

  const team = await getTeamOrThrow(teamId);
  if (targetUid === team.ownerId) {
    throw new HttpsError('failed-precondition', 'Cannot remove the billing owner from the team.');
  }

  // Block removing self if last manager
  if (targetUid === callerUid) {
    const membersSnap = await db.collection('teams').doc(teamId).collection('members').get();
    const managerCount = membersSnap.docs.filter((d) => d.data().teamRole === 'manager' && d.data().status === 'active').length;
    if (managerCount <= 1) {
      throw new HttpsError('failed-precondition', 'Cannot remove yourself — promote another manager first.');
    }
  }

  await db.collection('teams').doc(teamId).collection('members').doc(targetUid).delete();

  await db.collection('users').doc(targetUid).set(
    { teamId: null, teamRole: null, role: 'free', tier: 'free', updatedAt: new Date().toISOString() },
    { merge: true },
  );

  await auth.setCustomUserClaims(targetUid, { role: 'free', tier: 'free' });

  return { success: true };
});

// ── updateTeamSeats ──────────────────────────────────────────────────────────

export const updateTeamSeats = onCall({ cors: true }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required.');

  const uid = request.auth.uid;
  const teamId: string = (request.auth.token as any).teamId;
  if (!teamId) throw new HttpsError('failed-precondition', 'Not part of an enterprise team.');

  const team = await getTeamOrThrow(teamId);
  if (uid !== team.ownerId) {
    throw new HttpsError('permission-denied', 'Only the billing owner can change seat count.');
  }

  const { seats }: { seats: number } = request.data;
  if (!seats || typeof seats !== 'number') throw new HttpsError('invalid-argument', 'seats must be a number.');

  if (seats < MIN_SEATS) {
    throw new HttpsError('invalid-argument', `Minimum ${MIN_SEATS} seats required.`);
  }

  // Cannot reduce below current active member count
  const membersSnap = await db.collection('teams').doc(teamId).collection('members').get();
  const activeCount = membersSnap.docs.filter((d) => d.data().status === 'active').length;
  if (seats < activeCount) {
    throw new HttpsError(
      'failed-precondition',
      `Cannot reduce to ${seats} seats — ${activeCount} active members. Remove members first.`,
    );
  }

  const stripe = getStripe();
  // Retrieve the subscription to get the item ID
  const subscription = await stripe.subscriptions.retrieve(team.stripeSubscriptionId);
  const itemId = subscription.items.data[0]?.id;
  if (!itemId) throw new HttpsError('internal', 'Could not find subscription item.');

  await stripe.subscriptions.update(team.stripeSubscriptionId, {
    items: [{ id: itemId, quantity: seats }],
    proration_behavior: 'always_invoice',
  });

  // seats field updated by webhook on subscription.updated
  return { success: true, seats };
});

// ── resendTeamInvite ─────────────────────────────────────────────────────────

export const resendTeamInvite = onCall({ cors: true, secrets: ['RESEND_API_KEY'] }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required.');

  const callerUid = request.auth.uid;
  const teamId: string = (request.auth.token as any).teamId;
  if (!teamId) throw new HttpsError('failed-precondition', 'Not part of an enterprise team.');

  await assertManager(callerUid, teamId);

  const { inviteEmail }: { inviteEmail: string } = request.data;
  if (!inviteEmail) throw new HttpsError('invalid-argument', 'inviteEmail required.');

  const membersSnap = await db
    .collection('teams')
    .doc(teamId)
    .collection('members')
    .where('email', '==', inviteEmail)
    .where('status', '==', 'invited')
    .limit(1)
    .get();

  if (membersSnap.empty) throw new HttpsError('not-found', 'No pending invite found for this email.');

  const memberRef = membersSnap.docs[0].ref;
  const memberData = membersSnap.docs[0].data();
  const newToken = randomBytes(32).toString('hex');

  await memberRef.update({ inviteToken: newToken });

  const callerRecord = await auth.getUser(callerUid);
  const inviterName = callerRecord.displayName || callerRecord.email?.split('@')[0] || 'Your team manager';
  const acceptUrl = `${FRONTEND_URL}/invite/accept?token=${newToken}`;

  await sendReactEmail({
    to: inviteEmail,
    subject: `${inviterName} re-sent your DealEcho Enterprise invite`,
    component: React.createElement(TeamInviteEmail, {
      inviterName,
      teamRole: memberData.teamRole,
      acceptUrl,
      recipientEmail: inviteEmail,
    }),
  });

  return { success: true };
});

// ── cancelPendingInvite ──────────────────────────────────────────────────────

export const cancelPendingInvite = onCall({ cors: true }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required.');

  const callerUid = request.auth.uid;
  const teamId: string = (request.auth.token as any).teamId;
  if (!teamId) throw new HttpsError('failed-precondition', 'Not part of an enterprise team.');

  await assertManager(callerUid, teamId);

  const { inviteEmail }: { inviteEmail: string } = request.data;
  if (!inviteEmail) throw new HttpsError('invalid-argument', 'inviteEmail required.');

  const membersSnap = await db
    .collection('teams')
    .doc(teamId)
    .collection('members')
    .where('email', '==', inviteEmail)
    .where('status', '==', 'invited')
    .limit(1)
    .get();

  if (membersSnap.empty) throw new HttpsError('not-found', 'No pending invite found for this email.');

  await membersSnap.docs[0].ref.delete();

  return { success: true };
});
