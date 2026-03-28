import { createClient } from "@supabase/supabase-js";
import { sendEmail, buildCertificateAlertEmail } from "@/app/lib/email";

export const dynamic = "force-dynamic";

const CERT_LABELS = {
  gas_safety: "Gas Safety Certificate (CP12)",
  epc: "Energy Performance Certificate (EPC)",
  eicr: "Electrical Installation Condition Report (EICR)",
  legionella: "Legionella Risk Assessment",
  landlord_insurance: "Landlord Insurance",
  smoke_co_alarms: "Smoke & CO Alarms",
  pat: "PAT Testing",
  asbestos: "Asbestos Survey",
};

// This route is designed to be called by Vercel Cron or an external scheduler
// Add to vercel.json: { "crons": [{ "path": "/api/cron/certificate-alerts", "schedule": "0 8 * * *" }] }
export async function GET(request) {
  try {
    // Verify cron secret to prevent unauthorized access
    const authHeader = request.headers.get("authorization");
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new Response("Unauthorized", { status: 401 });
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
      return new Response("Not configured", { status: 500 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    const now = new Date();
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const nowStr = now.toISOString().split("T")[0];
    const in30Str = in30Days.toISOString().split("T")[0];

    // Get all certificates that are expired or expiring within 30 days
    const { data: certs, error } = await supabase
      .from("property_certificates")
      .select("*, properties!inner(address, user_id)")
      .not("expiry_date", "is", null)
      .lte("expiry_date", in30Str);

    if (error) throw error;
    if (!certs || certs.length === 0) {
      return Response.json({ message: "No alerts to send", count: 0 });
    }

    // Group by user
    const userAlerts = {};
    for (const cert of certs) {
      const userId = cert.properties.user_id;
      if (!userAlerts[userId]) userAlerts[userId] = [];
      userAlerts[userId].push({
        address: cert.properties.address?.split(",")[0] || cert.properties.address || "Unknown",
        certLabel: CERT_LABELS[cert.cert_type] || cert.cert_type,
        expiryDate: new Date(cert.expiry_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
        status: cert.expiry_date <= nowStr ? "expired" : "expiring",
      });
    }

    // Get user emails and send
    let sentCount = 0;
    for (const [userId, alerts] of Object.entries(userAlerts)) {
      const { data: user } = await supabase
        .from("users")
        .select("email")
        .eq("id", userId)
        .single();

      if (user?.email) {
        try {
          await sendEmail({
            to: user.email,
            subject: `Compliance Alert: ${alerts.length} certificate${alerts.length > 1 ? "s" : ""} need attention`,
            html: buildCertificateAlertEmail(alerts),
          });
          sentCount++;
        } catch (err) {
          console.error(`Failed to send alert to ${user.email}:`, err);
        }
      }
    }

    return Response.json({ message: `Sent ${sentCount} alert emails`, count: sentCount });
  } catch (err) {
    console.error("Certificate alert cron error:", err);
    return new Response("Error", { status: 500 });
  }
}
