import { auth } from "@/app/api/auth/[...nextauth]/route";
import { createClient } from "@supabase/supabase-js";

const ADMIN_EMAIL = "ahmed.sarwar@hotmail.co.uk";

function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );
}

export async function GET() {
  const session = await auth();

  if (!session?.user?.email || session.user.email !== ADMIN_EMAIL) {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
  }

  try {
    // Fetch all users
    const { data: users, error: usersError } = await supabase()
      .from("users")
      .select("id, email, name, auth_provider, created_at, last_login")
      .order("created_at", { ascending: false });

    if (usersError) throw usersError;

    // Fetch property counts grouped by user_id
    const { data: propertyCounts, error: propError } = await supabase()
      .from("properties")
      .select("user_id");

    if (propError) throw propError;

    // Fetch analysis counts grouped by user_id
    const { data: analysisCounts, error: analysisError } = await supabase()
      .from("analyses")
      .select("user_id");

    if (analysisError) throw analysisError;

    // Build lookup maps
    const propMap = {};
    for (const row of propertyCounts || []) {
      propMap[row.user_id] = (propMap[row.user_id] || 0) + 1;
    }

    const analysisMap = {};
    for (const row of analysisCounts || []) {
      analysisMap[row.user_id] = (analysisMap[row.user_id] || 0) + 1;
    }

    const enriched = users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name || "",
      auth_provider: u.auth_provider || "email",
      created_at: u.created_at,
      last_login: u.last_login || null,
      property_count: propMap[u.id] || 0,
      analysis_count: analysisMap[u.id] || 0,
    }));

    return new Response(JSON.stringify(enriched), { status: 200 });
  } catch (err) {
    console.error("Admin users error:", err);
    return new Response(JSON.stringify({ error: "Failed to fetch users" }), { status: 500 });
  }
}
