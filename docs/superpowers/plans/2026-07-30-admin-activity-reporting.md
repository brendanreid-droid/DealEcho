# Admin activity reporting

**Date:** 2026-07-30
**Status:** draft - blocked until the v0.1.2 extension review clears (touches `functions/`)

## What this is for

GA4 and Vercel already answer the anonymous questions - how much traffic, from
where, which pages, how fast. Neither can answer anything that needs to be
joined to a Dealecho account, because GA4 cannot see Firestore and Vercel does
not know who anyone is.

So this is deliberately NOT a dashboard of pageviews. It is the set of
questions only you can answer:

1. **Who is actually using it?** Weekly and monthly active accounts, split by
   tier. A paid account that has not signed in for three weeks is a renewal
   risk, and nothing currently surfaces that.
2. **Is the give-to-get loop working?** Reviews submitted per week, how many
   clear moderation, and what share of signups ever write one. The unlock is a
   core mechanic and its conversion rate is currently unknown.
3. **Where is the content gap?** Companies searched for that have no reviews
   behind them. This is the single most commercially useful number in the
   product - it says what to seed next, and no third-party tool can produce it.
4. **What does onboarding actually complete?** The checklist has four steps and
   fires `onboarding_step_click`; nothing reports which step people abandon.
5. **Revenue movement.** Trials started, converted, cancelled, retention offers
   accepted. Partly in Stripe, but not joined to activity.

## What already exists

Worth reusing rather than rebuilding:

- `recordActivity` (`functions/src/marketing.ts:177`) already writes
  `behavior.searches`, `behavior.profileViews`, `behavior.industries{}` and
  `behavior.lastActiveAt` onto each user doc. Question 1 is mostly a read away.
- `adminGetAcquisitionReport` (`functions/src/marketing.ts:388`) already does
  attribution rollups, and the Admin panel has a `marketing` tab rendering
  `AcquisitionRow` / `CampaignRollup` / `RegionRollup`.
- `runHealthCheck` + `adminGetHealthReport` establish the pattern for a
  scheduled job writing a document the admin panel reads.
- `track()` fires 11 event types from 16 call sites, including
  `onboarding_step_click`, `review_submitted`, `begin_checkout`.

## The blocker to fix first

`adminGetAcquisitionReport` calls `auth.listUsers(1000)` and then issues **one
Firestore read per user**. At 3 users that is invisible. At 1,000 it is 1,000
reads per report load, and at 1,001 it silently truncates - the report starts
being wrong with no error.

Every question above is an aggregate over all users, so building more reports
on that pattern multiplies the problem. Fix the shape before adding reports:

- A scheduled daily job (mirroring `runHealthCheck`) rolls up counters into
  `admin_metrics/{YYYY-MM-DD}`.
- Admin callables read those documents - a handful of reads per load,
  regardless of user count.
- Daily snapshots give history for free, which per-request aggregation cannot:
  "active accounts this week vs last" needs yesterday's number to have been
  recorded at the time.

## Proposed shape

### 1. Daily rollup job

`functions/src/monitoring/rollupMetrics.ts`, scheduled daily, writing
`admin_metrics/{date}`:

```
{
  date: "2026-07-30",
  users: { total, byTier: { free, paid_monthly, paid_annual, enterprise } },
  active: { last7, last30 },            // from behavior.lastActiveAt
  reviews: { total, submitted7, approved7, rejected7 },
  reviewers: { everWritten, share },     // give-to-get conversion
  companies: { withReviews, searchedNoReviews },
  revenue: { trialing, active, cancelled7, retentionAccepted7 }
}
```

Scheduled rather than on-demand because these are trend questions. A number
without yesterday's number beside it does not tell you anything.

### 2. Search-gap tracking

The highest-value item, and the only one needing new capture. `recordActivity`
already receives searches but stores only a count. Extend it to record the
searched *term* when it resolved to no company, into
`search_gaps/{normalisedTerm}` with a hit counter and `lastSearchedAt`.

Guard rails, since this is user-supplied text: normalise and length-cap it, do
not store the searcher's uid against it, and cap total distinct documents the
same way `MAX_INDUSTRY_KEYS` caps the industries map. A search term is
effectively free text from the public - treat it as such.

### 3. Admin "Activity" tab

New `Tab` alongside the existing seven in `pages/Admin.tsx`. Reads the latest
`admin_metrics` doc plus the previous one for deltas. Sections mapping to the
five questions, each showing the number, the change since the last period, and
nothing else. Resist charts until there is enough history for a chart to mean
something.

## Sequencing

1. Rollup job + `admin_metrics` (nothing user-visible yet; lets a week of
   history accumulate before the UI exists, so the tab launches with deltas
   rather than blanks).
2. Search-gap capture - independent, and the sooner it starts the sooner the
   data is useful.
3. Admin tab reading both.
4. Only then, migrate `adminGetAcquisitionReport` onto the same rollup so the
   N+1 disappears.

## Deliberately out of scope

- Rebuilding what GA4 and Vercel already do. No pageview counts here.
- Per-user activity timelines. Useful for support, but it is a different
  feature with a different privacy conversation - reviews are pseudonymous by
  design and an admin-visible per-user trail cuts against that.
- Charting libraries. Numbers with deltas first.
- Exposing any of this outside the admin role.

## CI note

Every new callable and scheduled function must be added to the explicit
`--only` list in `.github/workflows/deploy-functions.yml`, or it deploys as
nothing and 404s in a way the browser reports as CORS.
