import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { sendEmail, buildPasswordResetEmail } from "@/app/lib/email";

// In-memory rate limit: max 3 requests per email per hour
const rateLimitMap = new Map();
const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour

function isRateLimited(email) {
  const key = email.toLowerCase();
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry) {
    rateLimitMap.set(key, { count: 1, windowStart: now });
    return false;
  }

  // Reset window if expired
  if (now - entry.windowStart > RATE_LIMIT_WINDOW) {
    rateLimitMap.set(key, { count: 1, windowStart: now });
    return false;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return true;
  }

  entry.count++;
  return false;
}

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

    // Always return the same success message to avoid revealing whether the email exists
    const successResponse = new Response(
      JSON.stringify({ message: "If an account exists with that email, a reset link has been sent." }),
      { status: 200 }
    );

    // Rate limit check — return same success message to avoid leaking info
    if (isRateLimited(email)) {
      return successResponse;
    }

    // Look up the user
    const { data: user } = await supabase
      .from("users")
      .select("id, auth_provider")
      .eq("email", email.toLowerCase())
      .single();

    // If no user or they signed up with Google, silently succeed
    if (!user || user.auth_provider === "google") {
      return successResponse;
    }

    // Generate a secure token
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

    // Clear any existing tokens for this user, then store the new one
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
    const baseUrl = process.env.NEXTAUTH_URL || "https://mortgageaicalc.co.uk";
    const resetLink = `${baseUrl}/auth/reset-password?token=${token}`;

    await sendEmail({
      to: email,
      subject: "Reset your password — Mortgage AI Calc",
      html: buildPasswordResetEmail(resetLink),
    });

    return successResponse;
  } catch (error) {
    console.error("Forgot password error:", error);
    return new Response(
      JSON.stringify({ error: "Something went wrong. Please try again." }),
      { status: 500 }
    );
  }
}
