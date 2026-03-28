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

export function buildWelcomeEmail(firstName) {
  const greeting = firstName ? `Welcome, ${firstName}!` : "Welcome!";
  const siteUrl = process.env.NEXTAUTH_URL || "https://mortgageaicalc.co.uk";

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background: #F4F4F5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 520px; margin: 0 auto; padding: 48px 24px;">
    <!-- Logo -->
    <div style="text-align: center; margin-bottom: 32px;">
      <div style="display: inline-block; width: 48px; height: 48px; border-radius: 12px; background: linear-gradient(135deg, #6366F1, #4F46E5); line-height: 48px; text-align: center; font-size: 22px; color: white; font-weight: bold;">M</div>
    </div>

    <!-- Card -->
    <div style="background: white; border-radius: 16px; border: 1px solid #E5E7EB; padding: 36px 32px;">
      <h1 style="font-size: 24px; font-weight: 700; color: #111827; margin: 0 0 16px; text-align: center;">${greeting}</h1>
      <p style="font-size: 14px; color: #6B7280; margin: 0 0 24px; line-height: 1.7;">
        Thanks for creating your Mortgage AI Calc account. You now have access to powerful tools that can help you understand your mortgage and save thousands in interest.
      </p>

      <!-- Features -->
      <div style="margin-bottom: 28px;">
        <div style="display: flex; align-items: flex-start; gap: 12px; margin-bottom: 16px;">
          <div style="min-width: 28px; height: 28px; border-radius: 8px; background: #EEF2FF; text-align: center; line-height: 28px; font-size: 14px;">📄</div>
          <div>
            <p style="font-size: 14px; font-weight: 600; color: #111827; margin: 0 0 2px;">Upload your mortgage statement</p>
            <p style="font-size: 13px; color: #9CA3AF; margin: 0;">Our AI extracts all the details instantly — no manual entry needed.</p>
          </div>
        </div>
        <div style="display: flex; align-items: flex-start; gap: 12px; margin-bottom: 16px;">
          <div style="min-width: 28px; height: 28px; border-radius: 8px; background: #EEF2FF; text-align: center; line-height: 28px; font-size: 14px;">💰</div>
          <div>
            <p style="font-size: 14px; font-weight: 600; color: #111827; margin: 0 0 2px;">See exactly how much interest you'll pay</p>
            <p style="font-size: 13px; color: #9CA3AF; margin: 0;">Get a clear breakdown and discover how overpayments could save you thousands.</p>
          </div>
        </div>
        <div style="display: flex; align-items: flex-start; gap: 12px; margin-bottom: 16px;">
          <div style="min-width: 28px; height: 28px; border-radius: 8px; background: #EEF2FF; text-align: center; line-height: 28px; font-size: 14px;">🏠</div>
          <div>
            <p style="font-size: 14px; font-weight: 600; color: #111827; margin: 0 0 2px;">Portfolio Manager for landlords</p>
            <p style="font-size: 13px; color: #9CA3AF; margin: 0;">Track rental properties, cash flow, yields, and tenancy dates in one place.</p>
          </div>
        </div>
        <div style="display: flex; align-items: flex-start; gap: 12px;">
          <div style="min-width: 28px; height: 28px; border-radius: 8px; background: #EEF2FF; text-align: center; line-height: 28px; font-size: 14px;">🤖</div>
          <div>
            <p style="font-size: 14px; font-weight: 600; color: #111827; margin: 0 0 2px;">AI-powered recommendations</p>
            <p style="font-size: 13px; color: #9CA3AF; margin: 0;">Personalised strategies tailored to your specific mortgage situation.</p>
          </div>
        </div>
      </div>

      <!-- CTA -->
      <div style="text-align: center; margin-bottom: 28px;">
        <a href="${siteUrl}" style="display: inline-block; padding: 14px 40px; background: #4F46E5; color: white; text-decoration: none; border-radius: 10px; font-weight: 600; font-size: 15px; letter-spacing: 0.2px;">Get Started</a>
      </div>

      <!-- Sign-off -->
      <div style="border-top: 1px solid #F3F4F6; padding-top: 20px;">
        <p style="font-size: 14px; color: #6B7280; margin: 0; line-height: 1.6;">
          Many thanks,<br />
          <strong style="color: #111827;">Dr. Ahmed Sarwar</strong>
        </p>
      </div>
    </div>

    <!-- Footer -->
    <div style="text-align: center; margin-top: 24px; padding-top: 20px;">
      <p style="font-size: 11px; color: #D1D5DB; margin: 0;">Mortgage AI Calc &mdash; mortgageaicalc.co.uk</p>
    </div>
  </div>
</body>
</html>`;
}

export function buildCertificateAlertEmail(alerts) {
  const siteUrl = process.env.NEXTAUTH_URL || "https://mortgageaicalc.co.uk";
  const expired = alerts.filter(a => a.status === "expired");
  const expiring = alerts.filter(a => a.status === "expiring");

  const rows = alerts.map(a => {
    const color = a.status === "expired" ? "#EF4444" : "#F59E0B";
    const bg = a.status === "expired" ? "#FEE2E2" : "#FEF3C7";
    const label = a.status === "expired" ? "EXPIRED" : "EXPIRING SOON";
    return `
      <tr>
        <td style="padding: 12px 16px; border-bottom: 1px solid #F3F4F6; font-size: 14px; color: #374151;">${a.address}</td>
        <td style="padding: 12px 16px; border-bottom: 1px solid #F3F4F6; font-size: 14px; color: #374151;">${a.certLabel}</td>
        <td style="padding: 12px 16px; border-bottom: 1px solid #F3F4F6; font-size: 14px; color: #6B7280;">${a.expiryDate}</td>
        <td style="padding: 12px 16px; border-bottom: 1px solid #F3F4F6;">
          <span style="padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; background: ${bg}; color: ${color};">${label}</span>
        </td>
      </tr>`;
  }).join("");

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background: #F4F4F5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 48px 24px;">
    <div style="text-align: center; margin-bottom: 32px;">
      <div style="display: inline-block; width: 48px; height: 48px; border-radius: 12px; background: linear-gradient(135deg, #6366F1, #4F46E5); line-height: 48px; text-align: center; font-size: 22px; color: white; font-weight: bold;">M</div>
    </div>
    <div style="background: white; border-radius: 16px; border: 1px solid #E5E7EB; padding: 36px 32px;">
      <h1 style="font-size: 22px; font-weight: 700; color: #111827; margin: 0 0 8px;">Compliance Certificate Alert</h1>
      <p style="font-size: 14px; color: #6B7280; margin: 0 0 24px; line-height: 1.6;">
        ${expired.length > 0 ? `<strong style="color: #EF4444;">${expired.length} certificate${expired.length > 1 ? "s" : ""} expired.</strong> ` : ""}${expiring.length > 0 ? `<strong style="color: #F59E0B;">${expiring.length} certificate${expiring.length > 1 ? "s" : ""} expiring within 30 days.</strong>` : ""}
      </p>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
        <thead><tr style="background: #F9FAFB;">
          <th style="padding: 10px 16px; text-align: left; font-size: 11px; color: #6B7280; text-transform: uppercase; font-weight: 600;">Property</th>
          <th style="padding: 10px 16px; text-align: left; font-size: 11px; color: #6B7280; text-transform: uppercase; font-weight: 600;">Certificate</th>
          <th style="padding: 10px 16px; text-align: left; font-size: 11px; color: #6B7280; text-transform: uppercase; font-weight: 600;">Expiry</th>
          <th style="padding: 10px 16px; text-align: left; font-size: 11px; color: #6B7280; text-transform: uppercase; font-weight: 600;">Status</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div style="text-align: center; margin-bottom: 24px;">
        <a href="${siteUrl}/portfolio" style="display: inline-block; padding: 14px 40px; background: #4F46E5; color: white; text-decoration: none; border-radius: 10px; font-weight: 600; font-size: 15px;">View Portfolio</a>
      </div>
      <div style="border-top: 1px solid #F3F4F6; padding-top: 20px;">
        <p style="font-size: 14px; color: #6B7280; margin: 0; line-height: 1.6;">Many thanks,<br /><strong style="color: #111827;">Dr. Ahmed Sarwar</strong></p>
      </div>
    </div>
    <div style="text-align: center; margin-top: 24px;">
      <p style="font-size: 11px; color: #D1D5DB; margin: 0;">Mortgage AI Calc &mdash; mortgageaicalc.co.uk</p>
    </div>
  </div>
</body>
</html>`;
}
