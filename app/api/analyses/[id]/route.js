import { auth } from "@/app/api/auth/[...nextauth]/route";
import { createClient } from "@supabase/supabase-js";

export async function DELETE(request, { params }) {
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

    const session = await auth();

    if (!session?.user?.id) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
      });
    }

    const { id } = params;

    // Verify the analysis belongs to the user
    const { data: analysis, error: fetchError } = await supabase
      .from("analyses")
      .select("user_id")
      .eq("id", id)
      .single();

    if (fetchError || !analysis || analysis.user_id !== session.user.id) {
      return new Response(JSON.stringify({ error: "Not found or unauthorized" }), {
        status: 404,
      });
    }

    // Delete the analysis
    const { error: deleteError } = await supabase
      .from("analyses")
      .delete()
      .eq("id", id);

    if (deleteError) throw deleteError;

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (error) {
    console.error("Delete analysis error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to delete analysis" }),
      { status: 500 }
    );
  }
}
