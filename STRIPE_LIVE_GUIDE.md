# Stripe Live Mode — Setup Guide

This guide walks you through switching DealEcho from Stripe **test mode** to **live mode** for real payments.

---

## Prerequisites

- A verified Stripe account at [https://dashboard.stripe.com](https://dashboard.stripe.com)
- Firebase CLI installed and logged in
- Access to the project's `functions/.env` file

---

## Step 1: Get Your Live API Key

1. Go to [Stripe Dashboard → Developers → API Keys](https://dashboard.stripe.com/apikeys)
2. Make sure the **"Test mode"** toggle at the top is **OFF** (you should see "Live mode")
3. Copy your **Secret key** — it starts with `sk_live_...`

> ⚠️ Never share or commit your secret key publicly.

---

## Step 2: Update `functions/.env`

Open the file `functions/.env` in the project and update these values:

```env
STRIPE_SECRET_KEY=sk_live_YOUR_LIVE_SECRET_KEY_HERE
STRIPE_MONTHLY_PRICE_ID=price_XXXXXXXX
STRIPE_ANNUAL_PRICE_ID=price_XXXXXXXX
FRONTEND_URL=https://your-production-domain.com
```

### About Price IDs

You have **two options** for setting price IDs:

**Option A — Use the Admin Panel (Recommended):**
After deploying with the live secret key, go to the Admin Panel → **Pricing tab** → set your monthly and annual prices → click **"Update Prices"**. This automatically creates Stripe price objects and saves them to Firestore. The env var price IDs become fallbacks only.

**Option B — Create Manually in Stripe:**

1. Go to Stripe Dashboard → **Products**
2. Create a product called "Sales Pro Intel"
3. Add two prices:
   - Monthly recurring (e.g., AUD $15/month)
   - Annual recurring (e.g., AUD $144/year)
4. Copy both `price_...` IDs into `functions/.env`

---

## Step 3: Create a Live Webhook Endpoint

The webhook is how Stripe tells your app about successful payments, cancellations, etc.

1. Go to [Stripe Dashboard → Developers → Webhooks](https://dashboard.stripe.com/webhooks)
2. Click **"Add endpoint"**
3. Set the **Endpoint URL** to your Cloud Function URL:

   ```
   https://stripewebhook-zh6ryknuuq-ts.a.run.app
   ```

   (This is the same URL shown during `firebase deploy`)

4. Under **"Select events to listen to"**, add these events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`

5. Click **"Add endpoint"**
6. On the endpoint details page, click **"Reveal"** next to **Signing secret**
7. Copy the signing secret — it starts with `whsec_...`

---

## Step 4: Set the Webhook Secret in Firebase

The webhook secret is stored securely in Google Cloud Secret Manager (not in `.env`).

Run this command in the project root:

```bash
firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
```

When prompted, paste the `whsec_...` value you copied from Step 3.

To verify it was set correctly:

```bash
firebase functions:secrets:access STRIPE_WEBHOOK_SECRET
```

---

## Step 5: Deploy Everything

```bash
cd functions
npm run build
cd ..
firebase deploy --only functions
```

This deploys all cloud functions with the new live keys.

---

## Step 6: Update Frontend URL (if needed)

If your production domain is different from the current `FRONTEND_URL`, update it in `functions/.env`. This affects the Stripe checkout redirect URLs (success/cancel pages).

For example:

```env
FRONTEND_URL=https://dealecho.io
```

---

## Step 7: Verify Everything Works

### Test the Payment Flow

1. Visit your live pricing page
2. Click "Upgrade to Pro"
3. Complete checkout with a **real card** (you will be charged)
4. Verify in Stripe Dashboard → **Payments** that the payment appears in **live mode**
5. Verify the user's role changes to "paid" in the Admin Panel

### Test the Webhook

1. In Stripe Dashboard → Webhooks → your endpoint → **"Send test webhook"**
2. Check Firebase function logs:
   ```bash
   firebase functions:log --only stripeWebhook
   ```
3. Should show "WEBHOOK SUCCESS"

### Test Cancellation

1. As a paid user, go to My Intel page
2. Click "Cancel Subscription"
3. Verify in Stripe Dashboard that the subscription is cancelled
4. Verify in Admin Panel that the user role changes to "free"

### Test Dynamic Pricing

1. Go to Admin Panel → Pricing tab
2. Update the monthly/annual prices
3. Verify the public pricing page shows the new amounts

---

## Summary: What Gets Changed

| Item             | Location         | What to Change                              |
| ---------------- | ---------------- | ------------------------------------------- |
| Secret Key       | `functions/.env` | `sk_test_...` → `sk_live_...`               |
| Monthly Price ID | `functions/.env` | Update or use Admin panel                   |
| Annual Price ID  | `functions/.env` | Update or use Admin panel                   |
| Frontend URL     | `functions/.env` | Set to production domain                    |
| Webhook Secret   | Firebase Secrets | `whsec_...` from live webhook               |
| Webhook Endpoint | Stripe Dashboard | Create new endpoint with Cloud Function URL |

**No code changes are needed** — everything is configuration-driven.

---

## Troubleshooting

### Payment fails / CORS error

- Ensure the Cloud Run services allow public access (check Google Cloud Console → Cloud Run → each function → Security → "Allow unauthenticated invocations")

### Webhook not firing

- Check the webhook endpoint URL is correct in Stripe Dashboard
- Check logs: `firebase functions:log --only stripeWebhook`
- Verify the signing secret matches: `firebase functions:secrets:access STRIPE_WEBHOOK_SECRET`

### User role not updating after payment

- The webhook may take a few seconds to process
- Check the `webhooks_debug` collection in Firestore for error details
- Verify the `firebaseUID` metadata is being set on the Stripe customer/subscription

### Prices not showing on pricing page

- Ensure Firestore rules allow public read of the `config` collection
- Check the `config/pricing` document exists in Firestore after updating from admin panel

---

## Security Reminders

- ✅ `functions/.env` is in `.gitignore` — never committed
- ✅ `STRIPE_WEBHOOK_SECRET` is in Firebase Secret Manager
- ✅ The service account key (`service-account.json`) should never be committed publicly
- ❌ Never put `sk_live_...` in frontend code or public files
