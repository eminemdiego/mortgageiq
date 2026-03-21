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

async function verifyOwnership(supabase, id, userId) {
  const { data, error } = await supabase
    .from("properties")
    .select("user_id")
    .eq("id", id)
    .single();
  if (error || !data || data.user_id !== userId) return false;
  return true;
}

export async function GET(request, { params }) {
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
      .eq("id", params.id)
      .eq("user_id", session.user.id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(data, { status: 200 });
  } catch (err) {
    console.error("GET /api/portfolio/[id] error:", err);
    return NextResponse.json({ error: "Failed to fetch property" }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
      return NextResponse.json({ error: "Database not configured" }, { status: 500 });
    }

    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getSupabase();
    const owned = await verifyOwnership(supabase, params.id, session.user.id);
    if (!owned) {
      return NextResponse.json({ error: "Not found or unauthorized" }, { status: 404 });
    }

    const body = await request.json();
    const { data, error } = await supabase
      .from("properties")
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq("id", params.id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data, { status: 200 });
  } catch (err) {
    console.error("PUT /api/portfolio/[id] error:", err);
    return NextResponse.json({ error: "Failed to update property" }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
      return NextResponse.json({ error: "Database not configured" }, { status: 500 });
    }

    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getSupabase();
    const owned = await verifyOwnership(supabase, params.id, session.user.id);
    if (!owned) {
      return NextResponse.json({ error: "Not found or unauthorized" }, { status: 404 });
    }

    const { error } = await supabase
      .from("properties")
      .delete()
      .eq("id", params.id);

    if (error) throw error;
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error("DELETE /api/portfolio/[id] error:", err);
    return NextResponse.json({ error: "Failed to delete property" }, { status: 500 });
  }
}
