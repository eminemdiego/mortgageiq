"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import {
  ArrowLeft, Edit2, Trash2, AlertTriangle, CheckCircle, ChevronDown, ChevronUp,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

const fmt = (n) => "£" + Number(n || 0).toLocaleString("en-GB");
const PAGE = { minHeight: "100vh", background: "#FAFBFC", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" };
const CARD = { background: "white", border: "1px solid #E5E7EB", borderRadius: 16, padding: 28, marginBottom: 24 };
const INPUT = { width: "100%", padding: "10px 14px", border: "1px solid #D1D5DB", borderRadius: 10, fontSize: 14, outline: "none", boxSizing: "border-box" };
const LABEL = { fontSize: 12, fontWeight: 500, color: "#6B7280", display: "block", marginBottom: 5 };

function calcMonthlyPayment(principal, annualRate, years) {
  const r = annualRate / 100 / 12;
  const n = years * 12;
  if (r === 0) return principal / n;
  return (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

function buildAmortization(principal, annualRate, monthlyPayment, extraMonthly = 0) {
  const r = annualRate / 100 / 12;
  let balance = principal;
  const schedule = [];
  let month = 0;
  let totalInterest = 0;
  while (balance > 0.01 && month < 600) {
    month++;
    const interest = balance * r;
    const totalPmt = monthlyPayment + extraMonthly;
    const principalPaid = Math.min(balance, totalPmt - interest);
    if (principalPaid <= 0) break;
    balance = Math.max(0, balance - principalPaid);
    totalInterest += interest;
    if (month % 12 === 0 || balance <= 0.01) {
      schedule.push({ year: Math.ceil(month / 12), balance: Math.round(balance), totalInterest: Math.round(totalInterest) });
    }
  }
  return { schedule, totalMonths: month, totalInterest: Math.round(totalInterest) };
}

function calcCashFlow(p) {
  const agentFee = (p.monthly_rent * (p.management_fee_pct || 0)) / 100;
  const extras = (p.buildings_insurance || 0) + (p.landlord_insurance || 0) +
    (p.ground_rent || 0) + (p.service_charge || 0) + (p.maintenance_reserve || 0);
  const costs = agentFee + extras + (p.monthly_payment || 0);
  return { net: p.monthly_rent - costs, agentFee, extras };
}

function metricStatus(value, thresholds) {
  if (value >= thresholds[0]) return { color: "#10B981", bg: "#ECFDF5", label: "Good" };
  if (value >= thresholds[1]) return { color: "#F59E0B", bg: "#FEF3C7", label: "OK" };
  return { color: "#EF4444", bg: "#FEE2E2", label: "Poor" };
}

export default function PropertyDetail() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const [property, setProperty] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rentExtra, setRentExtra] = useState(0);
  const [rateRise, setRateRise] = useState(0);
  const [voidMonths, setVoidMonths] = useState(1);
  const [extrasOpen, setExtrasOpen] = useState(false);
  const [extras, setExtras] = useState({ buildings_insurance: "", landlord_insurance: "", ground_rent: "", service_charge: "", maintenance_reserve: "" });
  const [savingExtras, setSavingExtras] = useState(false);
  const [extrasSaved, setExtrasSaved] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/auth/signin");
  }, [status, router]);

  useEffect(() => {
    if (session?.user?.id) fetchProperty();
  }, [session, params.id]);

  const fetchProperty = async () => {
    try {
      const res = await fetch(`/api/portfolio/${params.id}`);
      if (!res.ok) { router.push("/portfolio"); return; }
      const data = await res.json();
      setProperty(data);
      setExtras({
        buildings_insurance: data.buildings_insurance || "",
        landlord_insurance: data.landlord_insurance || "",
        ground_rent: data.ground_rent || "",
        service_charge: data.service_charge || "",
        maintenance_reserve: data.maintenance_reserve || "",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this property?")) return;
    await fetch(`/api/portfolio/${params.id}`, { method: "DELETE" });
    router.push("/portfolio");
  };

  const handleSaveExtras = async () => {
    setSavingExtras(true);
    try {
      const payload = {};
      Object.entries(extras).forEach(([k, v]) => { payload[k] = parseFloat(v) || 0; });
      const res = await fetch(`/api/portfolio/${params.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const updated = await res.json();
        setProperty(updated);
        setExtrasSaved(true);
        setTimeout(() => setExtrasSaved(false), 3000);
      }
    } finally {
      setSavingExtras(false);
    }
  };

  if (status === "loading" || loading) {
    return (
      <div style={{ ...PAGE, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 48, height: 48, borderRadius: "50%", border: "3px solid #E5E7EB", borderTopColor: "#6366F1", animation: "spin 0.8s linear infinite" }} />
      </div>
    );
  }

  if (!property) return null;

  const p = property;
  const { net: netCF, agentFee, extras: extrasCost } = calcCashFlow(p);
  const grossYield = p.estimated_value ? ((p.monthly_rent * 12) / p.estimated_value * 100) : 0;
  const totalCosts = agentFee + extrasCost + (p.monthly_payment || 0);
  const netYield = p.estimated_value ? (((p.monthly_rent - totalCosts) * 12) / p.estimated_value * 100) : 0;
  const annualInterest = (p.outstanding_balance || 0) * (p.interest_rate || 0) / 100;
  const icr = annualInterest > 0 ? (p.monthly_rent * 12) / annualInterest : 0;
  const rentToMortgage = p.monthly_payment > 0 ? (p.monthly_rent / p.monthly_payment).toFixed(2) : null;

  // Amortisation
  const amort = p.outstanding_balance && p.interest_rate && p.monthly_payment && p.remaining_years
    ? buildAmortization(p.outstanding_balance, p.interest_rate, p.monthly_payment)
    : { schedule: [], totalMonths: 0, totalInterest: 0 };

  const overpayScenarios = [100, 200, 300].map((extra) => {
    const base = buildAmortization(p.outstanding_balance, p.interest_rate, p.monthly_payment);
    const ov = buildAmortization(p.outstanding_balance, p.interest_rate, p.monthly_payment, extra);
    return { extra, monthsSaved: base.totalMonths - ov.totalMonths, interestSaved: base.totalInterest - ov.totalInterest };
  });

  // Tenancy
  const tenancyEnd = p.tenancy_end ? new Date(p.tenancy_end) : null;
  const daysUntilEnd = tenancyEnd ? Math.round((tenancyEnd - new Date()) / (1000 * 60 * 60 * 24)) : null;

  // What-if
  const newRentCF = calcCashFlow({ ...p, monthly_rent: (p.monthly_rent || 0) + Number(rentExtra) });
  const newRate = (p.interest_rate || 0) + Number(rateRise);
  const newPayment = p.outstanding_balance && p.remaining_years
    ? calcMonthlyPayment(p.outstanding_balance, newRate, p.remaining_years)
    : p.monthly_payment;
  const newRateCF = calcCashFlow({ ...p, monthly_payment: newPayment });
  const voidLoss = (p.monthly_rent || 0) * Number(voidMonths);

  // Monthly profit overpayment insight
  const profitHalf = Math.round(netCF / 2);
  const halfOverpay = profitHalf > 0 ? buildAmortization(p.outstanding_balance, p.interest_rate, p.monthly_payment, profitHalf) : null;
  const baseAmort = p.outstanding_balance ? buildAmortization(p.outstanding_balance, p.interest_rate, p.monthly_payment) : null;
  const yearsSaved = halfOverpay && baseAmort ? Math.round((baseAmort.totalMonths - halfOverpay.totalMonths) / 12) : 0;

  return (
    <div style={PAGE}>
      {/* Header */}
      <div style={{ borderBottom: "1px solid #E5E7EB", background: "white", padding: "16px 24px" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <button onClick={() => router.push("/portfolio")} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, color: "#6366F1", fontSize: 14, fontWeight: 500 }}>
            <ArrowLeft size={18} /> Portfolio
          </button>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => router.push(`/portfolio/${p.id}/edit`)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", background: "#EEF2FF", color: "#6366F1", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              <Edit2 size={14} /> Edit
            </button>
            <button onClick={handleDelete} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", background: "#FEE2E2", color: "#EF4444", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              <Trash2 size={14} /> Delete
            </button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "40px 20px" }}>
        {/* Title */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>{p.address}</h1>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {p.lender && <span style={{ padding: "4px 12px", background: "#FEF3C7", color: "#92400E", borderRadius: 6, fontSize: 13 }}>{p.lender}</span>}
            {p.interest_rate && <span style={{ padding: "4px 12px", background: "#EEF2FF", color: "#6366F1", borderRadius: 6, fontSize: 13 }}>{p.interest_rate}% rate</span>}
          </div>
        </div>

        {/* Tenancy alert — 90 days */}
        {daysUntilEnd !== null && daysUntilEnd <= 90 && (
          <div style={{ marginBottom: 24, padding: "16px 20px", background: daysUntilEnd < 0 ? "#FEE2E2" : "#FEF3C7", border: `1px solid ${daysUntilEnd < 0 ? "#FECACA" : "#FDE68A"}`, borderRadius: 12, display: "flex", alignItems: "center", gap: 12 }}>
            <AlertTriangle size={20} color={daysUntilEnd < 0 ? "#EF4444" : "#F59E0B"} />
            <div>
              <p style={{ fontWeight: 700, color: daysUntilEnd < 0 ? "#991B1B" : "#92400E", marginBottom: 2, fontSize: 14 }}>
                {daysUntilEnd < 0 ? "Tenancy has expired" : `Tenancy ending in ${daysUntilEnd} days`}
              </p>
              <p style={{ fontSize: 13, color: "#6B7280" }}>
                {daysUntilEnd < 0 ? `Expired ${Math.abs(daysUntilEnd)} days ago — contact your agent to re-let.` : "Re-let soon to avoid a void period and lost income."}
              </p>
            </div>
          </div>
        )}

        {/* ── HERO CASH FLOW ── */}
        <div style={{ ...CARD, background: "linear-gradient(135deg, #F5F3FF, #EEF2FF)", border: "1px solid #C7D2FE" }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20, color: "#374151" }}>Monthly Cash Flow</h2>
          <div style={{ fontFamily: "ui-monospace, 'Courier New', monospace", fontSize: 15 }}>
            <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: 10, marginBottom: 10 }}>
              <span style={{ color: "#374151" }}>Monthly rent</span>
              <span style={{ fontWeight: 600, color: "#10B981" }}>+{fmt(p.monthly_rent)}</span>
            </div>
            {p.monthly_payment > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: 8, color: "#6B7280" }}>
                <span>Mortgage payment</span>
                <span>−{fmt(p.monthly_payment)}</span>
              </div>
            )}
            {agentFee > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: 8, color: "#6B7280" }}>
                <span>Agent fee ({p.management_fee_pct}%)</span>
                <span>−{fmt(Math.round(agentFee))}</span>
              </div>
            )}
            {extrasCost > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: 8, color: "#6B7280" }}>
                <span>Other costs</span>
                <span>−{fmt(Math.round(extrasCost))}</span>
              </div>
            )}
            <div style={{ borderTop: "2px solid #C7D2FE", paddingTop: 14, marginTop: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 17, fontWeight: 700, color: "#111" }}>Net monthly profit</span>
                <span style={{ fontSize: 28, fontWeight: 800, color: netCF >= 0 ? "#10B981" : "#EF4444" }}>{fmt(Math.round(netCF))}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
                <span style={{ fontSize: 13, color: "#6B7280" }}>Annual: <strong style={{ color: netCF >= 0 ? "#10B981" : "#EF4444" }}>{fmt(Math.round(netCF * 12))}</strong></span>
              </div>
            </div>
          </div>

          {/* Overpayment insight */}
          {yearsSaved > 0 && netCF > 0 && (
            <div style={{ marginTop: 20, padding: "12px 16px", background: "white", borderRadius: 10, border: "1px solid #C7D2FE", fontSize: 13, color: "#374151" }}>
              Putting 50% of your monthly profit ({fmt(profitHalf)}) toward overpayments would clear this mortgage <strong>{yearsSaved} {yearsSaved === 1 ? "year" : "years"}</strong> early.
            </div>
          )}
        </div>

        {/* Key Metrics */}
        <div style={CARD}>
          <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 20 }}>Key Metrics</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
            {[
              { label: "Gross Yield", value: p.estimated_value ? grossYield.toFixed(1) + "%" : "—", status: p.estimated_value ? metricStatus(grossYield, [6, 4]) : null },
              { label: "Net Yield", value: p.estimated_value ? netYield.toFixed(1) + "%" : "—", status: p.estimated_value ? metricStatus(netYield, [4, 2]) : null },
              { label: "Rent / Mortgage", value: rentToMortgage ? rentToMortgage + "x" : "—", status: rentToMortgage ? metricStatus(parseFloat(rentToMortgage), [1.5, 1.2]) : null },
              { label: "ICR", value: icr > 0 ? icr.toFixed(2) + "x" : "—", status: icr > 0 ? metricStatus(icr, [1.45, 1.2]) : null },
            ].map((m, i) => (
              <div key={i} style={{ background: m.status?.bg || "#F9FAFB", borderRadius: 12, padding: "18px 16px", textAlign: "center" }}>
                <p style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>{m.label}</p>
                <p style={{ fontSize: 22, fontWeight: 700, color: m.status?.color || "#111", marginBottom: 4 }}>{m.value}</p>
                {m.status && <span style={{ fontSize: 11, fontWeight: 600, color: m.status.color }}>{m.status.label}</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Tenancy Status */}
        {(p.tenant_name || p.tenancy_end || p.deposit_amount) && (
          <div style={CARD}>
            <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 16 }}>Tenancy</h2>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 20, fontSize: 14 }}>
              {p.tenant_name && <div><span style={{ color: "#6B7280" }}>Tenant: </span><strong>{p.tenant_name}</strong></div>}
              {p.deposit_amount > 0 && <div><span style={{ color: "#6B7280" }}>Deposit: </span><strong>{fmt(p.deposit_amount)}</strong></div>}
              {p.tenancy_start && <div><span style={{ color: "#6B7280" }}>Start: </span><strong>{new Date(p.tenancy_start).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</strong></div>}
              {p.tenancy_end && <div><span style={{ color: "#6B7280" }}>End: </span><strong>{new Date(p.tenancy_end).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</strong></div>}
              {daysUntilEnd !== null && daysUntilEnd >= 0 && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 12px", background: daysUntilEnd <= 90 ? "#FEF3C7" : "#ECFDF5", color: daysUntilEnd <= 90 ? "#92400E" : "#065F46", borderRadius: 20, fontSize: 13, fontWeight: 500 }}>
                  {daysUntilEnd <= 90 ? <AlertTriangle size={12} /> : <CheckCircle size={12} />}
                  {daysUntilEnd} days remaining
                </span>
              )}
            </div>
          </div>
        )}

        {/* What-If Scenarios */}
        <div style={CARD}>
          <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 6 }}>What-If Scenarios</h2>
          <p style={{ fontSize: 13, color: "#666", marginBottom: 20 }}>See how changes affect your monthly cash flow.</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
            <div style={{ background: "#F8FAFC", borderRadius: 12, padding: 18 }}>
              <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Rent increase</h4>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 12, color: "#6B7280", whiteSpace: "nowrap" }}>Extra £/mo</span>
                <input type="number" value={rentExtra} onChange={(e) => setRentExtra(e.target.value)} style={{ width: 70, padding: "6px 8px", border: "1px solid #D1D5DB", borderRadius: 6, fontSize: 13 }} />
              </div>
              <p style={{ fontSize: 13 }}>New profit: <strong style={{ color: newRentCF.net >= 0 ? "#10B981" : "#EF4444" }}>{fmt(Math.round(newRentCF.net))}/mo</strong></p>
            </div>
            <div style={{ background: "#F8FAFC", borderRadius: 12, padding: 18 }}>
              <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Rate change</h4>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 12, color: "#6B7280", whiteSpace: "nowrap" }}>Rate change %</span>
                <input type="number" step="0.1" value={rateRise} onChange={(e) => setRateRise(e.target.value)} style={{ width: 70, padding: "6px 8px", border: "1px solid #D1D5DB", borderRadius: 6, fontSize: 13 }} />
              </div>
              <p style={{ fontSize: 13 }}>New payment: <strong>{fmt(Math.round(newPayment))}/mo</strong></p>
              <p style={{ fontSize: 13 }}>New profit: <strong style={{ color: newRateCF.net >= 0 ? "#10B981" : "#EF4444" }}>{fmt(Math.round(newRateCF.net))}/mo</strong></p>
            </div>
            <div style={{ background: "#F8FAFC", borderRadius: 12, padding: 18 }}>
              <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Void period</h4>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 12, color: "#6B7280", whiteSpace: "nowrap" }}>Void months</span>
                <input type="number" min={1} value={voidMonths} onChange={(e) => setVoidMonths(e.target.value)} style={{ width: 70, padding: "6px 8px", border: "1px solid #D1D5DB", borderRadius: 6, fontSize: 13 }} />
              </div>
              <p style={{ fontSize: 13 }}>Income lost: <strong style={{ color: "#EF4444" }}>{fmt(Math.round(voidLoss))}</strong></p>
            </div>
          </div>
        </div>

        {/* Mortgage Analysis */}
        {amort.schedule.length > 0 && (
          <div style={CARD}>
            <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 6 }}>Mortgage Analysis</h2>
            <p style={{ fontSize: 13, color: "#666", marginBottom: 20 }}>
              {fmt(p.outstanding_balance)} at {p.interest_rate}% — {p.remaining_years} years remaining
            </p>

            <div style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>Balance Over Time</h3>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={amort.schedule}>
                  <defs>
                    <linearGradient id="balGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366F1" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#6366F1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                  <XAxis dataKey="year" tick={{ fontSize: 12 }} tickFormatter={(v) => `Yr ${v}`} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `£${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v) => fmt(v)} labelFormatter={(l) => `Year ${l}`} />
                  <Area type="monotone" dataKey="balance" stroke="#6366F1" strokeWidth={2} fill="url(#balGrad)" name="Balance" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Overpayment Scenarios</h3>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ background: "#F9FAFB" }}>
                  <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600, borderBottom: "1px solid #E5E7EB" }}>Extra/month</th>
                  <th style={{ padding: "10px 12px", textAlign: "right", fontWeight: 600, borderBottom: "1px solid #E5E7EB" }}>Time saved</th>
                  <th style={{ padding: "10px 12px", textAlign: "right", fontWeight: 600, borderBottom: "1px solid #E5E7EB" }}>Interest saved</th>
                </tr>
              </thead>
              <tbody>
                {overpayScenarios.map((s) => (
                  <tr key={s.extra} style={{ borderBottom: "1px solid #F3F4F6" }}>
                    <td style={{ padding: "10px 12px", fontWeight: 500 }}>{fmt(s.extra)}/mo</td>
                    <td style={{ padding: "10px 12px", textAlign: "right", color: "#10B981", fontWeight: 600 }}>{s.monthsSaved > 0 ? `${s.monthsSaved} months` : "—"}</td>
                    <td style={{ padding: "10px 12px", textAlign: "right", color: "#10B981", fontWeight: 600 }}>{s.interestSaved > 0 ? fmt(s.interestSaved) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Add more details (expandable) */}
        <div style={{ ...CARD, padding: 0, overflow: "hidden" }}>
          <button
            onClick={() => setExtrasOpen((o) => !o)}
            style={{ width: "100%", padding: "20px 28px", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 15, fontWeight: 600, color: "#374151" }}
          >
            <span>Add more details</span>
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#6B7280" }}>
              <span style={{ fontSize: 13, fontWeight: 400 }}>Insurance, service charges &amp; maintenance</span>
              {extrasOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </div>
          </button>

          {extrasOpen && (
            <div style={{ padding: "0 28px 28px", borderTop: "1px solid #F3F4F6" }}>
              <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 20, paddingTop: 16 }}>
                These costs will be factored into your cash flow and yield calculations.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
                {[
                  { key: "buildings_insurance", label: "Buildings insurance (£/month)" },
                  { key: "landlord_insurance", label: "Landlord insurance (£/month)" },
                  { key: "ground_rent", label: "Ground rent (£/month)" },
                  { key: "service_charge", label: "Service charge (£/month)" },
                  { key: "maintenance_reserve", label: "Maintenance budget (£/month)" },
                ].map(({ key, label }) => (
                  <div key={key}>
                    <label style={LABEL}>{label}</label>
                    <input
                      style={INPUT}
                      type="number"
                      step="1"
                      value={extras[key]}
                      onChange={(e) => setExtras((x) => ({ ...x, [key]: e.target.value }))}
                      placeholder="0"
                    />
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <button
                  onClick={handleSaveExtras}
                  disabled={savingExtras}
                  style={{ padding: "10px 24px", background: savingExtras ? "#A5B4FC" : "linear-gradient(135deg, #6366F1, #4F46E5)", color: "white", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: savingExtras ? "not-allowed" : "pointer" }}
                >
                  {savingExtras ? "Saving..." : "Save"}
                </button>
                {extrasSaved && (
                  <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, color: "#10B981" }}>
                    <CheckCircle size={14} /> Saved
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
