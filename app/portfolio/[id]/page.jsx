"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import {
  ArrowLeft, Edit2, Trash2, AlertTriangle, CheckCircle, ChevronDown, ChevronUp,
  Upload, X, Loader,
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

  // Tenancy prompt state
  const [showTenancyPrompt, setShowTenancyPrompt] = useState(false);
  const [tenancyPromptStep, setTenancyPromptStep] = useState("ask"); // ask | left | rent_changed
  const [newRentAmount, setNewRentAmount] = useState("");
  const [savingTenancy, setSavingTenancy] = useState(false);

  // Rent increase state
  const [showRentIncrease, setShowRentIncrease] = useState(false);
  const [rentIncreaseAmount, setRentIncreaseAmount] = useState("");
  const [rentIncreaseDate, setRentIncreaseDate] = useState(new Date().toISOString().split("T")[0]);
  const [savingRentIncrease, setSavingRentIncrease] = useState(false);

  // Certificates state
  const [certificates, setCertificates] = useState([]);
  const [certModalOpen, setCertModalOpen] = useState(null); // cert_type or null
  const [certDateIssued, setCertDateIssued] = useState("");
  const [certExpiryDate, setCertExpiryDate] = useState("");
  const [certEpcRating, setCertEpcRating] = useState("");
  const [certNotes, setCertNotes] = useState("");
  const [certUploading, setCertUploading] = useState(false);
  const [certSaving, setCertSaving] = useState(false);
  const [certFileUrl, setCertFileUrl] = useState("");

  // Expenses state
  const [expenses, setExpenses] = useState([]);
  const [expensesOpen, setExpensesOpen] = useState(false);
  const [expensesParsing, setExpensesParsing] = useState(false);
  const [expensePreview, setExpensePreview] = useState(null);
  const [savingExpense, setSavingExpense] = useState(false);
  const [expenseError, setExpenseError] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") router.push("/auth/signin");
  }, [status, router]);

  useEffect(() => {
    if (session?.user?.id) {
      fetchProperty();
      fetchExpenses();
      fetchCertificates();
    }
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

  const fetchExpenses = async () => {
    try {
      const res = await fetch(`/api/portfolio/${params.id}/expenses`);
      if (res.ok) setExpenses(await res.json());
    } catch { /* silent */ }
  };

  const handleInvoiceUpload = async (file) => {
    if (!file) return;
    setExpensesParsing(true);
    setExpenseError("");
    setExpensePreview(null);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/api/invoice-parse", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      setExpensePreview(json);
    } catch (err) {
      setExpenseError(err.message);
    } finally {
      setExpensesParsing(false);
    }
  };

  const handleSaveExpense = async () => {
    if (!expensePreview) return;
    setSavingExpense(true);
    setExpenseError("");
    try {
      const res = await fetch(`/api/portfolio/${params.id}/expenses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(expensePreview),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      setExpensePreview(null);
      await fetchExpenses();
    } catch (err) {
      setExpenseError(err.message);
    } finally {
      setSavingExpense(false);
    }
  };

  const handleDeleteExpense = async (expenseId) => {
    if (!confirm("Delete this expense?")) return;
    await fetch(`/api/portfolio/${params.id}/expenses?expenseId=${expenseId}`, { method: "DELETE" });
    setExpenses((prev) => prev.filter((e) => e.id !== expenseId));
  };

  const handleDelete = async () => {
    if (!confirm("Delete this property?")) return;
    await fetch(`/api/portfolio/${params.id}`, { method: "DELETE" });
    router.push("/portfolio");
  };

  // Check if tenancy has expired and user hasn't dismissed prompt
  useEffect(() => {
    if (property && property.tenancy_end && !property.tenancy_status) {
      const days = Math.round((new Date(property.tenancy_end) - new Date()) / (1000 * 60 * 60 * 24));
      if (days < 0) setShowTenancyPrompt(true);
    }
  }, [property]);

  const handleTenancyStillOngoing = async () => {
    setSavingTenancy(true);
    try {
      const res = await fetch(`/api/portfolio/${params.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenancy_status: "rolling_periodic" }),
      });
      if (res.ok) {
        const updated = await res.json();
        setProperty(updated);
        setShowTenancyPrompt(false);
      }
    } finally { setSavingTenancy(false); }
  };

  const handleTenantLeft = async () => {
    setSavingTenancy(true);
    try {
      const res = await fetch(`/api/portfolio/${params.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenancy_status: "vacant", is_tenanted: false }),
      });
      if (res.ok) {
        const updated = await res.json();
        setProperty(updated);
        setShowTenancyPrompt(false);
      }
    } finally { setSavingTenancy(false); }
  };

  const handleRentChanged = async () => {
    if (!newRentAmount) return;
    setSavingTenancy(true);
    try {
      const res = await fetch(`/api/portfolio/${params.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenancy_status: "rolling_periodic",
          previous_rent: property.monthly_rent,
          monthly_rent: parseFloat(newRentAmount),
          last_rent_increase_date: new Date().toISOString().split("T")[0],
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setProperty(updated);
        setShowTenancyPrompt(false);
      }
    } finally { setSavingTenancy(false); }
  };

  const fetchCertificates = async () => {
    try {
      const res = await fetch(`/api/portfolio/${params.id}/certificates`);
      if (res.ok) setCertificates(await res.json());
    } catch { /* silent */ }
  };

  const CERT_TYPES = [
    { key: "gas_safety", label: "Gas Safety (CP12)", icon: "🔥", renewalMonths: 12 },
    { key: "epc", label: "EPC", icon: "📊", renewalMonths: 120, hasRating: true },
    { key: "eicr", label: "EICR", icon: "⚡", renewalMonths: 60 },
    { key: "legionella", label: "Legionella", icon: "🦠", renewalMonths: 24 },
    { key: "landlord_insurance", label: "Insurance", icon: "🛡️", renewalMonths: 12 },
    { key: "smoke_co_alarms", label: "Smoke & CO", icon: "🔔", renewalMonths: 12 },
    { key: "pat", label: "PAT Testing", icon: "🔌", renewalMonths: 12 },
    { key: "asbestos", label: "Asbestos", icon: "⚠️", renewalMonths: null },
  ];

  const getCertStatus = (cert) => {
    if (!cert || !cert.expiry_date) return { label: "Not set", color: "#9CA3AF", bg: "#F3F4F6" };
    const d = new Date(cert.expiry_date);
    const now = new Date();
    if (d < now) return { label: "Expired", color: "#EF4444", bg: "#FEE2E2" };
    const days = Math.round((d - now) / 86400000);
    if (days <= 30) return { label: `${days}d left`, color: "#F59E0B", bg: "#FEF3C7" };
    return { label: "Valid", color: "#10B981", bg: "#ECFDF5" };
  };

  const openCertModal = (certType) => {
    const existing = certificates.find(c => c.cert_type === certType.key);
    setCertDateIssued(existing?.date_issued || "");
    setCertExpiryDate(existing?.expiry_date || "");
    setCertEpcRating(existing?.epc_rating || "");
    setCertNotes(existing?.notes || "");
    setCertFileUrl(existing?.file_url || "");
    setCertModalOpen(certType.key);
  };

  const handleCertDateChange = (dateIssued, certKey) => {
    setCertDateIssued(dateIssued);
    const ct = CERT_TYPES.find(c => c.key === certKey);
    if (ct?.renewalMonths && dateIssued) {
      const d = new Date(dateIssued);
      d.setMonth(d.getMonth() + ct.renewalMonths);
      setCertExpiryDate(d.toISOString().split("T")[0]);
    }
  };

  const handleCertUpload = async (file) => {
    if (!file) return;
    setCertUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("cert_type", certModalOpen);
      const res = await fetch(`/api/portfolio/${params.id}/certificates/upload`, { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok) setCertFileUrl(data.url);
    } catch { /* silent */ }
    finally { setCertUploading(false); }
  };

  const handleSaveCert = async () => {
    if (!certDateIssued) return;
    setCertSaving(true);
    try {
      const res = await fetch(`/api/portfolio/${params.id}/certificates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cert_type: certModalOpen,
          date_issued: certDateIssued,
          expiry_date: certExpiryDate || null,
          notes: certNotes || null,
          epc_rating: certEpcRating || null,
          file_url: certFileUrl || null,
        }),
      });
      if (res.ok) {
        await fetchCertificates();
        setCertModalOpen(null);
      }
    } catch { /* silent */ }
    finally { setCertSaving(false); }
  };

  const handleRecordRentIncrease = async () => {
    if (!rentIncreaseAmount) return;
    setSavingRentIncrease(true);
    try {
      const res = await fetch(`/api/portfolio/${params.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          previous_rent: property.monthly_rent,
          monthly_rent: parseFloat(rentIncreaseAmount),
          last_rent_increase_date: rentIncreaseDate,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setProperty(updated);
        setShowRentIncrease(false);
        setRentIncreaseAmount("");
      }
    } finally { setSavingRentIncrease(false); }
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

        {/* Tenancy status badge */}
        {p.tenancy_status === "rolling_periodic" && (
          <div style={{ marginBottom: 24, padding: "14px 20px", background: "#EEF2FF", border: "1px solid #C7D2FE", borderRadius: 12, display: "flex", alignItems: "center", gap: 12 }}>
            <CheckCircle size={18} color="#6366F1" />
            <div>
              <p style={{ fontWeight: 600, color: "#4338CA", marginBottom: 2, fontSize: 14 }}>Rolling (Periodic) Tenancy</p>
              <p style={{ fontSize: 12, color: "#6B7280" }}>Under current UK rental legislation, tenancies automatically become rolling periodic contracts after the fixed term ends.</p>
            </div>
          </div>
        )}
        {p.tenancy_status === "vacant" && (
          <div style={{ marginBottom: 24, padding: "14px 20px", background: "#FEE2E2", border: "1px solid #FECACA", borderRadius: 12, display: "flex", alignItems: "center", gap: 12 }}>
            <AlertTriangle size={18} color="#EF4444" />
            <p style={{ fontWeight: 600, color: "#991B1B", fontSize: 14 }}>Property is currently vacant</p>
          </div>
        )}

        {/* Fixed-term tenancy ending soon alert (only for non-rolling, non-vacant) */}
        {daysUntilEnd !== null && daysUntilEnd > 0 && daysUntilEnd <= 90 && !p.tenancy_status && (
          <div style={{ marginBottom: 24, padding: "16px 20px", background: "#FEF3C7", border: "1px solid #FDE68A", borderRadius: 12, display: "flex", alignItems: "center", gap: 12 }}>
            <AlertTriangle size={20} color="#F59E0B" />
            <div>
              <p style={{ fontWeight: 700, color: "#92400E", marginBottom: 2, fontSize: 14 }}>Tenancy ending in {daysUntilEnd} days</p>
              <p style={{ fontSize: 13, color: "#6B7280" }}>The fixed term ends soon. Under UK law it will automatically become a rolling periodic tenancy.</p>
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
                <span>Estate agent fee ({p.management_fee_pct}% exc. VAT)</span>
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
        {(p.tenant_name || p.tenancy_end || p.deposit_amount) && (() => {
          const te = p.tenancy_extras || {};
          const fiveWeeksCap = p.monthly_rent ? Math.round((p.monthly_rent * 12) / 52 * 5) : null;
          const depositOverCap = fiveWeeksCap && p.deposit_amount > fiveWeeksCap;
          const breakDate = te.break_clause_date ? new Date(te.break_clause_date) : null;
          const daysToBreak = breakDate ? Math.round((breakDate - new Date()) / 86400000) : null;

          return (
            <div style={CARD}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                <h2 style={{ fontSize: 17, fontWeight: 700 }}>Tenancy</h2>
                {p.tenancy_status === "rolling_periodic" && (
                  <span style={{ padding: "4px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, background: "#EEF2FF", color: "#4338CA" }}>Rolling (Periodic)</span>
                )}
                {p.tenancy_status === "vacant" && (
                  <span style={{ padding: "4px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, background: "#FEE2E2", color: "#991B1B" }}>Vacant</span>
                )}
              </div>

              {/* Inline tenancy prompt — when end date passed and status not yet set */}
              {showTenancyPrompt && (
                <div style={{ marginBottom: 20, padding: "18px 20px", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 12 }}>
                  {tenancyPromptStep === "ask" && (
                    <>
                      <p style={{ fontWeight: 600, color: "#92400E", marginBottom: 8, fontSize: 14 }}>Your original tenancy end date has passed. Is this tenancy still ongoing at the same rental rate?</p>
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        <button onClick={handleTenancyStillOngoing} disabled={savingTenancy} style={{ padding: "8px 18px", background: "#10B981", color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                          {savingTenancy ? "Saving..." : "Yes — still ongoing"}
                        </button>
                        <button onClick={() => setTenancyPromptStep("left")} style={{ padding: "8px 18px", background: "white", color: "#374151", border: "1px solid #D1D5DB", borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
                          No — tenant has left
                        </button>
                        <button onClick={() => setTenancyPromptStep("rent_changed")} style={{ padding: "8px 18px", background: "white", color: "#374151", border: "1px solid #D1D5DB", borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
                          Rent has changed
                        </button>
                      </div>
                    </>
                  )}
                  {tenancyPromptStep === "left" && (
                    <>
                      <p style={{ fontWeight: 600, color: "#92400E", marginBottom: 10, fontSize: 14 }}>Mark property as vacant?</p>
                      <div style={{ display: "flex", gap: 10 }}>
                        <button onClick={handleTenantLeft} disabled={savingTenancy} style={{ padding: "8px 18px", background: "#EF4444", color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                          {savingTenancy ? "Saving..." : "Yes, mark as vacant"}
                        </button>
                        <button onClick={() => setTenancyPromptStep("ask")} style={{ padding: "8px 18px", background: "white", color: "#374151", border: "1px solid #D1D5DB", borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: "pointer" }}>Back</button>
                      </div>
                    </>
                  )}
                  {tenancyPromptStep === "rent_changed" && (
                    <>
                      <p style={{ fontWeight: 600, color: "#92400E", marginBottom: 10, fontSize: 14 }}>Update rent amount</p>
                      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
                        <span style={{ fontSize: 13, color: "#6B7280" }}>New monthly rent:</span>
                        <input type="number" value={newRentAmount} onChange={(e) => setNewRentAmount(e.target.value)} placeholder={String(p.monthly_rent)} style={{ width: 120, padding: "7px 12px", border: "1px solid #D1D5DB", borderRadius: 8, fontSize: 14 }} />
                      </div>
                      <div style={{ display: "flex", gap: 10 }}>
                        <button onClick={handleRentChanged} disabled={savingTenancy || !newRentAmount} style={{ padding: "8px 18px", background: "#6366F1", color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: !newRentAmount ? 0.5 : 1 }}>
                          {savingTenancy ? "Saving..." : "Update & mark as rolling"}
                        </button>
                        <button onClick={() => setTenancyPromptStep("ask")} style={{ padding: "8px 18px", background: "white", color: "#374151", border: "1px solid #D1D5DB", borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: "pointer" }}>Back</button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Core info grid — no end date */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 20 }}>
                {p.tenant_name && (
                  <div><p style={{ fontSize: 11, color: "#6B7280", marginBottom: 3 }}>Tenant</p><p style={{ fontWeight: 600 }}>{p.tenant_name}</p></div>
                )}
                {p.tenancy_start && (
                  <div><p style={{ fontSize: 11, color: "#6B7280", marginBottom: 3 }}>Start date</p><p style={{ fontWeight: 600 }}>{new Date(p.tenancy_start).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</p></div>
                )}
                {te.notice_period_months && (
                  <div><p style={{ fontSize: 11, color: "#6B7280", marginBottom: 3 }}>Notice period</p><p style={{ fontWeight: 600 }}>{te.notice_period_months} {te.notice_period_months === 1 ? "month" : "months"}</p></div>
                )}
                {te.pet_clause && (
                  <div><p style={{ fontSize: 11, color: "#6B7280", marginBottom: 3 }}>Pets</p><p style={{ fontWeight: 600, color: te.pet_clause === "not_allowed" ? "#EF4444" : te.pet_clause === "allowed" ? "#10B981" : "#F59E0B" }}>{te.pet_clause === "allowed" ? "Allowed" : te.pet_clause === "not_allowed" ? "Not allowed" : "With permission"}</p></div>
                )}
                {te.permitted_occupants && (
                  <div><p style={{ fontSize: 11, color: "#6B7280", marginBottom: 3 }}>Max occupants</p><p style={{ fontWeight: 600 }}>{te.permitted_occupants}</p></div>
                )}
              </div>

              {/* Break clause alert */}
              {breakDate && daysToBreak !== null && (
                <div style={{ marginBottom: 16, padding: "12px 16px", background: daysToBreak <= 60 ? "#FEF3C7" : "#F0FDF4", border: `1px solid ${daysToBreak <= 60 ? "#FDE68A" : "#BBF7D0"}`, borderRadius: 10, fontSize: 13 }}>
                  <p style={{ fontWeight: 600, color: daysToBreak <= 60 ? "#92400E" : "#065F46", marginBottom: 2 }}>
                    Break clause: {daysToBreak < 0 ? "Passed" : `Available in ${daysToBreak} days`} ({breakDate.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })})
                  </p>
                  {te.break_clause_notice_months && (
                    <p style={{ color: "#6B7280" }}>{te.break_clause_notice_months}-month notice required.{daysToBreak > 0 && ` Serve notice by ${new Date(breakDate - te.break_clause_notice_months * 30 * 86400000).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}.`}</p>
                  )}
                </div>
              )}

              {/* Deposit */}
              {p.deposit_amount > 0 && (
                <div style={{ padding: "14px 16px", background: depositOverCap ? "#FEE2E2" : "#F0FDF4", border: `1px solid ${depositOverCap ? "#FECACA" : "#BBF7D0"}`, borderRadius: 10, fontSize: 13 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                    <div>
                      <p style={{ fontWeight: 600, color: depositOverCap ? "#991B1B" : "#065F46", marginBottom: 2 }}>
                        Deposit: {fmt(p.deposit_amount)}{te.deposit_scheme ? ` — protected with ${te.deposit_scheme}` : ""}
                      </p>
                      {fiveWeeksCap && (
                        <p style={{ color: "#6B7280" }}>
                          {depositOverCap
                            ? `Exceeds the 5-week legal cap of ${fmt(fiveWeeksCap)} — check compliance.`
                            : `Within the 5-week cap (${fmt(fiveWeeksCap)}).`}
                        </p>
                      )}
                    </div>
                    {!te.deposit_scheme && (
                      <span style={{ fontSize: 12, background: "#FEF3C7", color: "#92400E", padding: "3px 10px", borderRadius: 20, fontWeight: 500 }}>Scheme not recorded</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* Compliance summary banner */}
        {(() => {
          const expiredCerts = CERT_TYPES.filter(ct => getCertStatus(certificates.find(c => c.cert_type === ct.key)).label === "Expired");
          const expiringCerts = CERT_TYPES.filter(ct => { const s = getCertStatus(certificates.find(c => c.cert_type === ct.key)); return s.label !== "Valid" && s.label !== "Not set" && s.label !== "Expired"; });
          const allValid = expiredCerts.length === 0 && expiringCerts.length === 0 && certificates.length > 0;

          if (certificates.length === 0 && CERT_TYPES.length > 0) return null;

          return (
            <div style={{ marginBottom: 24, padding: "14px 20px", borderRadius: 12, display: "flex", alignItems: "center", gap: 12, background: expiredCerts.length > 0 ? "#FEE2E2" : expiringCerts.length > 0 ? "#FEF3C7" : "#ECFDF5", border: `1px solid ${expiredCerts.length > 0 ? "#FECACA" : expiringCerts.length > 0 ? "#FDE68A" : "#BBF7D0"}` }}>
              {expiredCerts.length > 0 ? <AlertTriangle size={18} color="#EF4444" /> : expiringCerts.length > 0 ? <AlertTriangle size={18} color="#F59E0B" /> : <CheckCircle size={18} color="#10B981" />}
              <p style={{ fontSize: 14, fontWeight: 600, color: expiredCerts.length > 0 ? "#991B1B" : expiringCerts.length > 0 ? "#92400E" : "#065F46", margin: 0 }}>
                {expiredCerts.length > 0 ? `${expiredCerts.length} certificate${expiredCerts.length > 1 ? "s" : ""} expired` : ""}
                {expiredCerts.length > 0 && expiringCerts.length > 0 ? ", " : ""}
                {expiringCerts.length > 0 ? `${expiringCerts.length} expiring soon` : ""}
                {allValid ? "All certificates valid" : ""}
              </p>
            </div>
          );
        })()}

        {/* Compliance & Certificates */}
        <div style={CARD}>
          <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 20 }}>Compliance & Certificates</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
            {CERT_TYPES.map((ct) => {
              const cert = certificates.find(c => c.cert_type === ct.key);
              const s = getCertStatus(cert);
              return (
                <div key={ct.key} style={{ background: s.bg, borderRadius: 12, padding: "16px 14px", textAlign: "center", cursor: "pointer", transition: "transform 0.15s", border: `1px solid ${s.color}22` }} onClick={() => openCertModal(ct)}>
                  <p style={{ fontSize: 20, marginBottom: 6 }}>{ct.icon}</p>
                  <p style={{ fontSize: 11, fontWeight: 600, color: "#374151", marginBottom: 4 }}>{ct.label}</p>
                  {cert?.epc_rating && <p style={{ fontSize: 18, fontWeight: 700, color: "#4F46E5", marginBottom: 2 }}>{cert.epc_rating}</p>}
                  <p style={{ fontSize: 11, fontWeight: 600, color: s.color }}>{s.label}</p>
                  {cert?.expiry_date && <p style={{ fontSize: 10, color: "#9CA3AF", marginTop: 2 }}>{new Date(cert.expiry_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</p>}
                  {cert?.file_url ? (
                    <a href={cert.file_url} target="_blank" rel="noopener" onClick={(e) => e.stopPropagation()} style={{ display: "inline-block", marginTop: 6, fontSize: 10, color: "#6366F1", fontWeight: 600, textDecoration: "none" }}>View PDF</a>
                  ) : (
                    <p style={{ fontSize: 10, color: "#6366F1", marginTop: 6, fontWeight: 500 }}>Upload</p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Certificate modal */}
          {certModalOpen && (() => {
            const ct = CERT_TYPES.find(c => c.key === certModalOpen);
            return (
              <div style={{ marginTop: 20, padding: "20px 22px", background: "#F8FAFC", borderRadius: 12, border: "1px solid #E5E7EB" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>{ct.icon} {ct.label}</h3>
                  <button onClick={() => setCertModalOpen(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#9CA3AF" }}>✕</button>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
                  <div>
                    <label style={LABEL}>Date issued</label>
                    <input type="date" value={certDateIssued} onChange={(e) => handleCertDateChange(e.target.value, certModalOpen)} style={INPUT} />
                  </div>
                  <div>
                    <label style={LABEL}>Expiry date {ct.renewalMonths ? "(auto-calculated)" : ""}</label>
                    <input type="date" value={certExpiryDate} onChange={(e) => setCertExpiryDate(e.target.value)} style={INPUT} />
                  </div>
                </div>

                {ct.hasRating && (
                  <div style={{ marginBottom: 14 }}>
                    <label style={LABEL}>EPC Rating</label>
                    <select value={certEpcRating} onChange={(e) => setCertEpcRating(e.target.value)} style={{ ...INPUT, width: 100 }}>
                      <option value="">—</option>
                      {["A", "B", "C", "D", "E", "F", "G"].map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                    {certEpcRating && ["F", "G"].includes(certEpcRating) && (
                      <p style={{ fontSize: 12, color: "#EF4444", marginTop: 4 }}>Rating must be E or above to legally rent out.</p>
                    )}
                  </div>
                )}

                <div style={{ marginBottom: 14 }}>
                  <label style={LABEL}>Notes (optional)</label>
                  <input type="text" value={certNotes} onChange={(e) => setCertNotes(e.target.value)} placeholder="e.g. Engineer name, reference number" style={INPUT} />
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={LABEL}>Upload certificate (PDF)</label>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <label style={{ padding: "8px 16px", background: "white", border: "1px solid #D1D5DB", borderRadius: 8, fontSize: 13, cursor: "pointer", fontWeight: 500, color: "#374151" }}>
                      {certUploading ? "Uploading..." : certFileUrl ? "Replace file" : "Choose file"}
                      <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => handleCertUpload(e.target.files?.[0])} style={{ display: "none" }} />
                    </label>
                    {certFileUrl && (
                      <a href={certFileUrl} target="_blank" rel="noopener" style={{ fontSize: 13, color: "#6366F1", fontWeight: 500 }}>View current file</a>
                    )}
                  </div>
                </div>

                <button onClick={handleSaveCert} disabled={certSaving || !certDateIssued} style={{ padding: "10px 24px", background: certSaving || !certDateIssued ? "#A5B4FC" : "linear-gradient(135deg, #6366F1, #4F46E5)", color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: certSaving || !certDateIssued ? "not-allowed" : "pointer" }}>
                  {certSaving ? "Saving..." : "Save Certificate"}
                </button>
              </div>
            );
          })()}
        </div>

        {/* Rent Increase Tracker */}
        <div style={CARD}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700 }}>Rent Review</h2>
            <button onClick={() => setShowRentIncrease(!showRentIncrease)} style={{ padding: "7px 16px", background: showRentIncrease ? "#F3F4F6" : "linear-gradient(135deg, #6366F1, #4F46E5)", color: showRentIncrease ? "#374151" : "white", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              {showRentIncrease ? "Cancel" : "Record Rent Increase"}
            </button>
          </div>

          {/* Eligibility status */}
          {(() => {
            const lastIncrease = p.last_rent_increase_date ? new Date(p.last_rent_increase_date) : null;
            const monthsSince = lastIncrease ? Math.round((new Date() - lastIncrease) / (1000 * 60 * 60 * 24 * 30.44)) : null;
            const eligible = !lastIncrease || monthsSince >= 12;
            const nextEligible = lastIncrease ? new Date(lastIncrease.getTime() + 365 * 24 * 60 * 60 * 1000) : null;

            return (
              <div style={{ marginBottom: showRentIncrease ? 20 : 0 }}>
                <div style={{ padding: "14px 18px", background: eligible ? "#F0FDF4" : "#F8FAFC", border: `1px solid ${eligible ? "#BBF7D0" : "#E5E7EB"}`, borderRadius: 10 }}>
                  {eligible ? (
                    <div>
                      <p style={{ fontWeight: 600, color: "#065F46", fontSize: 14, marginBottom: 2 }}>Eligible for rent review</p>
                      <p style={{ fontSize: 12, color: "#6B7280" }}>
                        {lastIncrease ? `Last increase: ${lastIncrease.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} (${monthsSince} months ago)` : "No rent increase recorded yet."}
                        {p.previous_rent ? ` Previous rent: ${fmt(p.previous_rent)}.` : ""}
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p style={{ fontWeight: 600, color: "#374151", fontSize: 14, marginBottom: 2 }}>
                        Last rent increase: {lastIncrease.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} ({monthsSince} months ago)
                      </p>
                      <p style={{ fontSize: 12, color: "#6B7280" }}>
                        Next eligible: {nextEligible.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} ({12 - monthsSince} months from now).
                        {p.previous_rent ? ` Previous rent: ${fmt(p.previous_rent)}.` : ""}
                      </p>
                    </div>
                  )}
                </div>
                <p style={{ fontSize: 11, color: "#9CA3AF", marginTop: 8, fontStyle: "italic" }}>
                  Under Section 13 of the Housing Act 1988, landlords may increase rent once every 12 months with proper notice.
                </p>
              </div>
            );
          })()}

          {/* Record rent increase form */}
          {showRentIncrease && (
            <div style={{ padding: "18px 20px", background: "#F8FAFC", borderRadius: 12, border: "1px solid #E5E7EB" }}>
              <div style={{ display: "flex", gap: 14, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 14 }}>
                <div>
                  <label style={LABEL}>New monthly rent (£)</label>
                  <input type="number" value={rentIncreaseAmount} onChange={(e) => setRentIncreaseAmount(e.target.value)} placeholder={String(p.monthly_rent)} style={{ ...INPUT, width: 140 }} />
                </div>
                <div>
                  <label style={LABEL}>Date of increase</label>
                  <input type="date" value={rentIncreaseDate} onChange={(e) => setRentIncreaseDate(e.target.value)} style={{ ...INPUT, width: 160 }} />
                </div>
                <button onClick={handleRecordRentIncrease} disabled={savingRentIncrease || !rentIncreaseAmount} style={{ padding: "10px 22px", background: "#10B981", color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: !rentIncreaseAmount ? 0.5 : 1, height: 42 }}>
                  {savingRentIncrease ? "Saving..." : "Save Increase"}
                </button>
              </div>
              <p style={{ fontSize: 12, color: "#6B7280" }}>
                Current rent: <strong>{fmt(p.monthly_rent)}</strong>.
                {rentIncreaseAmount && parseFloat(rentIncreaseAmount) > p.monthly_rent && ` Increase: ${fmt(parseFloat(rentIncreaseAmount) - p.monthly_rent)}/mo (+${(((parseFloat(rentIncreaseAmount) - p.monthly_rent) / p.monthly_rent) * 100).toFixed(1)}%)`}
              </p>
            </div>
          )}
        </div>

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
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
                {[
                  { key: "buildings_insurance", label: "Buildings insurance (£/month)" },
                  { key: "landlord_insurance", label: "Landlord insurance (£/month)" },
                  { key: "ground_rent", label: "Ground rent (£/month)" },
                  { key: "service_charge", label: "Service charge (£/month)" },
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

              {/* Maintenance buffer */}
              <div style={{ padding: "16px 18px", background: "#F8FAFC", border: "1px solid #E5E7EB", borderRadius: 12, marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, flexWrap: "wrap", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 14, fontWeight: 600, color: "#374151" }}>
                      <input
                        type="checkbox"
                        checked={parseFloat(extras.maintenance_reserve) > 0}
                        onChange={(e) => setExtras((x) => ({ ...x, maintenance_reserve: e.target.checked ? (x.maintenance_reserve && parseFloat(x.maintenance_reserve) > 0 ? x.maintenance_reserve : "100") : "0" }))}
                        style={{ width: 16, height: 16 }}
                      />
                      Include maintenance buffer
                    </label>
                  </div>
                  {parseFloat(extras.maintenance_reserve) > 0 && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 13, color: "#6B7280" }}>£</span>
                      <input
                        style={{ width: 80, padding: "6px 10px", border: "1px solid #D1D5DB", borderRadius: 8, fontSize: 14, textAlign: "right", outline: "none" }}
                        type="number"
                        step="10"
                        value={extras.maintenance_reserve}
                        onChange={(e) => setExtras((x) => ({ ...x, maintenance_reserve: e.target.value }))}
                      />
                      <span style={{ fontSize: 13, color: "#6B7280" }}>/month</span>
                    </div>
                  )}
                </div>
                <p style={{ fontSize: 12, color: "#9CA3AF", margin: 0, lineHeight: 1.5 }}>
                  Recommended monthly buffer to cover ongoing maintenance, repairs, and compliance costs (gas safety certificate, EPC, EICR, landlord insurance, etc.)
                </p>
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

        {/* ── Expenses & Invoices ── */}
        {(() => {
          const CATEGORY_LABELS = {
            repairs_maintenance: "Repairs & Maintenance",
            gas_safety: "Gas Safety Cert",
            eicr: "EICR",
            epc: "EPC",
            insurance: "Insurance",
            ground_rent: "Ground Rent",
            service_charge: "Service Charge",
            professional_fees: "Professional Fees",
            letting_agent: "Letting Agent",
            cleaning: "Cleaning / Inventory",
            furniture_appliances: "Furniture & Appliances",
            other: "Other",
          };

          const currentYear = new Date().getFullYear();
          const taxYearStart = new Date().getMonth() >= 3 ? new Date(currentYear, 3, 6) : new Date(currentYear - 1, 3, 6);
          const calendarYearTotal = expenses.filter((e) => e.expense_date && new Date(e.expense_date).getFullYear() === currentYear).reduce((s, e) => s + (e.amount || 0), 0);
          const taxYearTotal = expenses.filter((e) => e.expense_date && new Date(e.expense_date) >= taxYearStart).reduce((s, e) => s + (e.amount || 0), 0);

          const fileInputRef = { current: null };

          return (
            <div style={{ ...CARD, padding: 0, overflow: "hidden" }}>
              <button
                onClick={() => { setExpensesOpen((o) => !o); if (!expensesOpen) fetchExpenses(); }}
                style={{ width: "100%", padding: "20px 28px", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 15, fontWeight: 600, color: "#374151" }}
              >
                <span>Maintenance & Expenses</span>
                <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#6B7280" }}>
                  {expenses.length > 0 && <span style={{ fontSize: 13, fontWeight: 400 }}>{expenses.length} record{expenses.length !== 1 ? "s" : ""} · {fmt(expenses.reduce((s, e) => s + (e.amount || 0), 0))} total</span>}
                  {expensesOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </div>
              </button>

              {expensesOpen && (
                <div style={{ borderTop: "1px solid #F3F4F6", padding: 28 }}>

                  {/* Summary row */}
                  {expenses.length > 0 && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 24 }}>
                      {[
                        { label: "Calendar year total", value: fmt(Math.round(calendarYearTotal)) },
                        { label: "Tax year total (from Apr)", value: fmt(Math.round(taxYearTotal)) },
                        { label: "Monthly average", value: fmt(Math.round(expenses.reduce((s, e) => s + (e.amount || 0), 0) / Math.max(1, expenses.length))) },
                      ].map((s, i) => (
                        <div key={i} style={{ background: "#F9FAFB", borderRadius: 12, padding: "14px 16px" }}>
                          <p style={{ fontSize: 11, color: "#6B7280", marginBottom: 4 }}>{s.label}</p>
                          <p style={{ fontSize: 20, fontWeight: 700 }}>{s.value}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Upload invoice */}
                  <div style={{ marginBottom: 20 }}>
                    <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>Add Expense</p>
                    {!expensePreview && !expensesParsing && (
                      <label style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", background: "#F5F3FF", border: "2px dashed #C7D2FE", borderRadius: 12, cursor: "pointer", fontSize: 14, color: "#6366F1", fontWeight: 500 }}>
                        <Upload size={18} />
                        Upload invoice / receipt (PDF or image) — Claude will extract the details
                        <input type="file" accept=".pdf,image/*" style={{ display: "none" }} onChange={(e) => { if (e.target.files[0]) handleInvoiceUpload(e.target.files[0]); e.target.value = ""; }} />
                      </label>
                    )}

                    {expensesParsing && (
                      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", background: "#F5F3FF", borderRadius: 12, fontSize: 14, color: "#6366F1" }}>
                        <Loader size={18} style={{ animation: "spin 1s linear infinite" }} /> Extracting invoice details...
                      </div>
                    )}

                    {expensePreview && (
                      <div style={{ background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 12, padding: 20 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                          <p style={{ fontWeight: 600, fontSize: 14 }}>Extracted — confirm details</p>
                          <button onClick={() => setExpensePreview(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#6B7280" }}><X size={16} /></button>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                          {[
                            { label: "Supplier", key: "supplier", type: "text" },
                            { label: "Date", key: "invoice_date", type: "date" },
                            { label: "Amount (£)", key: "amount", type: "number" },
                            { label: "Invoice No.", key: "invoice_number", type: "text" },
                          ].map(({ label, key, type }) => (
                            <div key={key}>
                              <label style={{ fontSize: 11, color: "#6B7280", display: "block", marginBottom: 4 }}>{label}</label>
                              <input
                                type={type}
                                value={expensePreview[key] ?? ""}
                                onChange={(e) => setExpensePreview((p) => ({ ...p, [key]: type === "number" ? parseFloat(e.target.value) || "" : e.target.value }))}
                                style={{ width: "100%", padding: "8px 12px", border: "1px solid #D1D5DB", borderRadius: 8, fontSize: 14, boxSizing: "border-box" }}
                              />
                            </div>
                          ))}
                        </div>
                        <div style={{ marginBottom: 16 }}>
                          <label style={{ fontSize: 11, color: "#6B7280", display: "block", marginBottom: 4 }}>Description</label>
                          <input
                            type="text"
                            value={expensePreview.description ?? ""}
                            onChange={(e) => setExpensePreview((p) => ({ ...p, description: e.target.value }))}
                            style={{ width: "100%", padding: "8px 12px", border: "1px solid #D1D5DB", borderRadius: 8, fontSize: 14, boxSizing: "border-box" }}
                          />
                        </div>
                        <div style={{ marginBottom: 16 }}>
                          <label style={{ fontSize: 11, color: "#6B7280", display: "block", marginBottom: 4 }}>Category</label>
                          <select
                            value={expensePreview.category || "other"}
                            onChange={(e) => setExpensePreview((p) => ({ ...p, category: e.target.value }))}
                            style={{ width: "100%", padding: "8px 12px", border: "1px solid #D1D5DB", borderRadius: 8, fontSize: 14, background: "white" }}
                          >
                            {Object.entries(CATEGORY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                          </select>
                        </div>
                        {expenseError && <p style={{ color: "#EF4444", fontSize: 13, marginBottom: 10 }}>{expenseError}</p>}
                        <button
                          onClick={handleSaveExpense}
                          disabled={savingExpense}
                          style={{ padding: "10px 24px", background: "linear-gradient(135deg, #6366F1, #4F46E5)", color: "white", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer" }}
                        >
                          {savingExpense ? "Saving..." : "Add Expense"}
                        </button>
                      </div>
                    )}
                    {expenseError && !expensePreview && <p style={{ color: "#EF4444", fontSize: 13, marginTop: 8 }}>{expenseError}</p>}
                  </div>

                  {/* Expense list */}
                  {expenses.length > 0 && (
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                      <thead>
                        <tr style={{ background: "#F9FAFB" }}>
                          <th style={{ padding: "9px 12px", textAlign: "left", fontWeight: 600, borderBottom: "1px solid #E5E7EB", fontSize: 12, color: "#6B7280" }}>Date</th>
                          <th style={{ padding: "9px 12px", textAlign: "left", fontWeight: 600, borderBottom: "1px solid #E5E7EB", fontSize: 12, color: "#6B7280" }}>Supplier</th>
                          <th style={{ padding: "9px 12px", textAlign: "left", fontWeight: 600, borderBottom: "1px solid #E5E7EB", fontSize: 12, color: "#6B7280" }}>Category</th>
                          <th style={{ padding: "9px 12px", textAlign: "right", fontWeight: 600, borderBottom: "1px solid #E5E7EB", fontSize: 12, color: "#6B7280" }}>Amount</th>
                          <th style={{ padding: "9px 12px", borderBottom: "1px solid #E5E7EB" }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {expenses.map((e) => (
                          <tr key={e.id} style={{ borderBottom: "1px solid #F3F4F6" }}>
                            <td style={{ padding: "10px 12px", color: "#6B7280" }}>{e.expense_date ? new Date(e.expense_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—"}</td>
                            <td style={{ padding: "10px 12px" }}>
                              <p style={{ fontWeight: 500 }}>{e.supplier || "—"}</p>
                              {e.description && <p style={{ fontSize: 12, color: "#9CA3AF", marginTop: 2 }}>{e.description}</p>}
                            </td>
                            <td style={{ padding: "10px 12px" }}>
                              <span style={{ padding: "2px 8px", background: "#EEF2FF", color: "#6366F1", borderRadius: 20, fontSize: 12 }}>
                                {CATEGORY_LABELS[e.category] || e.category}
                              </span>
                            </td>
                            <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 600 }}>{fmt(e.amount)}</td>
                            <td style={{ padding: "10px 12px", textAlign: "right" }}>
                              <button onClick={() => handleDeleteExpense(e.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#EF4444", padding: 4 }}><Trash2 size={13} /></button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {expenses.length === 0 && !expensePreview && !expensesParsing && (
                    <p style={{ fontSize: 13, color: "#9CA3AF", textAlign: "center", padding: "20px 0" }}>No expenses recorded yet. Upload an invoice above to get started.</p>
                  )}
                </div>
              )}
            </div>
          );
        })()}

      </div>
    </div>
  );
}
