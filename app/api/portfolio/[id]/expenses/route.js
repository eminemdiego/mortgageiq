import { auth } from "@/app/api/auth/[...nextauth]/route";
import { createClient } from "@supabase/supabase-js";

function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );
}

async function verifyPropertyOwnership(propertyId, userId) {
  const { data, error } = await supabase()
    .from("properties")
    .select("user_id")
    .eq("id", propertyId)
    .single();
  if (error || !data) return false;
  return data.user_id === userId;
}

export async function GET(request, { params }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const owns = await verifyPropertyOwnership(params.id, session.user.id);
    if (!owns) return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });

    const { data, error } = await supabase()
      .from("expenses")
      .select("*")
      .eq("property_id", params.id)
      .order("expense_date", { ascending: false });

    if (error) throw error;

    return new Response(JSON.stringify(data), { status: 200 });
  } catch (err) {
    console.error("GET expenses error:", err);
    return new Response(JSON.stringify({ error: "Failed to fetch expenses" }), { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const owns = await verifyPropertyOwnership(params.id, session.user.id);
    if (!owns) return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });

    const body = await request.json();
    const { supplier, expense_date, description, amount, vat_amount, invoice_number, category } = body;

    if (!amount || isNaN(parseFloat(amount))) {
      return new Response(JSON.stringify({ error: "Amount is required" }), { status: 400 });
    }

    const { data, error } = await supabase()
      .from("expenses")
      .insert({
        property_id: params.id,
        user_id: session.user.id,
        supplier: supplier || null,
        expense_date: expense_date || null,
        description: description || null,
        amount: parseFloat(amount),
        vat_amount: vat_amount != null ? parseFloat(vat_amount) : null,
        invoice_number: invoice_number || null,
        category: category || "other",
      })
      .select()
      .single();

    if (error) throw error;

    return new Response(JSON.stringify(data), { status: 201 });
  } catch (err) {
    console.error("POST expense error:", err);
    return new Response(JSON.stringify({ error: "Failed to save expense" }), { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const url = new URL(request.url);
    const expenseId = url.searchParams.get("expenseId");
    if (!expenseId) return new Response(JSON.stringify({ error: "expenseId required" }), { status: 400 });

    // Verify ownership via property
    const owns = await verifyPropertyOwnership(params.id, session.user.id);
    if (!owns) return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });

    const { error } = await supabase()
      .from("expenses")
      .delete()
      .eq("id", expenseId)
      .eq("property_id", params.id);

    if (error) throw error;

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err) {
    console.error("DELETE expense error:", err);
    return new Response(JSON.stringify({ error: "Failed to delete expense" }), { status: 500 });
  }
}
