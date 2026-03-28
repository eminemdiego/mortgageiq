"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Building2, Plus, Trash2, ArrowLeft, ChevronRight, AlertTriangle, CheckCircle, Clock,
} from "lucide-react";

const fmt = (n) => "£" + Number(n || 0).toLocaleString("en-GB");

function calcCashFlow(p) {
  const agentFee = (p.monthly_rent * (p.management_fee_pct || 0)) / 100;
  const costs = agentFee + (p.buildings_insurance || 0) + (p.landlord_insurance || 0) +
    (p.ground_rent || 0) + (p.service_charge || 0) + (p.maintenance_reserve || 0);
  return { net: p.monthly_rent - (p.monthly_payment || 0) - costs, income: p.monthly_rent, costs: (p.monthly_payment || 0) + costs };
}

function grossYield(p) {
  if (!p.estimated_value || !p.monthly_rent) return null;
  return ((p.monthly_rent * 12) / p.estimated_value * 100).toFixed(1);
}

function tenancyStatus(p) {
  if (p.tenancy_status === "vacant") return { label: "Vacant", color: "#EF4444", bg: "#FEE2E2", icon: AlertTriangle };
  if (p.tenancy_status === "rolling_periodic") return { label: "Rolling (Periodic)", color: "#6366F1", bg: "#EEF2FF", icon: CheckCircle };
  if (!p.tenancy_end) return { label: "Tenanted", color: "#10B981", bg: "#ECFDF5", icon: CheckCircle };
  const days = Math.round((new Date(p.tenancy_end) - new Date()) / (1000 * 60 * 60 * 24));
  if (days < 0) return { label: "End date passed", color: "#F59E0B", bg: "#FEF3C7", icon: Clock };
  if (days <= 90) return { label: "Ending soon", color: "#F59E0B", bg: "#FEF3C7", icon: Clock };
  return { label: "Fixed term", color: "#10B981", bg: "#ECFDF5", icon: CheckCircle };
}

function rentReviewEligible(p) {
  if (!p.last_rent_increase_date) return true;
  const months = Math.round((new Date() - new Date(p.last_rent_increase_date)) / (1000 * 60 * 60 * 24 * 30.44));
  return months >= 12;
}

