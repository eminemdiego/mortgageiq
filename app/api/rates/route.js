import { auth } from "@/app/api/auth/[...nextauth]/route";
import { createClient } from "@supabase/supabase-js";

const ADMIN_EMAIL = "ahmed.sarwar@hotmail.co.uk";

function supabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
}

// GET — public: fetch all bank rates
export async function GET() {
  try {
    const sb = supabase();
    const { data, error } = await sb
      .from("bank_rates")
      .select("*")
      .order("bank_name", { ascending: true });
    if (error) throw error;
    return Response.json(data || []);
  } catch (err) {
    console.error("GET rates error:", err);
    return Response.json({ error: "Failed to fetch rates" }, { status: 500 });
  }
}

// PUT — admin only: update a bank's rates
export async function PUT(request) {
  try {
    const session = await auth();
    if (!session?.user?.email || session.user.email !== ADMIN_EMAIL) {
      return Response.json({ error: "Unauthorized" }, { status: 403 });
    }
    const body = await request.json();
    const { id, ...updates } = body;
    if (!id) return Response.json({ error: "id required" }, { status: 400 });

    const sb = supabase();
    const { data, error } = await sb
      .from("bank_rates")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return Response.json(data);
  } catch (err) {
    console.error("PUT rates error:", err);
    return Response.json({ error: "Failed to update" }, { status: 500 });
  }
}
