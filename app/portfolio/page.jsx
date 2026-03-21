"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Building2, Plus, Trash2, TrendingUp, Home, ArrowLeft, ChevronRight, AlertTriangle, CheckCircle,
} from "lucide-react";

const fmt = (n) => "£" + Number(n).toLocaleString("en-GB");

function calcCashFlow(p) {
  const agentFee = (p.monthly_rent * (p.management_fee_pct || 0)) / 100;
  const costs = agentFee + (p.buildings_insurance || 0) + (p.landlord_insurance || 0) +
    (p.ground_rent || 0) + (p.service_charge || 0) + (p.maintenance_reserve || 0);
  return p.monthly_rent - p.monthly_payment - costs;
}

function grossYield(p) {
  if (!p.estimated_value || !p.monthly_rent) return 0;
  return ((p.monthly_rent * 12) / p.estimated_value * 100).toFixed(1);
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

  const totalValue = properties.reduce((s, p) => s + (p.estimated_value || 0), 0);
  const totalEquity = properties.reduce((s, p) => s + ((p.estimated_value || 0) - (p.outstanding_balance || 0)), 0);
  const totalCashFlow = properties.reduce((s, p) => s + calcCashFlow(p), 0);
  const avgYield = properties.length
    ? (properties.reduce((s, p) => s + parseFloat(grossYield(p)), 0) / properties.length).toFixed(1)
    : 0;

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
            {/* Stats bar */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 16, marginBottom: 32 }}>
              {[
                { label: "Total Properties", value: properties.length, raw: true },
                { label: "Portfolio Value", value: fmt(totalValue) },
                { label: "Total Equity", value: fmt(totalEquity) },
                { label: "Net Monthly Cash Flow", value: fmt(Math.round(totalCashFlow)), color: totalCashFlow >= 0 ? "#10B981" : "#EF4444" },
                { label: "Avg Gross Yield", value: avgYield + "%" },
              ].map((s, i) => (
                <div key={i} style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: 14, padding: "20px 18px" }}>
                  <p style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>{s.label}</p>
                  <p style={{ fontSize: 22, fontWeight: 700, color: s.color || "#111" }}>{s.raw ? s.value : s.value}</p>
                </div>
              ))}
            </div>

            {/* Properties grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
              {properties.map((p) => {
                const cf = calcCashFlow(p);
                const gy = grossYield(p);
                return (
                  <div key={p.id} style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: 16, padding: 24 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                      <div style={{ flex: 1 }}>
                        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{p.address}</h3>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <span style={{ padding: "3px 10px", background: "#EEF2FF", color: "#6366F1", borderRadius: 6, fontSize: 12, fontWeight: 500 }}>{p.property_type}</span>
                          <span style={{ padding: "3px 10px", background: "#F3F4F6", color: "#374151", borderRadius: 6, fontSize: 12 }}>{p.bedrooms} bed</span>
                          <span style={{ padding: "3px 10px", background: p.is_tenanted ? "#ECFDF5" : "#FEE2E2", color: p.is_tenanted ? "#10B981" : "#EF4444", borderRadius: 6, fontSize: 12, fontWeight: 500, display: "flex", alignItems: "center", gap: 4 }}>
                            {p.is_tenanted ? <CheckCircle size={11} /> : <AlertTriangle size={11} />}
                            {p.is_tenanted ? "Tenanted" : "Void"}
                          </span>
                        </div>
                      </div>
                      <button onClick={() => handleDelete(p.id)} title="Delete property" style={{ background: "#FEE2E2", border: "none", borderRadius: 8, padding: "8px 10px", cursor: "pointer", color: "#EF4444", display: "flex", alignItems: "center" }}>
                        <Trash2 size={14} />
                      </button>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
                      <div>
                        <p style={{ fontSize: 11, color: "#666", marginBottom: 4 }}>Monthly Rent</p>
                        <p style={{ fontSize: 18, fontWeight: 700 }}>{fmt(p.monthly_rent)}</p>
                      </div>
                      <div>
                        <p style={{ fontSize: 11, color: "#666", marginBottom: 4 }}>Net Cash Flow</p>
                        <p style={{ fontSize: 18, fontWeight: 700, color: cf >= 0 ? "#10B981" : "#EF4444" }}>{fmt(Math.round(cf))}</p>
                      </div>
                      <div>
                        <p style={{ fontSize: 11, color: "#666", marginBottom: 4 }}>Gross Yield</p>
                        <p style={{ fontSize: 18, fontWeight: 700 }}>{gy}%</p>
                      </div>
                    </div>

                    <button onClick={() => router.push(`/portfolio/${p.id}`)} style={{ width: "100%", padding: "10px 0", background: "#F5F3FF", color: "#6366F1", border: "1px solid #C7D2FE", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                      View Details <ChevronRight size={16} />
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
