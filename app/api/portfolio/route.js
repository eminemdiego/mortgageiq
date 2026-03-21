import { auth } from "@/app/api/auth/[...nextauth]/route";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );
}

export async function GET() {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
      return NextResponse.json({ error: "Database not configured" }, { status: 500 });
    }

    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("properties")
      .select("*")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("GET /api/portfolio Supabase error:", error);
      return NextResponse.json({ error: error.message, code: error.code }, { status: 500 });
    }
    return NextResponse.json(data, { status: 200 });
  } catch (err) {
    console.error("GET /api/portfolio unexpected error:", err);
    return NextResponse.json({ error: err.message || "Failed to fetch properties" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
      return NextResponse.json({ error: "Database not configured" }, { status: 500 });
    }

    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    if (!body.address || !body.monthly_rent) {
      return NextResponse.json({ error: "address and monthly_rent are required" }, { status: 400 });
    }

    // Strip undefined/null/empty-string fields to avoid type errors on Supabase columns
    const clean = { user_id: session.user.id };
    for (const [k, v] of Object.entries(body)) {
      if (v !== undefined && v !== null && v !== "") clean[k] = v;
    }

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("properties")
      .insert(clean)
      .select()
      .single();

    if (error) {
      console.error("POST /api/portfolio Supabase error:", error);
      return NextResponse.json(
        { error: error.message || "Supabase insert failed", code: error.code, details: error.details, hint: error.hint },
        { status: 500 }
      );
    }

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error("POST /api/portfolio unexpected error:", err);
    return NextResponse.json({ error: err.message || "Failed to create property" }, { status: 500 });
  }
}
