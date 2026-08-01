import { APP_URL } from "./constants";

/**
 * Rewrite a Firebase action link so it points at our own domain.
 *
 * generatePasswordResetLink returns a URL on the Firebase-hosted handler
 * (dealecho-io-sales-intel-hub.firebaseapp.com). Sending that is a real
 * deliverability problem: the message comes from dealecho.io and its primary
 * button goes to a Google-owned domain the recipient has never seen, which is
 * the shape of a phishing email. Resend flags it explicitly.
 *
 * Firebase's own "custom action URL" setting cannot be used here - it requires
 * completing Auth's separate custom-domain verification (notification.sendEmail
 * .dnsInfo, currently NOT_STARTED), and both the console and the Admin API
 * refuse the change until then. Nothing about the oobCode requires Firebase's
 * handler though: it is just a one-time code, and any page holding it can call
 * verifyPasswordResetCode / confirmPasswordReset. So we host that page.
 *
 * Fails open: an unparseable link, or one with no oobCode, is returned
 * untouched. A recipient reaching Firebase's handler is a worse email, but a
 * recipient reaching nothing is a broken account.
 */
export function toOwnDomainActionLink(firebaseLink: string, path = "/reset"): string {
  try {
    const oobCode = new URL(firebaseLink).searchParams.get("oobCode");
    if (!oobCode) return firebaseLink;
    return `${APP_URL}${path}?oobCode=${encodeURIComponent(oobCode)}`;
  } catch {
    return firebaseLink;
  }
}
