"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import {
  ArrowLeft, Trash2, RefreshCw, Download, Calendar, PoundSterling,
  TrendingDown, Clock, Building, AlertTriangle,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

/* ── Pure calculation helpers (mirrored from page.jsx) ─────────────────────── */

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

function buildRateScenarios(principal, currentRate, remainingYears, monthlyPayment) {
  return [-1, -0.5, 0, 0.5, 1, 2].map((offset) => {
    const rate = currentRate + offset;
    if (rate < 0.1) return null;
    const newPayment = calcMonthlyPayment(principal, rate, remainingYears);
    const amort = buildAmortization(principal, rate, newPayment);
    return { rate: rate.toFixed(2) + "%", rateNum: rate, monthlyPayment: Math.round(newPayment), totalInterest: amort.totalInterest, difference: Math.round(newPayment - monthlyPayment) };
  }).filter(Boolean);
}

const fmt = (n) => "£" + Number(n || 0).toLocaleString("en-GB");
const PAGE = { minHeight: "100vh", background: "#F3F4F6", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" };
const CARD = { background: "white", border: "1px solid #E5E7EB", borderRadius: 16, padding: 28, marginBottom: 24 };

export default function AnalysisSnapshot() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const [rec, setRec] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/auth/signin");
  }, [status, router]);

  useEffect(() => {
    if (session?.user?.id) fetchAnalysis();
  }, [session, params.id]);

  const fetchAnalysis = async () => {
    try {
      const res = await fetch(`/api/analyses/${params.id}`);
      if (!res.ok) { router.push("/analyses"); return; }
      setRec(await res.json());
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this analysis? This cannot be undone.")) return;
    setDeleting(true);
    await fetch(`/api/analyses/${params.id}`, { method: "DELETE" });
    router.push("/analyses");
  };

  const handleReanalyse = () => {
    if (!rec) return;
    const saved = rec.analysis_data || {};
    localStorage.setItem("mortgageiq_reanalyse", JSON.stringify({
      form: saved.form || {},
      parsedData: saved.parsedData || null,
    }));
    router.push("/");
  };

  const handleDownloadPDF = () => window.print();

  if (status === "loading" || loading) {
    return (
      <div style={{ ...PAGE, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%", border: "3px solid #E5E7EB", borderTopColor: "#6366F1", margin: "0 auto 16px", animation: "spin 0.8s linear infinite" }} />
          <p style={{ color: "#666", fontSize: 14 }}>Loading report...</p>
        </div>
      </div>
    );
  }

  if (!rec) return null;

  // ── Extract stored data ──────────────────────────────────────────────────────
  const saved = rec.analysis_data || {};
  const form = saved.form || {};
  const parsedData = saved.parsedData || {};
  const adjBalance = saved.adjBalance;
  const adjYears = saved.adjYears;
  const adjustment = saved.adjustment;

  const balance = parseFloat(adjBalance) || parseFloat(form.outstandingBalance) || 0;
  const years   = parseFloat(adjYears)   || parseFloat(form.remainingYears) || 0;
  const rate    = parseFloat(form.interestRate) || 0;
  const payment = parseFloat(form.monthlyPayment) || 0;
  const origLoan = parseFloat(form.originalLoanAmount) || null;
  const isIslamicFinance = parsedData?.isIslamicFinance || false;

  const hasData = balance > 0 && rate > 0 && payment > 0 && years > 0;

  // ── Compute from stored inputs ───────────────────────────────────────────────
  const current = hasData ? buildAmortization(balance, rate, payment) : null;
  const currentYears = current ? (current.totalMonths / 12).toFixed(1) : "—";

  const overpaymentScenarios = hasData
    ? [100, 250, 500, 750, 1000].map((extra) => {
        const ov = buildAmortization(balance, rate, payment, extra);
        return { extra, monthsSaved: current.totalMonths - ov.totalMonths, interestSaved: current.totalInterest - ov.totalInterest };
      })
    : [];

  const rateScenarios = hasData ? buildRateScenarios(balance, rate, years, payment) : [];
  const currentScenario = rateScenarios.find((s) => s.rateNum === rate);

  // Quick-win cards for the interest hero (£100/£250/£500)
  const quickWins = hasData
    ? [100, 250, 500].map((extra) => {
        const ov = buildAmortization(balance, rate, payment, extra);
        return { extra, saved: current.totalInterest - ov.totalInterest, months: Math.round((current.totalMonths - ov.totalMonths) / 12 * 10) / 10 };
      })
    : [];

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div style={PAGE}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
          * { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
        }
      `}</style>

      {/* Header */}
      <div className="no-print" style={{ borderBottom: "1px solid #E5E7EB", background: "white", padding: "16px 24px", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <button onClick={() => router.push("/analyses")} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, color: "#6366F1", fontSize: 14, fontWeight: 500 }}>
            <ArrowLeft size={18} /> My Analyses
          </button>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={handleDownloadPDF} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", background: "#EEF2FF", color: "#6366F1", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              <Download size={14} /> Download PDF
            </button>
            <button onClick={handleReanalyse} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", background: "linear-gradient(135deg, #6366F1, #4F46E5)", color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              <RefreshCw size={14} /> Re-analyse with today's figures
            </button>
            <button onClick={handleDelete} disabled={deleting} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", background: "#FEE2E2", color: "#EF4444", border: "none", borderRadius: 8, fontSize: 13, cursor: "pointer" }}>
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 20px" }}>

        {/* Title block */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <h1 style={{ fontSize: 26, fontWeight: 700 }}>{rec.title}</h1>
            <span style={{ padding: "4px 12px", background: "#EEF2FF", color: "#6366F1", borderRadius: 20, fontSize: 12, fontWeight: 600 }}>Snapshot</span>
          </div>
          <div style={{ display: "flex", gap: 16, marginTop: 8, flexWrap: "wrap", fontSize: 13, color: "#6B7280" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <Calendar size={13} /> Analysed {new Date(rec.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
            </span>
            {rec.property_address && (
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <Building size={13} /> {rec.property_address}
              </span>
            )}
            {rec.statement_date && (
              <span>Statement date: {new Date(rec.statement_date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</span>
            )}
          </div>
        </div>

        {!hasData ? (
          <div style={{ ...CARD, textAlign: "center", padding: "40px 20px" }}>
            <AlertTriangle size={32} color="#F59E0B" style={{ margin: "0 auto 12px" }} />
            <p style={{ fontWeight: 600 }}>Insufficient data to render report</p>
            <p style={{ color: "#666", fontSize: 13, marginTop: 6 }}>This analysis was saved before full data capture was enabled.</p>
            <button onClick={handleReanalyse} style={{ marginTop: 20, padding: "10px 24px", background: "linear-gradient(135deg, #6366F1, #4F46E5)", color: "white", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
              Re-analyse from scratch
            </button>
          </div>
        ) : (
          <>
            {/* ── Interest Hero ────────────────────────────────────────────────── */}
            <div style={{ background: "linear-gradient(135deg, #1E1B4B, #312E81)", borderRadius: 20, padding: "36px 32px", marginBottom: 24, color: "white" }}>
              <p style={{ fontSize: 13, color: "#A5B4FC", marginBottom: 8, fontWeight: 500, letterSpacing: "0.05em", textTransform: "uppercase" }}>
                {isIslamicFinance ? "Total rental payments at current rate" : "Total interest at current rate"}
              </p>
              <p style={{ fontSize: 62, fontWeight: 800, letterSpacing: "-2px", color: "#FC8181", margin: "0 0 6px" }}>
                {fmt(current.totalInterest)}
              </p>
              <p style={{ fontSize: 14, color: "#C7D2FE", marginBottom: 28 }}>
                That's on top of your {fmt(balance)} balance — payable over {currentYears} years at {rate}%.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                {quickWins.map((w) => (
                  <div key={w.extra} style={{ background: "rgba(255,255,255,0.1)", borderRadius: 12, padding: "14px 16px" }}>
                    <p style={{ fontSize: 12, color: "#A5B4FC", marginBottom: 4 }}>+{fmt(w.extra)}/month saves</p>
                    <p style={{ fontSize: 20, fontWeight: 700 }}>{fmt(w.saved)}</p>
                    <p style={{ fontSize: 12, color: "#C7D2FE", marginTop: 2 }}>({w.months} yrs faster)</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Roll-forward note */}
            {adjustment && (
              <div style={{ background: "#ECFDF5", border: "1px solid #A7F3D0", borderRadius: 12, padding: "14px 18px", marginBottom: 24, fontSize: 13, color: "#065F46" }}>
                These figures were rolled forward from the statement date ({adjustment.months} months) to account for payments already made.
                Balance at statement: {fmt(adjustment.originalBalance)} → adjusted to {fmt(balance)}.
              </div>
            )}

            {/* ── Summary cards ───────────────────────────────────────────────── */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }} className="grid-cols-4">
              {[
                { label: "Outstanding Balance", value: fmt(balance), icon: <PoundSterling size={18} />, color: "#6366F1" },
                { label: "Monthly Payment", value: fmt(Math.round(payment)), icon: <TrendingDown size={18} />, color: "#10B981" },
                { label: "Interest Rate", value: rate + "%", icon: <TrendingDown size={18} />, color: "#F59E0B" },
                { label: "Remaining Term", value: currentYears + " yrs", icon: <Clock size={18} />, color: "#EF4444" },
              ].map((c, i) => (
                <div key={i} style={{ background: "white", borderRadius: 16, padding: "20px", border: "1px solid #E5E7EB" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: c.color + "14", display: "flex", alignItems: "center", justifyContent: "center", color: c.color }}>{c.icon}</div>
                    <span style={{ fontSize: 12, color: "#666" }}>{c.label}</span>
                  </div>
                  <p style={{ fontSize: 22, fontWeight: 700 }}>{c.value}</p>
                </div>
              ))}
            </div>

            {/* ── Mortgage at a glance ─────────────────────────────────────────── */}
            <div style={CARD}>
              <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 18 }}>Your Mortgage at a Glance</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 18 }} className="grid-cols-4">
                {[
                  { label: "Lender", value: form.bank || "—" },
                  { label: "Mortgage Type", value: form.mortgageType || "—" },
                  { label: "Rate Type", value: form.rateType || "—" },
                  { label: "Fixed Until", value: form.fixedUntil || "—" },
                  { label: "Reverts To", value: form.revertingTo || "—" },
                  { label: "Original Loan", value: origLoan ? fmt(origLoan) : "—" },
                  { label: "Original Term", value: form.originalTerm ? form.originalTerm + " yrs" : "—" },
                  { label: "ERC", value: form.earlyRepaymentCharge ? form.earlyRepaymentCharge + "%" : "None" },
                ].map((f, i) => (
                  <div key={i}>
                    <p style={{ fontSize: 11, color: "#666", marginBottom: 4 }}>{f.label}</p>
                    <p style={{ fontSize: 14, fontWeight: 600 }}>{f.value}</p>
                  </div>
                ))}
              </div>
              {isIslamicFinance && (
                <div style={{ marginTop: 16, padding: "8px 14px", background: "#FEF3C7", borderRadius: 8, display: "inline-block", fontSize: 12, color: "#92400E", fontWeight: 600 }}>
                  Islamic Finance / Home Purchase Plan
                </div>
              )}
            </div>

            {/* ── Overpayment scenarios ────────────────────────────────────────── */}
            <div style={CARD}>
              <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 6 }}>Overpayment Scenarios</h3>
              <p style={{ fontSize: 13, color: "#666", marginBottom: 18 }}>How extra monthly payments would reduce your total interest and term.</p>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                <thead>
                  <tr style={{ background: "#F9FAFB" }}>
                    <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600, borderBottom: "1px solid #E5E7EB" }}>Extra / month</th>
                    <th style={{ padding: "10px 14px", textAlign: "right", fontWeight: 600, borderBottom: "1px solid #E5E7EB" }}>Months saved</th>
                    <th style={{ padding: "10px 14px", textAlign: "right", fontWeight: 600, borderBottom: "1px solid #E5E7EB" }}>Interest saved</th>
                  </tr>
                </thead>
                <tbody>
                  {overpaymentScenarios.map((s) => (
                    <tr key={s.extra} style={{ borderBottom: "1px solid #F3F4F6" }}>
                      <td style={{ padding: "10px 14px", fontWeight: 500 }}>+{fmt(s.extra)}</td>
                      <td style={{ padding: "10px 14px", textAlign: "right", color: "#10B981", fontWeight: 600 }}>{s.monthsSaved > 0 ? s.monthsSaved + " months" : "—"}</td>
                      <td style={{ padding: "10px 14px", textAlign: "right", color: "#10B981", fontWeight: 600 }}>{s.interestSaved > 0 ? fmt(s.interestSaved) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ── Rate scenarios ───────────────────────────────────────────────── */}
            <div style={CARD}>
              <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 18 }}>Rate Scenarios</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }} className="grid-cols-3">
                {rateScenarios.filter((_, i) => i < 6).map((s) => {
                  const isCurrent = Math.abs(s.rateNum - rate) < 0.01;
                  return (
                    <div key={s.rate} style={{ background: isCurrent ? "linear-gradient(135deg, #EEF2FF, #E0E7FF)" : "#F9FAFB", borderRadius: 12, padding: "16px", border: isCurrent ? "2px solid #6366F1" : "1px solid #E5E7EB" }}>
                      <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 6, color: isCurrent ? "#4F46E5" : "#111" }}>{s.rate} {isCurrent && <span style={{ fontSize: 11, background: "#6366F1", color: "white", borderRadius: 4, padding: "1px 6px", marginLeft: 4 }}>current</span>}</p>
                      <p style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>{fmt(s.monthlyPayment)}<span style={{ fontSize: 12, fontWeight: 400, color: "#666" }}>/mo</span></p>
                      <p style={{ fontSize: 12, color: "#666" }}>Total interest: {fmt(s.totalInterest)}</p>
                      {!isCurrent && (
                        <p style={{ fontSize: 12, marginTop: 4, color: s.difference > 0 ? "#EF4444" : "#10B981", fontWeight: 600 }}>
                          {s.difference > 0 ? "+" : ""}{fmt(s.difference)}/mo vs current
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── Balance chart ────────────────────────────────────────────────── */}
            {current.schedule.length > 0 && (
              <div style={CARD}>
                <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 18 }}>Balance Over Time</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={current.schedule}>
                    <defs>
                      <linearGradient id="snapGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366F1" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#6366F1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                    <XAxis dataKey="year" tick={{ fontSize: 12 }} tickFormatter={(v) => `Yr ${v}`} />
                    <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `£${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v) => fmt(v)} labelFormatter={(l) => `Year ${l}`} />
                    <Area type="monotone" dataKey="balance" stroke="#6366F1" strokeWidth={2} fill="url(#snapGrad)" name="Balance" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* ── Re-analyse CTA ───────────────────────────────────────────────── */}
            <div className="no-print" style={{ background: "linear-gradient(135deg, #EEF2FF, #E0E7FF)", borderRadius: 16, padding: "28px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
              <div>
                <p style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Want to see where you stand today?</p>
                <p style={{ fontSize: 13, color: "#6B7280" }}>Re-analyse with your original figures rolled forward to {new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" })}.</p>
              </div>
              <button onClick={handleReanalyse} style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 24px", background: "linear-gradient(135deg, #6366F1, #4F46E5)", color: "white", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                <RefreshCw size={16} /> Re-analyse with today's figures
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
