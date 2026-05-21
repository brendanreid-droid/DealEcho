import { setGlobalOptions } from "firebase-functions/v2";

// Set global region to Sydney (aligns with Firestore)
setGlobalOptions({ region: "australia-southeast1" });

// Re-export all Cloud Functions
export { createCheckoutSession, cancelSubscription } from "./checkout";
export { stripeWebhook, getWebhookDebugLogs } from "./webhook";
export {
  adminGetUsers,
  adminSetRole,
  adminDeleteContent,
  adminEditContent,
  adminGetPricing,
  adminUpdatePricing,
} from "./admin";
export { moderateNewReview } from "./moderation";

// Automated Lifecycle Email Triggers (Resend)
export { sendWelcomeEmail } from "./triggers/welcomeTrigger";
export { onReviewStatusApproved } from "./triggers/trackedAlertTrigger";
export { checkInactiveUsers } from "./triggers/inactivityTrigger";

