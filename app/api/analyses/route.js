import { auth } from "@/app/api/auth/[...nextauth]/route";
import { createClient } from "@supabase/supabase-js";

function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );
}

export async function POST(request) {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
      return new Response(JSON.stringify({ error: "Database not configured" }), { status: 500 });
    }

    const session = await auth();
    if (!session?.user?.id) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const body = await request.json();
    const {
      title,
      outstandingBalance,
      monthlyPayment,
      interestRate,
      remainingYears,
      mortgageType,
      rateType,
      bank,
      propertyAddress,
      statementDate,
      analysisData,
    } = body;

    const { data, error } = await supabase()
      .from("analyses")
      .insert({
        user_id: session.user.id,
        title: title || `Mortgage Analysis - ${new Date().toLocaleDateString()}`,
        outstanding_balance: parseFloat(outstandingBalance),
        monthly_payment: parseFloat(monthlyPayment),
        interest_rate: parseFloat(interestRate),
        remaining_years: parseFloat(remainingYears),
        mortgage_type: mortgageType,
        rate_type: rateType,
        bank,
        property_address: propertyAddress || null,
        statement_date: statementDate || null,
        analysis_data: analysisData,
      })
      .select()
      .single();

    if (error) throw error;

    return new Response(JSON.stringify(data), { status: 201 });
  } catch (error) {
    console.error("Save analysis error:", error);
    return new Response(JSON.stringify({ error: "Failed to save analysis" }), { status: 500 });
  }
}

export async function GET() {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
      return new Response(JSON.stringify({ error: "Database not configured" }), { status: 500 });
    }

    const session = await auth();
    if (!session?.user?.id) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const { data, error } = await supabase()
      .from("analyses")
      .select("id, title, outstanding_balance, monthly_payment, interest_rate, remaining_years, mortgage_type, rate_type, bank, property_address, statement_date, created_at")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return new Response(JSON.stringify(data), { status: 200 });
  } catch (error) {
    console.error("Fetch analyses error:", error);
    return new Response(JSON.stringify({ error: "Failed to fetch analyses" }), { status: 500 });
  }
}
