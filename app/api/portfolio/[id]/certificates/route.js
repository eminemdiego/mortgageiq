import { auth } from "@/app/api/auth/[...nextauth]/route";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const CERT_TYPES = {
  gas_safety: { label: "Gas Safety Certificate (CP12)", renewalMonths: 12 },
  epc: { label: "Energy Performance Certificate (EPC)", renewalMonths: 120 },
  eicr: { label: "Electrical Installation Condition Report (EICR)", renewalMonths: 60 },
  legionella: { label: "Legionella Risk Assessment", renewalMonths: 24 },
  landlord_insurance: { label: "Landlord Insurance", renewalMonths: 12 },
  smoke_co_alarms: { label: "Smoke & Carbon Monoxide Alarms", renewalMonths: 12 },
  pat: { label: "Portable Appliance Testing (PAT)", renewalMonths: 12 },
  asbestos: { label: "Asbestos Survey", renewalMonths: null },
};

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );
}

async function verifyOwnership(supabase, propertyId, userId) {
  const { data } = await supabase
    .from("properties")
    .select("user_id")
    .eq("id", propertyId)
    .single();
  return data?.user_id === userId;
}

// GET all certificates for a property
export async function GET(request, { params }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const supabase = getSupabase();
    const owned = await verifyOwnership(supabase, id, session.user.id);
    if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { data, error } = await supabase
      .from("property_certificates")
      .select("*")
      .eq("property_id", id)
      .order("cert_type", { ascending: true });

    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (err) {
    console.error("GET certificates error:", err);
    return NextResponse.json({ error: "Failed to fetch certificates" }, { status: 500 });
  }
}

// POST — create or update a certificate
export async function POST(request, { params }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const supabase = getSupabase();
    const owned = await verifyOwnership(supabase, id, session.user.id);
    if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = await request.json();
    const { cert_type, date_issued, expiry_date, notes, epc_rating, file_url } = body;

    if (!cert_type || !CERT_TYPES[cert_type]) {
      return NextResponse.json({ error: "Invalid certificate type" }, { status: 400 });
    }

    // Auto-calculate expiry if not provided
    let calculatedExpiry = expiry_date || null;
    if (!calculatedExpiry && date_issued && CERT_TYPES[cert_type].renewalMonths) {
      const issued = new Date(date_issued);
      issued.setMonth(issued.getMonth() + CERT_TYPES[cert_type].renewalMonths);
      calculatedExpiry = issued.toISOString().split("T")[0];
    }

    // Upsert — one certificate per type per property
    const record = {
      property_id: id,
      cert_type,
      date_issued: date_issued || null,
      expiry_date: calculatedExpiry,
      notes: notes || null,
      epc_rating: cert_type === "epc" ? (epc_rating || null) : null,
      file_url: file_url || null,
      updated_at: new Date().toISOString(),
    };

    // Check if exists
    const { data: existing } = await supabase
      .from("property_certificates")
      .select("id")
      .eq("property_id", id)
      .eq("cert_type", cert_type)
      .single();

    let result;
    if (existing) {
      const { data, error } = await supabase
        .from("property_certificates")
        .update(record)
        .eq("id", existing.id)
        .select()
        .single();
      if (error) throw error;
      result = data;
    } else {
      const { data, error } = await supabase
        .from("property_certificates")
        .insert(record)
        .select()
        .single();
      if (error) throw error;
      result = data;
    }

    return NextResponse.json(result, { status: existing ? 200 : 201 });
  } catch (err) {
    console.error("POST certificate error:", err);
    return NextResponse.json({ error: "Failed to save certificate" }, { status: 500 });
  }
}

// DELETE a certificate
export async function DELETE(request, { params }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const supabase = getSupabase();
    const owned = await verifyOwnership(supabase, id, session.user.id);
    if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { searchParams } = new URL(request.url);
    const certId = searchParams.get("certId");
    if (!certId) return NextResponse.json({ error: "certId required" }, { status: 400 });

    const { error } = await supabase
      .from("property_certificates")
      .delete()
      .eq("id", certId)
      .eq("property_id", id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE certificate error:", err);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}

export { CERT_TYPES };
