import { setGlobalOptions } from "firebase-functions/v2";
import { onCall } from "firebase-functions/v2/https";
import { backfillUserEmails as _backfillUserEmails } from "./maintenance/backfillUserEmails";
// Callable backfill function for admin use
export const backfillUserEmails = onCall({}, async (request) => {
  await _backfillUserEmails();
  console.log('✅ backfillUserEmails executed');
  return { status: "ok" };
});

// Set global region to Sydney (aligns with Firestore)
setGlobalOptions({ region: "australia-southeast1" });

// Re-export all Cloud Functions
export { createCheckoutSession, cancelSubscription, createEnterpriseCheckout } from "./checkout";
export { stripeWebhook, getWebhookDebugLogs } from "./webhook";
export {
  adminGetUsers,
  adminSetRole,
  adminDeleteContent,
  adminEditContent,
  adminGetPricing,
  adminUpdatePricing,
  adminCreateUser,
  adminToggleUserSuspension,
  adminDeleteUser,
  adminSendNewsletter,
} from "./admin";
// export { moderateNewReview } from "./moderation";
export { onReviewWritten } from "./reviewModeration";
export { searchCompanyEntities, getAICompanyPersona } from "./searchCompanies";

// Automated Lifecycle Email Triggers (Resend)
export { sendWelcomeEmail } from "./triggers/welcomeTrigger";
export { onReviewCreated } from "./triggers/onReviewCreated";
export { checkInactiveUsers } from "./triggers/inactivityTrigger";

// Notification Preferences
export { updateNotificationPreferences } from "./notifications";

// Newsletter Tracking
export { trackNewsletterOpen } from "./triggers/trackNewsletterOpen";

// Custom Auth Handlers
export { sendCustomPasswordResetEmail } from "./authCustom";

// Enterprise Team Management
export {
  inviteTeamMember,
  acceptTeamInvite,
  updateTeamMemberRole,
  removeTeamMember,
  updateTeamSeats,
  resendTeamInvite,
  cancelPendingInvite,
} from './enterprise';






