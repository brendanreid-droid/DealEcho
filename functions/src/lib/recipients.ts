import { auth, db } from "./firebaseAdmin";
import type { Recipient } from "./lifecycle";

/**
 * Builds the full register of users for the lifecycle emails.
 *
 * Firebase Auth is the source of truth, not the `users` collection: Firestore
 * profile docs are written lazily, so the collection misses anyone who has not
 * yet tripped a write, and Auth holds the only signup timestamp we have.
 * The `users` collection is read once and joined in memory rather than fetched
 * per uid.
 */
export async function loadRecipients(): Promise<Recipient[]> {
  const profiles = new Map<string, Record<string, any>>();
  const usersSnap = await db.collection("users").get();
  usersSnap.docs.forEach((d) => profiles.set(d.id, d.data() ?? {}));

  const recipients: Recipient[] = [];
  let pageToken: string | undefined;

  do {
    const page = await auth.listUsers(1000, pageToken);
    page.users.forEach((u) => {
      const fs = profiles.get(u.uid) ?? {};
      const email = (u.email || fs.email || "").trim();
      recipients.push({
        uid: u.uid,
        email,
        name: u.displayName || fs.name || "there",
        createdAt: u.metadata.creationTime
          ? new Date(u.metadata.creationTime).toISOString()
          : "",
        lastActiveAt: (fs.behavior?.lastActiveAt as string) ?? "",
        suspended: fs.suspended === true || u.disabled === true,
        optedOutOfMarketing:
          fs.notificationPreferences?.weeklyDigest === false,
        signupNudgeSentAt: (fs.signupNudgeSentAt as string) ?? "",
        monthlyPromptSentAt: (fs.monthlyPromptSentAt as string) ?? "",
        lastNudgedAt: (fs.lastNudgedAt as string) ?? "",
      });
    });
    pageToken = page.pageToken;
  } while (pageToken);

  return recipients;
}

/**
 * Stamps the send marker on the user doc. Written BEFORE the mail goes out, so
 * a crash mid-batch or an overlapping cron run can never double-send. Merges,
 * which creates the profile doc for users who do not have one yet.
 *
 * Deliberately writes nothing but the marker: user docs do not carry email or
 * name by design.
 */
export async function markSent(
  uid: string,
  field: "signupNudgeSentAt" | "monthlyPromptSentAt" | "lastNudgedAt",
  value: string,
): Promise<void> {
  await db.collection("users").doc(uid).set({ [field]: value }, { merge: true });
}
