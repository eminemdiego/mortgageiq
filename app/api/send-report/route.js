import { Resend } from "resend";
import { MortgageReportEmail } from "@/app/email-templates/mortgage-report";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request) {
  try {
    if (!process.env.RESEND_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        { status: 500 }
      );
    }

    const body = await request.json();
    const { recipientEmail, userName, form, analysis } = body;

    if (!recipientEmail || !form || !analysis) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipientEmail)) {
      return new Response(
        JSON.stringify({ error: "Invalid email address" }),
        { status: 400 }
      );
    }

    // Generate HTML email
    const htmlContent = MortgageReportEmail({ form, analysis });

    // Send email via Resend
    const response = await resend.emails.send({
      from: "MortgageIQ <noreply@mortgageiq.com>",
      to: recipientEmail,
      subject: `Your Mortgage Analysis Report - ${new Date().toLocaleDateString()}`,
      html: htmlContent,
      reply_to: "support@mortgageiq.com",
    });

    if (response.error) {
      console.error("Resend error:", response.error);
      return new Response(
        JSON.stringify({ error: "Failed to send email" }),
        { status: 500 }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Report sent to ${recipientEmail}`,
        id: response.data?.id,
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error("Email sending error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to send email. Please try again." }),
      { status: 500 }
    );
  }
}
