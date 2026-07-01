import Stripe from 'stripe';
import { defineSecret } from 'firebase-functions/params';

export const STRIPE_SECRET_KEY = defineSecret('STRIPE_SECRET_KEY');

export const getStripe = () => {
  const key = STRIPE_SECRET_KEY.value() || process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is not configured');
  return new Stripe(key, { apiVersion: '2025-01-27.acacia' as any });
};
