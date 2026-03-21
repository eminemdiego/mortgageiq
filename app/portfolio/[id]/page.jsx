"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import {
  ArrowLeft, Edit2, Trash2, TrendingUp, AlertTriangle, CheckCircle, Home,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

const fmt = (n) => "£" + Number(n).toLocaleString("en-GB");
const PAGE = { minHeight: "100vh", background: "#FAFBFC", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" };
const CARD = { background: "white", border: "1px solid #E5E7EB", borderRadius: 16, padding: 28, marginBottom: 24 };

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
  const costs = agentFee + (p.buildings_insurance || 0) + (p.landlord_insurance || 0) +
    (p.ground_rent || 0) + (p.service_charge || 0) + (p.maintenance_reserve || 0);
  return { net: p.monthly_rent - p.monthly_payment - costs, agentFee };
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
  const [newAgentPct, setNewAgentPct] = useState("");

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
      setProperty(await res.json());
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this property?")) return;
    await fetch(`/api/portfolio/${params.id}`, { method: "DELETE" });
    router.push("/portfolio");
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
  const { net: netCF, agentFee } = calcCashFlow(p);
  const grossYield = p.estimated_value ? ((p.monthly_rent * 12) / p.estimated_value * 100) : 0;
  const totalCosts = agentFee + (p.buildings_insurance || 0) + (p.landlord_insurance || 0) +
    (p.ground_rent || 0) + (p.service_charge || 0) + (p.maintenance_reserve || 0) + (p.monthly_payment || 0);
  const netYield = p.estimated_value ? (((p.monthly_rent - totalCosts) * 12) / p.estimated_value * 100) : 0;
  const equity = (p.estimated_value || 0) - (p.outstanding_balance || 0);
  const annualInterest = (p.outstanding_balance || 0) * (p.interest_rate || 0) / 100;
  const icr = annualInterest > 0 ? (p.monthly_rent * 12) / annualInterest : 0;
  const rentToMortgage = p.monthly_payment > 0 ? (p.monthly_rent / p.monthly_payment).toFixed(2) : "N/A";

  // Amortisation
  const amort = p.outstanding_balance && p.interest_rate && p.monthly_payment && p.remaining_years
    ? buildAmortization(p.outstanding_balance, p.interest_rate, p.monthly_payment)
    : { schedule: [], totalMonths: 0, totalInterest: 0 };

  // Overpayment scenarios
  const overpayScenarios = [100, 200, 300].map((extra) => {
    const base = buildAmortization(p.outstanding_balance, p.interest_rate, p.monthly_payment);
    const ov = buildAmortization(p.outstanding_balance, p.interest_rate, p.monthly_payment, extra);
    return {
      extra,
      monthsSaved: base.totalMonths - ov.totalMonths,
      interestSaved: base.totalInterest - ov.totalInterest,
    };
  });

  // Tenancy countdown
  const tenancyEnd = p.tenancy_end ? new Date(p.tenancy_end) : null;
  const daysUntilEnd = tenancyEnd ? Math.round((tenancyEnd - new Date()) / (1000 * 60 * 60 * 24)) : null;

  // What-if scenarios
  const newRentCF = calcCashFlow({ ...p, monthly_rent: (p.monthly_rent || 0) + Number(rentExtra) });
  const newRentYield = p.estimated_value ? (((p.monthly_rent + Number(rentExtra)) * 12) / p.estimated_value * 100).toFixed(1) : 0;
  const newRate = (p.interest_rate || 0) + Number(rateRise);
  const newPayment = p.outstanding_balance && p.remaining_years
    ? calcMonthlyPayment(p.outstanding_balance, newRate, p.remaining_years)
    : p.monthly_payment;
  const newRateCF = calcCashFlow({ ...p, monthly_payment: newPayment });
  const voidLoss = (p.monthly_rent || 0) * Number(voidMonths);
  const currentAgentFee = (p.monthly_rent * (p.management_fee_pct || 0)) / 100;
  const newAgentFee = newAgentPct !== "" ? (p.monthly_rent * parseFloat(newAgentPct)) / 100 : currentAgentFee;
  const agentSaving = currentAgentFee - newAgentFee;

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
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 6, display: "flex", alignItems: "center", gap: 10 }}>
            <Home size={24} color="#6366F1" /> {p.address}
          </h1>
          <div style={{ display: "flex", gap: 8 }}>
            <span style={{ padding: "4px 12px", background: "#EEF2FF", color: "#6366F1", borderRadius: 6, fontSize: 13, fontWeight: 500 }}>{p.property_type}</span>
            <span style={{ padding: "4px 12px", background: "#F3F4F6", color: "#374151", borderRadius: 6, fontSize: 13 }}>{p.bedrooms} bed</span>
            {p.lender && <span style={{ padding: "4px 12px", background: "#FEF3C7", color: "#92400E", borderRadius: 6, fontSize: 13 }}>{p.lender}</span>}
          </div>
        </div>

        {/* Summary stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
          {[
            { label: "Monthly Rent", value: fmt(p.monthly_rent) },
            { label: "Net Cash Flow", value: fmt(Math.round(netCF)), color: netCF >= 0 ? "#10B981" : "#EF4444" },
            { label: "Gross Yield", value: grossYield.toFixed(1) + "%" },
            { label: "Equity", value: fmt(Math.round(equity)), color: equity >= 0 ? "#10B981" : "#EF4444" },
          ].map((s, i) => (
            <div key={i} style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: 14, padding: "20px 18px" }}>
              <p style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>{s.label}</p>
              <p style={{ fontSize: 22, fontWeight: 700, color: s.color || "#111" }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Cash flow breakdown */}
        <div style={CARD}>
          <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 20 }}>Monthly Cash Flow Breakdown</h2>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <tbody>
              {[
                { label: "Monthly Rent", value: p.monthly_rent, positive: true },
                { label: "Less: Mortgage Payment", value: -p.monthly_payment },
                { label: `Less: Agent Fee (${p.management_fee_pct || 0}%)`, value: -agentFee },
                { label: "Less: Buildings Insurance", value: -(p.buildings_insurance || 0) },
                { label: "Less: Landlord Insurance", value: -(p.landlord_insurance || 0) },
                { label: "Less: Ground Rent", value: -(p.ground_rent || 0) },
                { label: "Less: Service Charge", value: -(p.service_charge || 0) },
                { label: "Less: Maintenance Reserve", value: -(p.maintenance_reserve || 0) },
              ].map((row, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #F3F4F6" }}>
                  <td style={{ padding: "10px 0", color: "#374151" }}>{row.label}</td>
                  <td style={{ padding: "10px 0", textAlign: "right", color: row.positive ? "#10B981" : "#374151", fontWeight: 500 }}>{fmt(Math.abs(row.value))}</td>
                </tr>
              ))}
              <tr style={{ borderTop: "2px solid #E5E7EB", background: "#FAFBFC" }}>
                <td style={{ padding: "14px 0", fontWeight: 700, fontSize: 15 }}>= Net Monthly Profit</td>
                <td style={{ padding: "14px 0", textAlign: "right", fontWeight: 700, fontSize: 18, color: netCF >= 0 ? "#10B981" : "#EF4444" }}>{fmt(Math.round(netCF))}</td>
              </tr>
              <tr>
                <td style={{ padding: "8px 0", color: "#666", fontSize: 13 }}>Annual Projection</td>
                <td style={{ padding: "8px 0", textAlign: "right", color: netCF >= 0 ? "#10B981" : "#EF4444", fontSize: 13, fontWeight: 600 }}>{fmt(Math.round(netCF * 12))}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Investment Metrics */}
        <div style={CARD}>
          <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 20 }}>Key Investment Metrics</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 16 }}>
            {[
              { label: "Gross Yield", value: grossYield.toFixed(1) + "%", status: metricStatus(grossYield, [6, 4]) },
              { label: "Net Yield", value: netYield.toFixed(1) + "%", status: metricStatus(netYield, [4, 2]) },
              { label: "Rent / Mortgage", value: rentToMortgage + "x", status: metricStatus(parseFloat(rentToMortgage), [1.5, 1.2]) },
              { label: "ICR", value: icr.toFixed(2) + "x", status: metricStatus(icr, [1.45, 1.2]) },
            ].map((m, i) => (
              <div key={i} style={{ background: m.status.bg, borderRadius: 12, padding: "18px 16px", textAlign: "center" }}>
                <p style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>{m.label}</p>
                <p style={{ fontSize: 24, fontWeight: 700, color: m.status.color, marginBottom: 6 }}>{m.value}</p>
                <span style={{ fontSize: 11, fontWeight: 600, color: m.status.color }}>{m.status.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Tenancy Status */}
        <div style={CARD}>
          <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 20 }}>Tenancy Status</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <div>
              <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                <span style={{ padding: "6px 14px", background: p.is_tenanted ? "#ECFDF5" : "#FEE2E2", color: p.is_tenanted ? "#10B981" : "#EF4444", borderRadius: 8, fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                  {p.is_tenanted ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
                  {p.is_tenanted ? "Currently Tenanted" : "Currently Void"}
                </span>
              </div>
              {p.tenant_name && <p style={{ fontSize: 14, marginBottom: 8 }}><b>Tenant:</b> {p.tenant_name}</p>}
              {p.deposit_amount > 0 && <p style={{ fontSize: 14, marginBottom: 8 }}><b>Deposit:</b> {fmt(p.deposit_amount)}</p>}
              {p.tenancy_start && <p style={{ fontSize: 14, marginBottom: 8 }}><b>Start:</b> {new Date(p.tenancy_start).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</p>}
              {p.tenancy_end && <p style={{ fontSize: 14, marginBottom: 8 }}><b>End:</b> {new Date(p.tenancy_end).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</p>}
            </div>
            <div>
              {daysUntilEnd !== null && (
                <div style={{ padding: 20, background: daysUntilEnd < 0 ? "#FEE2E2" : daysUntilEnd < 60 ? "#FEF3C7" : "#ECFDF5", borderRadius: 12 }}>
                  {daysUntilEnd < 0 ? (
                    <><AlertTriangle size={20} color="#EF4444" style={{ marginBottom: 8 }} /><p style={{ fontWeight: 700, color: "#EF4444", marginBottom: 4 }}>Tenancy Expired</p><p style={{ fontSize: 13, color: "#666" }}>Expired {Math.abs(daysUntilEnd)} days ago</p></>
                  ) : daysUntilEnd < 60 ? (
                    <><AlertTriangle size={20} color="#F59E0B" style={{ marginBottom: 8 }} /><p style={{ fontWeight: 700, color: "#92400E", marginBottom: 4 }}>Void Risk</p><p style={{ fontSize: 13, color: "#666" }}>{daysUntilEnd} days until tenancy ends — re-let soon to avoid void period</p></>
                  ) : (
                    <><CheckCircle size={20} color="#10B981" style={{ marginBottom: 8 }} /><p style={{ fontWeight: 700, color: "#065F46", marginBottom: 4 }}>Tenancy Secure</p><p style={{ fontSize: 13, color: "#666" }}>{daysUntilEnd} days remaining</p></>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* What-If Scenarios */}
        <div style={CARD}>
          <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 6 }}>What-If Scenarios</h2>
          <p style={{ fontSize: 13, color: "#666", marginBottom: 24 }}>Adjust the inputs to see how changes affect your cash flow.</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            {/* a. Rent increase */}
            <div style={{ background: "#F8FAFC", borderRadius: 12, padding: 20 }}>
              <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Rent Increase</h4>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <span style={{ fontSize: 13, color: "#666" }}>Extra £/month:</span>
                <input type="number" value={rentExtra} onChange={(e) => setRentExtra(e.target.value)} style={{ width: 90, padding: "6px 10px", border: "1px solid #D1D5DB", borderRadius: 8, fontSize: 14 }} />
              </div>
              <p style={{ fontSize: 13 }}>New cash flow: <b style={{ color: newRentCF.net >= 0 ? "#10B981" : "#EF4444" }}>{fmt(Math.round(newRentCF.net))}/mo</b></p>
              <p style={{ fontSize: 13 }}>New gross yield: <b>{newRentYield}%</b></p>
            </div>

            {/* b. Rate rise */}
            <div style={{ background: "#F8FAFC", borderRadius: 12, padding: 20 }}>
              <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Rate Rise</h4>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <span style={{ fontSize: 13, color: "#666" }}>Rate change %:</span>
                <input type="number" step="0.1" value={rateRise} onChange={(e) => setRateRise(e.target.value)} style={{ width: 90, padding: "6px 10px", border: "1px solid #D1D5DB", borderRadius: 8, fontSize: 14 }} />
              </div>
              <p style={{ fontSize: 13 }}>New payment: <b>{fmt(Math.round(newPayment))}/mo</b></p>
              <p style={{ fontSize: 13 }}>New cash flow: <b style={{ color: newRateCF.net >= 0 ? "#10B981" : "#EF4444" }}>{fmt(Math.round(newRateCF.net))}/mo</b></p>
            </div>

            {/* c. Void period */}
            <div style={{ background: "#F8FAFC", borderRadius: 12, padding: 20 }}>
              <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Void Period</h4>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <span style={{ fontSize: 13, color: "#666" }}>Void months:</span>
                <input type="number" min={1} value={voidMonths} onChange={(e) => setVoidMonths(e.target.value)} style={{ width: 90, padding: "6px 10px", border: "1px solid #D1D5DB", borderRadius: 8, fontSize: 14 }} />
              </div>
              <p style={{ fontSize: 13 }}>Annual income lost: <b style={{ color: "#EF4444" }}>{fmt(Math.round(voidLoss))}</b></p>
            </div>

            {/* d. Agent fee change */}
            <div style={{ background: "#F8FAFC", borderRadius: 12, padding: 20 }}>
              <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Agent Fee Change</h4>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <span style={{ fontSize: 13, color: "#666" }}>New fee %:</span>
                <input type="number" step="0.5" value={newAgentPct} onChange={(e) => setNewAgentPct(e.target.value)} placeholder={p.management_fee_pct || 0} style={{ width: 90, padding: "6px 10px", border: "1px solid #D1D5DB", borderRadius: 8, fontSize: 14 }} />
              </div>
              <p style={{ fontSize: 13 }}>New agent fee: <b>{fmt(Math.round(newAgentFee))}/mo</b></p>
              <p style={{ fontSize: 13 }}>Monthly {agentSaving >= 0 ? "saving" : "extra cost"}: <b style={{ color: agentSaving >= 0 ? "#10B981" : "#EF4444" }}>{fmt(Math.abs(Math.round(agentSaving)))}</b></p>
            </div>
          </div>
        </div>

        {/* Mortgage Analysis */}
        {amort.schedule.length > 0 && (
          <div style={CARD}>
            <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 6 }}>Mortgage Analysis</h2>
            <p style={{ fontSize: 13, color: "#666", marginBottom: 24 }}>Outstanding balance: <b>{fmt(p.outstanding_balance)}</b> at <b>{p.interest_rate}%</b></p>

            <div style={{ marginBottom: 28 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Balance Over Time</h3>
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
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `£${(v/1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v) => fmt(v)} labelFormatter={(l) => `Year ${l}`} />
                  <Area type="monotone" dataKey="balance" stroke="#6366F1" strokeWidth={2} fill="url(#balGrad)" name="Balance" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>Overpayment Scenarios</h3>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ background: "#F9FAFB" }}>
                  <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600, borderBottom: "1px solid #E5E7EB" }}>Extra/month</th>
                  <th style={{ padding: "10px 12px", textAlign: "right", fontWeight: 600, borderBottom: "1px solid #E5E7EB" }}>Months saved</th>
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
      </div>
    </div>
  );
}
