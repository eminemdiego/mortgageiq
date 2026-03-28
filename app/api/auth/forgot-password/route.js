import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import crypto from "crypto";

export async function POST(request) {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
      return new Response(
        JSON.stringify({ error: "Database not configured" }),
        { status: 500 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    const { email } = await request.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        { status: 400 }
      );
    }

    // Always return success to avoid revealing whether the email exists
    const successResponse = new Response(
      JSON.stringify({ message: "If an account exists with that email, a reset link has been sent." }),
      { status: 200 }
    );

    // Look up the user
    const { data: user } = await supabase
      .from("users")
      .select("id, auth_provider")
      .eq("email", email)
      .single();

    // If no user or they signed up with Google, silently succeed
    if (!user || user.auth_provider === "google") {
      return successResponse;
    }

    // Generate a secure token
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

    // Store the token — clear any existing tokens for this user first
    await supabase
      .from("password_reset_tokens")
      .delete()
      .eq("user_id", user.id);

    const { error: insertError } = await supabase
      .from("password_reset_tokens")
      .insert({
        user_id: user.id,
        token,
        expires_at: expiresAt,
      });

    if (insertError) {
      console.error("Token insert error:", insertError);
      return new Response(
        JSON.stringify({ error: "Something went wrong. Please try again." }),
        { status: 500 }
      );
    }

    // Send the reset email
    if (process.env.RESEND_API_KEY) {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const baseUrl = process.env.NEXTAUTH_URL || "https://mortgageaicalc.co.uk";
      const resetLink = `${baseUrl}/auth/reset-password?token=${token}`;

      await resend.emails.send({
        from: "Mortgage AI Calc <noreply@mortgageaicalc.co.uk>",
        to: email,
        subject: "Reset your password — Mortgage AI Calc",
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
            <div style="margin-bottom: 32px;">
              <h1 style="font-size: 24px; font-weight: 700; color: #111; margin: 0 0 8px;">Reset your password</h1>
              <p style="font-size: 14px; color: #666; margin: 0;">We received a request to reset your password for your Mortgage AI Calc account.</p>
            </div>
            <a href="${resetLink}" style="display: inline-block; padding: 12px 32px; background: linear-gradient(135deg, #6366F1, #4F46E5); color: white; text-decoration: none; border-radius: 10px; font-weight: 600; font-size: 14px;">Reset Password</a>
            <p style="font-size: 13px; color: #999; margin-top: 24px;">This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
            <p style="font-size: 12px; color: #CCC; margin-top: 32px; border-top: 1px solid #EEE; padding-top: 16px;">Mortgage AI Calc — mortgageaicalc.co.uk</p>
          </div>
        `,
      });
    }

    return successResponse;
  } catch (error) {
    console.error("Forgot password error:", error);
    return new Response(
      JSON.stringify({ error: "Something went wrong. Please try again." }),
      { status: 500 }
    );
  }
}
