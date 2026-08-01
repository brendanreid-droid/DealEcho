import { Resend } from "resend";
import { render } from "@react-email/render";
import * as React from "react";
import { APP_URL } from "./constants";

/**
 * Sender identity.
 *
 * Not "no-reply": mailbox providers score no-reply senders lower, and it denies
 * the recipient the single strongest positive signal they can give us - a
 * reply. Resend's own deliverability check flags it. support@ is a real
 * monitored alias, so replies land somewhere a human reads.
 */
const DEFAULT_FROM = "Dealecho <support@dealecho.io>";
const REPLY_TO = "support@dealecho.io";

interface SendEmailParams {
  to: string;
  subject: string;
  component: React.ReactElement;
  from?: string;
  /**
   * Recipient identity for one-click unsubscribe. Supply on BULK mail
   * (newsletters, digests). Omit on transactional mail - a password reset has
   * nothing to unsubscribe from, and offering it there is misleading.
   */
  unsubscribe?: { email: string; uid?: string };
}

export async function sendReactEmail({
  to,
  subject,
  component,
  from = DEFAULT_FROM,
  unsubscribe,
}: SendEmailParams) {
  try {
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      console.warn("⚠️ Warning: RESEND_API_KEY environment variable is not set. Attempting mock Resend send.");
    }
    const resend = new Resend(resendApiKey || "mock-resend-key");

    // Compile React Email component into an HTML string plus a plain-text
    // alternative. Sending both improves deliverability and covers clients
    // that refuse to render HTML.
    const html = await render(component);
    const text = await render(component, { plainText: true });

    /**
     * List-Unsubscribe with one-click. Gmail and Yahoo have required this of
     * bulk senders since 2024, and missing it damages the reputation of the
     * whole sending domain - transactional mail included, which is why it
     * matters even though most of ours is transactional.
     *
     * The POST variant is what makes it one-click; without it, clients fall
     * back to the mailto/URL and many simply do not show the button.
     */
    const headers: Record<string, string> = {};
    if (unsubscribe) {
      const url = `${APP_URL}/unsubscribe?email=${encodeURIComponent(unsubscribe.email)}&uid=${encodeURIComponent(unsubscribe.uid ?? "")}`;
      headers["List-Unsubscribe"] = `<${url}>`;
      headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
    }

    const response = await resend.emails.send({
      from,
      to,
      subject,
      html,
      text,
      replyTo: REPLY_TO,
      ...(Object.keys(headers).length ? { headers } : {}),
    });
    
    if (response.error) {
      console.error(`❌ Resend SDK returned an error sending to ${to}:`, response.error);
      throw response.error;
    }
    
    console.log(`✅ Automated email dispatched to ${to}. Message ID: ${response.data?.id}`);
    return response.data;
  } catch (error) {
    console.error(`❌ Failed to send automated email to ${to}:`, error);
    throw error;
  }
}
