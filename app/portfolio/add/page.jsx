"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Home } from "lucide-react";

const PAGE = { minHeight: "100vh", background: "#FAFBFC", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" };
const CARD = { background: "white", border: "1px solid #E5E7EB", borderRadius: 16, padding: 28, marginBottom: 24 };
const INPUT = { width: "100%", padding: "10px 14px", border: "1px solid #D1D5DB", borderRadius: 10, fontSize: 14, outline: "none", boxSizing: "border-box" };
const LABEL = { fontSize: 13, fontWeight: 500, color: "#374151", display: "block", marginBottom: 6 };
const GRID2 = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 };
const GRID3 = { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 };
const SECTION_TITLE = { fontSize: 17, fontWeight: 700, marginBottom: 20, paddingBottom: 12, borderBottom: "1px solid #F3F4F6", color: "#111" };

const EMPTY = {
  address: "", postcode: "", property_type: "House", bedrooms: 1,
  estimated_value: "", purchase_price: "", purchase_date: "",
  outstanding_balance: "", interest_rate: "", rate_type: "Fixed",
  fixed_until: "", monthly_payment: "", remaining_years: "", mortgage_type: "Repayment",
  lender: "", erc_percentage: "",
  monthly_rent: "", tenancy_start: "", tenancy_end: "", tenant_name: "",
  deposit_amount: "", is_tenanted: true,
  agent_name: "", management_fee_pct: "", tenant_find_fee: "",
  buildings_insurance: "", landlord_insurance: "", ground_rent: "",
  service_charge: "", maintenance_reserve: "50",
};

