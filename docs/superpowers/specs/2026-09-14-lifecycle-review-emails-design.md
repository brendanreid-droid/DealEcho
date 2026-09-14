# Lifecycle review emails - design

Date: 2026-09-14

## Goal

Two new automated emails that drive review submissions:

1. **Day-2 signup nudge** - a user who signs up and does nothing for two days gets
   one prompt to log in and review deals from their last quarter (won, lost or
   ongoing).
2. **Monthly review prompt** - near the end of every month, every registered user
   (free, paid, admin) gets a prompt to review the deals they worked that month.
   Three copy variants rotate so the mail does not look identical month to month.

## Why the recipient list comes from Firebase Auth

Firestore `users/{uid}` docs are created lazily, so the collection is not a
complete register of users. Firebase Auth is. Auth also carries the only signup
timestamp we have (`metadata.creationTime`); nothing writes `createdAt` onto the
user doc.

Absence cannot be queried in Firestore either: a user with zero activity has no
`behavior` map at all, so `where("behavior.lastActiveAt", "==", null)` returns
nothing. Selection therefore happens in memory over a full list.

`loadRecipients()` (`functions/src/lib/recipients.ts`) pages `auth.listUsers()`,
reads the `users` collection once, and joins them into a flat `Recipient`.

## Selection rules (pure, unit tested)

`functions/src/lib/lifecycle.ts` holds the logic with no I/O.

**Marketable**: has a valid email, `suspended !== true`, and
`notificationPreferences.weeklyDigest !== false`. Both emails are bulk marketing,
so both honour the newsletter opt-out and both ship `List-Unsubscribe` headers.

**Signup nudge targets**: marketable, account age between 2 and 7 days, no
activity since signup (`behavior.lastActiveAt` absent or not later than
`creationTime`), and `signupNudgeSentAt` unset. The 7-day ceiling bounds the
blast radius on first deploy while letting a missed cron run self-heal the next
day.

**Monthly targets**: marketable and `monthlyPromptSentAt !== <current month key>`.

**Variant**: `(year * 12 + month) % 3` in UTC. Deterministic, no per-user state,
cycles A/B/C and back.

## Schedules

- `sendSignupNudges` - `0 9 * * *`, Australia/Sydney.
- `sendMonthlyReviewPrompt` - `0 9 25 * *`, Australia/Sydney. The 25th is safe in
  February and lands before the end-of-month scramble.

Both write their sent-marker to the user doc *before* dispatching, the same race
guard `checkInactiveUsers` already uses, and both fan out in batches of 10 like
`adminSendNewsletter`.

## Copy

- `emails/FirstReviewNudgeEmail.tsx` - single template.
- `emails/MonthlyReviewPromptEmail.tsx` - one template plus a `MONTHLY_VARIANTS`
  table holding subject, preheader, heading, body and CTA label for each of the
  three angles: reciprocity, recall decay, and month-end post mortem.

## Preview

`adminPreviewLifecycleEmail({ template, variant, testEmail })` - admin only,
sends one `[TEST]`-prefixed copy so any variant can be checked without waiting
for its month to come round.

## Bug fixed alongside

`triggers/inactivityTrigger.ts` queried `lastActive`. No code writes that field;
the real one is `behavior.lastActiveAt`. The 30-day re-engagement cron has been
matching zero users since it shipped.

## Deploy

Both new schedulers and the preview callable must be added to an explicit
`--only` list in `.github/workflows/deploy-functions.yml`, or CI will never
deploy them.
