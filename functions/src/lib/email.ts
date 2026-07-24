import { Resend } from "resend";
import { render } from "@react-email/render";
import * as React from "react";

interface SendEmailParams {
  to: string;
  subject: string;
  component: React.ReactElement;
  from?: string;
}

export async function sendReactEmail({
  to,
  subject,
  component,
  from = "dealecho <no-reply@dealecho.io>",
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

    const response = await resend.emails.send({
      from,
      to,
      subject,
      html,
      text,
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
