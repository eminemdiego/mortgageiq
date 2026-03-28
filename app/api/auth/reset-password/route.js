import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";

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

    const { token, password } = await request.json();

    if (!token || !password) {
      return new Response(
        JSON.stringify({ error: "Token and password are required" }),
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return new Response(
        JSON.stringify({ error: "Password must be at least 6 characters" }),
        { status: 400 }
      );
    }

    // Look up the token
    const { data: resetRecord, error: lookupError } = await supabase
      .from("password_reset_tokens")
      .select("id, user_id, expires_at")
      .eq("token", token)
      .single();

    if (lookupError || !resetRecord) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired reset link. Please request a new one." }),
        { status: 400 }
      );
    }

    // Check expiry
    if (new Date(resetRecord.expires_at) < new Date()) {
      // Delete the expired token
      await supabase
        .from("password_reset_tokens")
        .delete()
        .eq("id", resetRecord.id);

      return new Response(
        JSON.stringify({ error: "This reset link has expired. Please request a new one." }),
        { status: 400 }
      );
    }

    // Hash the new password
    const passwordHash = await bcrypt.hash(password, 10);

    // Update the user's password
    const { error: updateError } = await supabase
      .from("users")
      .update({ password_hash: passwordHash, updated_at: new Date().toISOString() })
      .eq("id", resetRecord.user_id);

    if (updateError) {
      console.error("Password update error:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to update password. Please try again." }),
        { status: 500 }
      );
    }

    // Delete the used token (single-use)
    await supabase
      .from("password_reset_tokens")
      .delete()
      .eq("id", resetRecord.id);

    return new Response(
      JSON.stringify({ message: "Password updated successfully. You can now sign in." }),
      { status: 200 }
    );
  } catch (error) {
    console.error("Reset password error:", error);
    return new Response(
      JSON.stringify({ error: "Something went wrong. Please try again." }),
      { status: 500 }
    );
  }
}
