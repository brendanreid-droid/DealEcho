import Stripe from 'stripe';

export const getStripe = () => {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is not configured');
  return new Stripe(key, { apiVersion: '2025-01-27.acacia' as any });
};

// deploy trigger: rebuild after clearing stuck secret bindings