export default function AddProperty() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") router.push("/auth/signin");
  }, [status, router]);

  const set = (k, v) => setForm((prev) => ({ ...prev, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.address.trim()) { setError("Address is required."); return; }
    if (!form.monthly_rent) { setError("Monthly rent is required."); return; }
    setError("");
    setSaving(true);
    try {
      const payload = { ...form };
      // Convert numeric strings
      const numericFields = ["bedrooms","estimated_value","purchase_price","outstanding_balance","interest_rate","monthly_payment","remaining_years","erc_percentage","monthly_rent","deposit_amount","management_fee_pct","tenant_find_fee","buildings_insurance","landlord_insurance","ground_rent","service_charge","maintenance_reserve"];
      numericFields.forEach((f) => { if (payload[f] !== "") payload[f] = parseFloat(payload[f]) || 0; });
      const res = await fetch("/api/portfolio", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) { const d = await res.json(); setError(d.error || "Failed to save."); return; }
      const data = await res.json();
      router.push(`/portfolio/${data.id}`);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (status === "loading") return <div style={{ ...PAGE, display: "flex", alignItems: "center", justifyContent: "center" }}><div style={{ width: 40, height: 40, borderRadius: "50%", border: "3px solid #E5E7EB", borderTopColor: "#6366F1", animation: "spin 0.8s linear infinite" }} /></div>;

  return (
    <div style={PAGE}>
      <div style={{ borderBottom: "1px solid #E5E7EB", background: "white", padding: "16px 24px" }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <button onClick={() => router.push("/portfolio")} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, color: "#6366F1", fontSize: 14, fontWeight: 500 }}>
            <ArrowLeft size={18} /> Portfolio
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "40px 20px" }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8, display: "flex", alignItems: "center", gap: 10 }}>
            <Home size={26} color="#6366F1" /> Add Property
          </h1>
          <p style={{ color: "#666", fontSize: 14 }}>Enter details for your buy-to-let property.</p>
        </div>

        {error && <div style={{ padding: "12px 16px", background: "#FEE2E2", border: "1px solid #FECACA", borderRadius: 10, color: "#991B1B", fontSize: 14, marginBottom: 20 }}>{error}</div>}

        <form onSubmit={handleSubmit}>
          {/* 1. Property Details */}
          <div style={CARD}>
            <h2 style={SECTION_TITLE}>1. Property Details</h2>
            <div style={{ marginBottom: 16 }}>
              <label style={LABEL}>Address *</label>
              <input style={INPUT} value={form.address} onChange={(e) => set("address", e.target.value)} placeholder="e.g. 14 Victoria Road, Manchester" />
            </div>
            <div style={{ ...GRID2, marginBottom: 16 }}>
              <div>
                <label style={LABEL}>Postcode</label>
                <input style={INPUT} value={form.postcode} onChange={(e) => set("postcode", e.target.value)} placeholder="M14 5BT" />
              </div>
              <div>
                <label style={LABEL}>Property Type</label>
                <select style={INPUT} value={form.property_type} onChange={(e) => set("property_type", e.target.value)}>
                  {["House","Flat","HMO","Studio","Bungalow","Other"].map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div style={GRID3}>
              <div>
                <label style={LABEL}>Bedrooms</label>
                <input style={INPUT} type="number" min={1} value={form.bedrooms} onChange={(e) => set("bedrooms", e.target.value)} />
              </div>
              <div>
                <label style={LABEL}>Estimated Value (£)</label>
                <input style={INPUT} type="number" value={form.estimated_value} onChange={(e) => set("estimated_value", e.target.value)} placeholder="250000" />
              </div>
              <div>
                <label style={LABEL}>Purchase Price (£)</label>
                <input style={INPUT} type="number" value={form.purchase_price} onChange={(e) => set("purchase_price", e.target.value)} placeholder="200000" />
              </div>
            </div>
            <div style={{ marginTop: 16 }}>
              <label style={LABEL}>Purchase Date</label>
              <input style={{ ...INPUT, width: "auto" }} type="date" value={form.purchase_date} onChange={(e) => set("purchase_date", e.target.value)} />
            </div>
          </div>

          {/* 2. Mortgage Details */}
          <div style={CARD}>
            <h2 style={SECTION_TITLE}>2. Mortgage Details</h2>
            <div style={{ ...GRID2, marginBottom: 16 }}>
              <div>
                <label style={LABEL}>Outstanding Balance (£)</label>
                <input style={INPUT} type="number" value={form.outstanding_balance} onChange={(e) => set("outstanding_balance", e.target.value)} placeholder="150000" />
              </div>
              <div>
                <label style={LABEL}>Interest Rate (%)</label>
                <input style={INPUT} type="number" step="0.01" value={form.interest_rate} onChange={(e) => set("interest_rate", e.target.value)} placeholder="4.5" />
              </div>
            </div>
            <div style={{ ...GRID3, marginBottom: 16 }}>
              <div>
                <label style={LABEL}>Rate Type</label>
                <select style={INPUT} value={form.rate_type} onChange={(e) => set("rate_type", e.target.value)}>
                  {["Fixed","Variable","SVR"].map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={LABEL}>Fixed Until</label>
                <input style={INPUT} type="date" value={form.fixed_until} onChange={(e) => set("fixed_until", e.target.value)} />
              </div>
              <div>
                <label style={LABEL}>Monthly Payment (£)</label>
                <input style={INPUT} type="number" value={form.monthly_payment} onChange={(e) => set("monthly_payment", e.target.value)} placeholder="800" />
              </div>
            </div>
            <div style={GRID3}>
              <div>
                <label style={LABEL}>Remaining Term (years)</label>
                <input style={INPUT} type="number" step="0.5" value={form.remaining_years} onChange={(e) => set("remaining_years", e.target.value)} placeholder="22" />
              </div>
              <div>
                <label style={LABEL}>Mortgage Type</label>
                <select style={INPUT} value={form.mortgage_type} onChange={(e) => set("mortgage_type", e.target.value)}>
                  {["Repayment","Interest Only"].map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={LABEL}>Lender</label>
                <input style={INPUT} value={form.lender} onChange={(e) => set("lender", e.target.value)} placeholder="Barclays" />
              </div>
            </div>
            <div style={{ marginTop: 16, maxWidth: 200 }}>
              <label style={LABEL}>ERC % (Early Repayment Charge)</label>
              <input style={INPUT} type="number" step="0.1" value={form.erc_percentage} onChange={(e) => set("erc_percentage", e.target.value)} placeholder="2.0" />
            </div>
          </div>

          {/* 3. Tenancy Details */}
          <div style={CARD}>
            <h2 style={SECTION_TITLE}>3. Tenancy Details</h2>
            <div style={{ ...GRID2, marginBottom: 16 }}>
              <div>
                <label style={LABEL}>Monthly Rent (£) *</label>
                <input style={INPUT} type="number" value={form.monthly_rent} onChange={(e) => set("monthly_rent", e.target.value)} placeholder="1200" />
              </div>
              <div>
                <label style={LABEL}>Deposit Amount (£)</label>
                <input style={INPUT} type="number" value={form.deposit_amount} onChange={(e) => set("deposit_amount", e.target.value)} placeholder="1200" />
              </div>
            </div>
            <div style={{ ...GRID3, marginBottom: 16 }}>
              <div>
                <label style={LABEL}>Tenancy Start</label>
                <input style={INPUT} type="date" value={form.tenancy_start} onChange={(e) => set("tenancy_start", e.target.value)} />
              </div>
              <div>
                <label style={LABEL}>Tenancy End</label>
                <input style={INPUT} type="date" value={form.tenancy_end} onChange={(e) => set("tenancy_end", e.target.value)} />
              </div>
              <div>
                <label style={LABEL}>Tenant Name</label>
                <input style={INPUT} value={form.tenant_name} onChange={(e) => set("tenant_name", e.target.value)} placeholder="John Smith" />
              </div>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 14 }}>
              <input type="checkbox" checked={form.is_tenanted} onChange={(e) => set("is_tenanted", e.target.checked)} style={{ width: 16, height: 16 }} />
              <span style={{ fontWeight: 500 }}>Currently tenanted</span>
            </label>
          </div>

          {/* 4. Agent & Fees */}
          <div style={CARD}>
            <h2 style={SECTION_TITLE}>4. Agent & Fees</h2>
            <div style={GRID3}>
              <div>
                <label style={LABEL}>Agent Name</label>
                <input style={INPUT} value={form.agent_name} onChange={(e) => set("agent_name", e.target.value)} placeholder="Your Letting Agency" />
              </div>
              <div>
                <label style={LABEL}>Management Fee (%)</label>
                <input style={INPUT} type="number" step="0.5" value={form.management_fee_pct} onChange={(e) => set("management_fee_pct", e.target.value)} placeholder="10" />
              </div>
              <div>
                <label style={LABEL}>Tenant Find Fee (£)</label>
                <input style={INPUT} type="number" value={form.tenant_find_fee} onChange={(e) => set("tenant_find_fee", e.target.value)} placeholder="500" />
              </div>
            </div>
          </div>

          {/* 5. Running Costs */}
          <div style={CARD}>
            <h2 style={SECTION_TITLE}>5. Running Costs (monthly £)</h2>
            <div style={{ ...GRID3, marginBottom: 16 }}>
              <div>
                <label style={LABEL}>Buildings Insurance</label>
                <input style={INPUT} type="number" value={form.buildings_insurance} onChange={(e) => set("buildings_insurance", e.target.value)} placeholder="30" />
              </div>
              <div>
                <label style={LABEL}>Landlord Insurance</label>
                <input style={INPUT} type="number" value={form.landlord_insurance} onChange={(e) => set("landlord_insurance", e.target.value)} placeholder="20" />
              </div>
              <div>
                <label style={LABEL}>Ground Rent</label>
                <input style={INPUT} type="number" value={form.ground_rent} onChange={(e) => set("ground_rent", e.target.value)} placeholder="0" />
              </div>
            </div>
            <div style={GRID2}>
              <div>
                <label style={LABEL}>Service Charge</label>
                <input style={INPUT} type="number" value={form.service_charge} onChange={(e) => set("service_charge", e.target.value)} placeholder="0" />
              </div>
              <div>
                <label style={LABEL}>Maintenance Reserve</label>
                <input style={INPUT} type="number" value={form.maintenance_reserve} onChange={(e) => set("maintenance_reserve", e.target.value)} placeholder="50" />
              </div>
            </div>
          </div>

          <button type="submit" disabled={saving} style={{ width: "100%", padding: "14px 0", background: saving ? "#A5B4FC" : "linear-gradient(135deg, #6366F1, #4F46E5)", color: "white", border: "none", borderRadius: 12, fontSize: 16, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer" }}>
            {saving ? "Saving..." : "Save Property"}
          </button>
        </form>
      </div>
    </div>
  );
}
