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

    const { email, password, name } = await request.json();

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: "Email and password are required" }),
        { status: 400 }
      );
    }

    // Check if user already exists
    const { data: existingUser } = await supabase
      .from("users")
      .select("id")
      .eq("email", email)
      .single();

    if (existingUser) {
      return new Response(
        JSON.stringify({ error: "User already exists" }),
        { status: 409 }
      );
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const { data: newUser, error } = await supabase
      .from("users")
      .insert({
        email,
        name: name || email.split("@")[0],
        password_hash: passwordHash,
        auth_provider: "credentials",
      })
      .select()
      .single();

    if (error) throw error;

    return new Response(
      JSON.stringify({
        message: "User created successfully",
        user: { id: newUser.id, email: newUser.email, name: newUser.name },
      }),
      { status: 201 }
    );
  } catch (error) {
    console.error("Signup error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to create account" }),
      { status: 500 }
    );
  }
}