const CARD = { background: "white", border: "1px solid #E5E7EB", borderRadius: 16, padding: 28, marginBottom: 24 };
const PAGE = { minHeight: "100vh", background: "#FAFBFC", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" };

export default function PortfolioDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/auth/signin");
  }, [status, router]);

  useEffect(() => {
    if (session?.user?.id) fetchProperties();
  }, [session]);

  const fetchProperties = async () => {
    try {
      const res = await fetch("/api/portfolio");
      if (!res.ok) throw new Error();
      setProperties(await res.json());
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this property? This cannot be undone.")) return;
    await fetch(`/api/portfolio/${id}`, { method: "DELETE" });
    setProperties((prev) => prev.filter((p) => p.id !== id));
  };

  if (status === "loading" || loading) {
    return (
      <div style={{ ...PAGE, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%", border: "3px solid #E5E7EB", borderTopColor: "#6366F1", margin: "0 auto 16px", animation: "spin 0.8s linear infinite" }} />
          <p style={{ color: "#666", fontSize: 14 }}>Loading your portfolio...</p>
        </div>
      </div>
    );
  }

  const totalIncome = properties.reduce((s, p) => s + (p.monthly_rent || 0), 0);
  const totalCosts = properties.reduce((s, p) => s + calcCashFlow(p).costs, 0);
  const totalNet = totalIncome - totalCosts;
  const avgYield = properties.filter(p => grossYield(p)).length
    ? (properties.filter(p => grossYield(p)).reduce((s, p) => s + parseFloat(grossYield(p)), 0) / properties.filter(p => grossYield(p)).length).toFixed(1)
    : null;

  return (
    <div style={PAGE}>
      {/* Header */}
      <div style={{ borderBottom: "1px solid #E5E7EB", background: "white", padding: "16px 24px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <button onClick={() => router.push("/")} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, color: "#6366F1", fontSize: 14, fontWeight: 500 }}>
            <ArrowLeft size={18} /> Back to Mortgage AI Calc
          </button>
          <button onClick={() => router.push("/portfolio/add")} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 20px", background: "linear-gradient(135deg, #6366F1, #4F46E5)", color: "white", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
            <Plus size={16} /> Add Property
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 20px" }}>
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 8, display: "flex", alignItems: "center", gap: 12 }}>
            <Building2 size={32} color="#6366F1" /> Portfolio Manager
          </h1>
          <p style={{ fontSize: 15, color: "#666" }}>Track your buy-to-let properties, cash flow, and yields.</p>
        </div>

        {properties.length === 0 ? (
          <div style={{ ...CARD, textAlign: "center", padding: "60px 20px" }}>
            <div style={{ width: 72, height: 72, borderRadius: 20, background: "#EEF2FF", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", color: "#6366F1" }}>
              <Building2 size={32} />
            </div>
            <h3 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>No properties yet</h3>
            <p style={{ fontSize: 14, color: "#666", marginBottom: 24 }}>Add your first buy-to-let property to start tracking your portfolio.</p>
            <button onClick={() => router.push("/portfolio/add")} style={{ padding: "12px 28px", background: "linear-gradient(135deg, #6366F1, #4F46E5)", color: "white", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
              Add your first property
            </button>
          </div>
        ) : (
          <>
            {/* Summary bar */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 20 }}>
              {[
                { label: "Total Properties", value: properties.length, raw: true },
                { label: "Monthly Income", value: fmt(Math.round(totalIncome)), color: "#10B981" },
                { label: "Monthly Costs", value: fmt(Math.round(totalCosts)), color: "#EF4444" },
                { label: "Net Monthly Profit", value: fmt(Math.round(totalNet)), color: totalNet >= 0 ? "#10B981" : "#EF4444" },
              ].map((s, i) => (
                <div key={i} style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: 14, padding: "18px 20px" }}>
                  <p style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>{s.label}</p>
                  <p style={{ fontSize: s.raw ? 28 : 20, fontWeight: 700, color: s.color || "#111" }}>{s.raw ? s.value : s.value}</p>
                  {avgYield && i === 0 && <p style={{ fontSize: 12, color: "#6B7280", marginTop: 4 }}>Avg yield: {avgYield}%</p>}
                </div>
              ))}
            </div>

            {/* Tenancy & Rent Summary */}
            {(() => {
              const eligible = properties.filter(rentReviewEligible).length;
              const rolling = properties.filter(p => p.tenancy_status === "rolling_periodic").length;
              const vacant = properties.filter(p => p.tenancy_status === "vacant").length;
              if (eligible === 0 && rolling === 0 && vacant === 0) return null;
              return (
                <div style={{ display: "flex", gap: 12, marginBottom: 32, flexWrap: "wrap" }}>
                  {eligible > 0 && (
                    <div style={{ padding: "10px 16px", background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 10, fontSize: 13, color: "#065F46", fontWeight: 500 }}>
                      {eligible} {eligible === 1 ? "property" : "properties"} eligible for rent review
                    </div>
                  )}
                  {rolling > 0 && (
                    <div style={{ padding: "10px 16px", background: "#EEF2FF", border: "1px solid #C7D2FE", borderRadius: 10, fontSize: 13, color: "#4338CA", fontWeight: 500 }}>
                      {rolling} on rolling periodic {rolling === 1 ? "tenancy" : "tenancies"}
                    </div>
                  )}
                  {vacant > 0 && (
                    <div style={{ padding: "10px 16px", background: "#FEE2E2", border: "1px solid #FECACA", borderRadius: 10, fontSize: 13, color: "#991B1B", fontWeight: 500 }}>
                      {vacant} vacant {vacant === 1 ? "property" : "properties"}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Properties grid */}
            <div style={{ display: "grid", gridTemplateColumns: properties.length > 2 ? "1fr 1fr" : "1fr 1fr", gap: 20 }}>
              {properties.map((p) => {
                const { net: cf } = calcCashFlow(p);
                const gy = grossYield(p);
                const ts = tenancyStatus(p);
                const TsIcon = ts.icon;
                return (
                  <div key={p.id} style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: 16, padding: 24 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                      <div style={{ flex: 1, marginRight: 12 }}>
                        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 6, lineHeight: 1.3 }}>
                          {p.address?.split(",")[0] || p.address}
                        </h3>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", background: ts.bg, color: ts.color, borderRadius: 20, fontSize: 12, fontWeight: 500 }}>
                            <TsIcon size={11} /> {ts.label}
                          </span>
                          {p.lender && <span style={{ padding: "3px 10px", background: "#FEF3C7", color: "#92400E", borderRadius: 20, fontSize: 12 }}>{p.lender}</span>}
                        </div>
                      </div>
                      <button onClick={() => handleDelete(p.id)} title="Delete" style={{ background: "#FEE2E2", border: "none", borderRadius: 8, padding: "7px 9px", cursor: "pointer", color: "#EF4444", display: "flex", alignItems: "center", flexShrink: 0 }}>
                        <Trash2 size={13} />
                      </button>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
                      <div>
                        <p style={{ fontSize: 11, color: "#666", marginBottom: 3 }}>Monthly rent</p>
                        <p style={{ fontSize: 17, fontWeight: 700 }}>{fmt(p.monthly_rent)}</p>
                      </div>
                      <div>
                        <p style={{ fontSize: 11, color: "#666", marginBottom: 3 }}>Net profit</p>
                        <p style={{ fontSize: 17, fontWeight: 700, color: cf >= 0 ? "#10B981" : "#EF4444" }}>{fmt(Math.round(cf))}</p>
                      </div>
                      <div>
                        <p style={{ fontSize: 11, color: "#666", marginBottom: 3 }}>Gross yield</p>
                        <p style={{ fontSize: 17, fontWeight: 700 }}>{gy ? gy + "%" : "—"}</p>
                      </div>
                    </div>

                    <button onClick={() => router.push(`/portfolio/${p.id}`)} style={{ width: "100%", padding: "10px 0", background: "#F5F3FF", color: "#6366F1", border: "1px solid #C7D2FE", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                      View Details <ChevronRight size={15} />
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
