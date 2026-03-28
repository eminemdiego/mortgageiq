import { Resend } from "resend";

const FROM_ADDRESS = "Mortgage AI Calc <noreply@mortgageaicalc.co.uk>";

let resendClient = null;

function getResend() {
  if (!resendClient) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY not configured");
    }
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

export async function sendEmail({ to, subject, html }) {
  const resend = getResend();

  const response = await resend.emails.send({
    from: FROM_ADDRESS,
    to,
    subject,
    html,
  });

  if (response.error) {
    console.error("Resend error:", response.error);
    throw new Error(response.error.message || "Failed to send email");
  }

  return response.data;
}

export function buildPasswordResetEmail(resetLink) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background: #F4F4F5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 480px; margin: 0 auto; padding: 48px 24px;">
    <!-- Logo -->
    <div style="text-align: center; margin-bottom: 32px;">
      <div style="display: inline-block; width: 48px; height: 48px; border-radius: 12px; background: linear-gradient(135deg, #6366F1, #4F46E5); line-height: 48px; text-align: center; font-size: 22px; color: white; font-weight: bold;">M</div>
    </div>

    <!-- Card -->
    <div style="background: white; border-radius: 16px; border: 1px solid #E5E7EB; padding: 36px 32px; text-align: center;">
      <h1 style="font-size: 22px; font-weight: 700; color: #111827; margin: 0 0 12px;">Reset your password</h1>
      <p style="font-size: 14px; color: #6B7280; margin: 0 0 28px; line-height: 1.6;">
        We received a request to reset the password for your Mortgage AI Calc account. Click the button below to choose a new password.
      </p>

      <!-- Button -->
      <a href="${resetLink}" style="display: inline-block; padding: 14px 40px; background: #4F46E5; color: white; text-decoration: none; border-radius: 10px; font-weight: 600; font-size: 15px; letter-spacing: 0.2px;">Reset Password</a>

      <p style="font-size: 13px; color: #9CA3AF; margin: 24px 0 0; line-height: 1.5;">
        This link expires in <strong style="color: #6B7280;">1 hour</strong>. If you didn't request this, you can safely ignore this email — your password won't change.
      </p>
    </div>

    <!-- Footer -->
    <div style="text-align: center; margin-top: 24px;">
      <p style="font-size: 12px; color: #9CA3AF; margin: 0 0 4px;">Can't click the button? Copy this link into your browser:</p>
      <p style="font-size: 11px; color: #6366F1; word-break: break-all; margin: 0;">${resetLink}</p>
    </div>
    <div style="text-align: center; margin-top: 24px; padding-top: 20px; border-top: 1px solid #E5E7EB;">
      <p style="font-size: 11px; color: #D1D5DB; margin: 0;">Mortgage AI Calc &mdash; mortgageaicalc.co.uk</p>
    </div>
  </div>
</body>
</html>`;
}
