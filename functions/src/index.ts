import { setGlobalOptions } from 'firebase-functions/v2';

// Set global region to Sydney (aligns with Firestore)
setGlobalOptions({ region: 'australia-southeast1' });

// Re-export all Cloud Functions
export { createCheckoutSession } from './checkout';
export { stripeWebhook, getWebhookDebugLogs } from './webhook';
export { adminGetUsers, adminSetRole, adminDeleteContent, adminEditContent } from './admin';
