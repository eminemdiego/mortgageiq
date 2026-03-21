import { auth } from "@/app/api/auth/[...nextauth]/route";
import { createClient } from "@supabase/supabase-js";

function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );
}

async function getVerifiedAnalysis(id, userId) {
  const { data, error } = await supabase()
    .from("analyses")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) return { error: "Not found", status: 404 };
  if (data.user_id !== userId) return { error: "Unauthorized", status: 403 };
  return { data };
}

export async function GET(request, { params }) {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
      return new Response(JSON.stringify({ error: "Database not configured" }), { status: 500 });
    }

    const session = await auth();
    if (!session?.user?.id) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const { id } = params;
    const result = await getVerifiedAnalysis(id, session.user.id);
    if (result.error) {
      return new Response(JSON.stringify({ error: result.error }), { status: result.status });
    }

    return new Response(JSON.stringify(result.data), { status: 200 });
  } catch (error) {
    console.error("Get analysis error:", error);
    return new Response(JSON.stringify({ error: "Failed to fetch analysis" }), { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
      return new Response(JSON.stringify({ error: "Database not configured" }), { status: 500 });
    }

    const session = await auth();
    if (!session?.user?.id) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const { id } = params;
    const result = await getVerifiedAnalysis(id, session.user.id);
    if (result.error) {
      return new Response(JSON.stringify({ error: result.error }), { status: result.status });
    }

    const { error: deleteError } = await supabase()
      .from("analyses")
      .delete()
      .eq("id", id);

    if (deleteError) throw deleteError;

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (error) {
    console.error("Delete analysis error:", error);
    return new Response(JSON.stringify({ error: "Failed to delete analysis" }), { status: 500 });
  }
}
