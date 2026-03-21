"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from "recharts";
import {
  Banknote, ArrowLeft, Plus, Trash2, GitCompareArrows,
  TrendingDown, Trophy, Info, CheckCircle,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════════════════════ */

function calcMonthly(principal, annualRate, years) {
  const r = annualRate / 100 / 12;
  const n = years * 12;
  if (r === 0) return principal / n;
  return (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

const fmt = (n) => "£" + Math.round(n).toLocaleString("en-GB");
const fmtFull = (n) => "£" + Math.round(n).toLocaleString("en-GB");

/* ═══════════════════════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════════════════════ */

const DEAL_COLORS = ["#6366F1", "#10B981", "#F59E0B"];
const DEAL_LIGHT = ["#EEF2FF", "#ECFDF5", "#FEF3C7"];
const DEAL_BORDER = ["#C7D2FE", "#A7F3D0", "#FDE68A"];
const DEAL_DARK = ["#4F46E5", "#059669", "#D97706"];

const RATE_TYPES = ["Fixed", "Variable / Tracker", "SVR", "Discounted Variable"];

const mkDeal = (n) => ({
  label: `Deal ${n}`,
  lender: "",
  loanAmount: "",
  interestRate: "",
  termYears: "",
  upfrontFees: "0",
  rateType: "Fixed",
});

/* ═══════════════════════════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════════════════════════ */

export default function MortgageComparison() {
  const router = useRouter();

  const [deals, setDeals] = useState([mkDeal(1), mkDeal(2)]);
  const [showResults, setShowResults] = useState(false);

  const updateDeal = (idx, key, value) =>
    setDeals((prev) => prev.map((d, i) => (i === idx ? { ...d, [key]: value } : d)));

  const addDeal = () => {
    if (deals.length < 3) setDeals((prev) => [...prev, mkDeal(prev.length + 1)]);
  };

  const removeDeal = (idx) => {
    setDeals((prev) => prev.filter((_, i) => i !== idx));
    setShowResults(false);
  };

  const isValid = deals.every(
    (d) =>
      d.loanAmount && !isNaN(parseFloat(d.loanAmount)) &&
      d.interestRate && !isNaN(parseFloat(d.interestRate)) &&
      d.termYears && !isNaN(parseFloat(d.termYears))
  );

  /* ─── Computed results ────────────────────────────────────────────────────── */

  const results = useMemo(() => {
    if (!showResults) return null;
    return deals.map((d, i) => {
      const principal = parseFloat(d.loanAmount);
      const rate = parseFloat(d.interestRate);
      const years = parseFloat(d.termYears);
      const fees = parseFloat(d.upfrontFees) || 0;
      if (!principal || !rate || !years) return null;

      const monthly = calcMonthly(principal, rate, years);
      const totalPaid = monthly * years * 12;
      const totalInterest = totalPaid - principal;
      const totalCost = totalPaid + fees;

      return {
        idx: i,
        name: d.lender.trim() || d.label,
        lender: d.lender.trim() || d.label,
        rateType: d.rateType,
        principal,
        rate,
        years,
        fees,
        monthly,
        totalPaid,
        totalInterest,
        totalCost,
      };
    });
  }, [showResults, deals]);

  /* ─── Best-in-category ────────────────────────────────────────────────────── */

  const valid = results?.filter(Boolean) ?? [];
  const bestMonthly = valid.length ? Math.min(...valid.map((r) => r.monthly)) : null;
  const bestInterest = valid.length ? Math.min(...valid.map((r) => r.totalInterest)) : null;
  const bestTotal = valid.length ? Math.min(...valid.map((r) => r.totalCost)) : null;

  /* ─── Chart data ──────────────────────────────────────────────────────────── */

  const monthlyChart = valid.map((r) => ({
    name: r.name,
    value: Math.round(r.monthly),
    fill: DEAL_COLORS[r.idx],
  }));

  const interestChart = valid.map((r) => ({
    name: r.name,
    value: Math.round(r.totalInterest),
    fill: DEAL_COLORS[r.idx],
  }));

  const totalChart = valid.map((r) => ({
    name: r.name,
    value: Math.round(r.totalCost),
    fill: DEAL_COLORS[r.idx],
  }));

  /* ─── Grouped bar chart ───────────────────────────────────────────────────── */

  const groupedData = [
    {
      metric: "Monthly Payment",
      ...valid.reduce((a, r) => { a[r.name] = Math.round(r.monthly); return a; }, {}),
    },
    {
      metric: "Total Interest",
      ...valid.reduce((a, r) => { a[r.name] = Math.round(r.totalInterest); return a; }, {}),
    },
    {
      metric: "Total Cost",
      ...valid.reduce((a, r) => { a[r.name] = Math.round(r.totalCost); return a; }, {}),
    },
  ];

  return (
    <div style={S.page}>
      {/* ── Header ── */}
      <div style={S.header}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => router.push("/")}>
          <div style={S.logo}>
            <Banknote size={18} color="white" />
          </div>
          <span style={{ fontWeight: 700, fontSize: 18 }}>Mortgage AI Calc</span>
        </div>
        <button onClick={() => router.push("/")} style={S.backBtn}>
          <ArrowLeft size={16} /> Back to analyser
        </button>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 20px" }}>

        {/* ── Page title ── */}
        <div style={{ marginBottom: 36 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: "linear-gradient(135deg, #6366F1, #4F46E5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <GitCompareArrows size={22} color="white" />
            </div>
            <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>Mortgage Comparison</h1>
          </div>
          <p style={{ fontSize: 15, color: "#666", margin: 0, paddingLeft: 56 }}>
            Compare 2–3 mortgage deals side by side — see real total cost, monthly payments, and interest.
          </p>
        </div>

        {/* ── Deal input cards ── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${deals.length}, 1fr)`,
            gap: 20,
            marginBottom: 24,
          }}
        >
          {deals.map((deal, idx) => (
            <DealInputCard
              key={idx}
              deal={deal}
              idx={idx}
              color={DEAL_COLORS[idx]}
              lightBg={DEAL_LIGHT[idx]}
              borderColor={DEAL_BORDER[idx]}
              darkColor={DEAL_DARK[idx]}
              canRemove={deals.length > 2}
              onUpdate={(key, val) => {
                updateDeal(idx, key, val);
                setShowResults(false);
              }}
              onRemove={() => removeDeal(idx)}
            />
          ))}
        </div>

        {/* ── Action bar ── */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 44 }}>
          {deals.length < 3 && (
            <button onClick={addDeal} style={S.secondaryBtn}>
              <Plus size={16} /> Add 3rd deal
            </button>
          )}
          <button
            onClick={() => setShowResults(true)}
            disabled={!isValid}
            style={{
              ...S.compareBtn,
              background: isValid ? "linear-gradient(135deg, #6366F1, #4F46E5)" : "#D1D5DB",
              cursor: isValid ? "pointer" : "not-allowed",
            }}
          >
            <GitCompareArrows size={18} /> Compare Deals
          </button>
          {showResults && (
            <button
              onClick={() => setShowResults(false)}
              style={{ ...S.secondaryBtn, color: "#6B7280" }}
            >
              Reset
            </button>
          )}
        </div>

        {/* ── Results ── */}
        {showResults && results && valid.length >= 2 && (
          <div style={{ display: "grid", gap: 28 }}>

            {/* Summary cards */}
            <div>
              <h2 style={S.sectionTitle}>Summary</h2>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: `repeat(${valid.length}, 1fr)`,
                  gap: 16,
                }}
              >
                {valid.map((r) => (
                  <SummaryCard
                    key={r.idx}
                    result={r}
                    color={DEAL_COLORS[r.idx]}
                    lightBg={DEAL_LIGHT[r.idx]}
                    borderColor={DEAL_BORDER[r.idx]}
                    darkColor={DEAL_DARK[r.idx]}
                    bestMonthly={bestMonthly}
                    bestInterest={bestInterest}
                    bestTotal={bestTotal}
                  />
                ))}
              </div>
            </div>

            {/* Comparison table */}
            <div>
              <h2 style={S.sectionTitle}>Side-by-Side Breakdown</h2>
              <ComparisonTable
                results={valid}
                colors={DEAL_COLORS}
                lightBgs={DEAL_LIGHT}
                darkColors={DEAL_DARK}
                bestMonthly={bestMonthly}
                bestInterest={bestInterest}
                bestTotal={bestTotal}
              />
            </div>

            {/* Charts */}
            <div>
              <h2 style={S.sectionTitle}>Visual Comparison</h2>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                <MiniBarChart
                  title="Monthly Payment"
                  data={monthlyChart}
                  prefix="£"
                />
                <MiniBarChart
                  title="Total Interest Paid"
                  data={interestChart}
                  prefix="£"
                />
              </div>
              <div style={{ marginTop: 20 }}>
                <GroupedBarChart data={groupedData} names={valid.map((r) => r.name)} colors={DEAL_COLORS} />
              </div>
            </div>

            {/* Savings insight */}
            {valid.length >= 2 && (
              <SavingsInsight results={valid} bestTotal={bestTotal} bestInterest={bestInterest} />
            )}
          </div>
        )}

        {/* Empty state hint */}
        {!showResults && (
          <div style={S.hint}>
            <Info size={16} color="#6366F1" style={{ flexShrink: 0 }} />
            <span>Fill in all required fields (loan amount, rate, term) for each deal, then click <strong>Compare Deals</strong>.</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   DEAL INPUT CARD
   ═══════════════════════════════════════════════════════════════════════════════ */

function DealInputCard({ deal, idx, color, lightBg, borderColor, darkColor, canRemove, onUpdate, onRemove }) {
  return (
    <div
      style={{
        background: "white",
        borderRadius: 16,
        border: `2px solid ${borderColor}`,
        overflow: "hidden",
      }}
    >
      {/* Card header */}
      <div
        style={{
          background: lightBg,
          padding: "14px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: `1px solid ${borderColor}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background: color,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              fontWeight: 700,
              fontSize: 13,
            }}
          >
            {idx + 1}
          </div>
          <span style={{ fontWeight: 600, fontSize: 15, color: darkColor }}>Deal {idx + 1}</span>
        </div>
        {canRemove && (
          <button
            onClick={onRemove}
            title="Remove this deal"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#9CA3AF",
              padding: 4,
              display: "flex",
              alignItems: "center",
            }}
          >
            <Trash2 size={15} />
          </button>
        )}
      </div>

      {/* Fields */}
      <div style={{ padding: 20, display: "grid", gap: 14 }}>
        <Field
          label="Lender Name"
          placeholder="e.g. Nationwide"
          value={deal.lender}
          onChange={(v) => onUpdate("lender", v)}
        />

        <Field
          label="Loan Amount *"
          placeholder="e.g. 250000"
          prefix="£"
          value={deal.loanAmount}
          onChange={(v) => onUpdate("loanAmount", v)}
          type="number"
        />

        <Field
          label="Interest Rate *"
          placeholder="e.g. 4.75"
          suffix="%"
          value={deal.interestRate}
          onChange={(v) => onUpdate("interestRate", v)}
          type="number"
        />

        <Field
          label="Term *"
          placeholder="e.g. 25"
          suffix="years"
          value={deal.termYears}
          onChange={(v) => onUpdate("termYears", v)}
          type="number"
        />

        <Field
          label="Upfront Fees"
          placeholder="e.g. 999"
          prefix="£"
          value={deal.upfrontFees}
          onChange={(v) => onUpdate("upfrontFees", v)}
          type="number"
        />

        <div>
          <label style={S.label}>Rate Type</label>
          <select
            value={deal.rateType}
            onChange={(e) => onUpdate("rateType", e.target.value)}
            style={S.select}
          >
            {RATE_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   FIELD
   ═══════════════════════════════════════════════════════════════════════════════ */

function Field({ label, placeholder, value, onChange, prefix, suffix, type = "text" }) {
  return (
    <div>
      <label style={S.label}>{label}</label>
      <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
        {prefix && (
          <span
            style={{
              position: "absolute",
              left: 12,
              fontSize: 14,
              color: "#6B7280",
              pointerEvents: "none",
            }}
          >
            {prefix}
          </span>
        )}
        <input
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{
            ...S.input,
            paddingLeft: prefix ? 28 : 14,
            paddingRight: suffix ? 52 : 14,
          }}
        />
        {suffix && (
          <span
            style={{
              position: "absolute",
              right: 12,
              fontSize: 13,
              color: "#9CA3AF",
              pointerEvents: "none",
            }}
          >
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   SUMMARY CARD
   ═══════════════════════════════════════════════════════════════════════════════ */

function SummaryCard({ result, color, lightBg, borderColor, darkColor, bestMonthly, bestInterest, bestTotal }) {
  const isBestTotal = Math.abs(result.totalCost - bestTotal) < 1;
  const isBestMonthly = Math.abs(result.monthly - bestMonthly) < 0.01;
  const isBestInterest = Math.abs(result.totalInterest - bestInterest) < 1;

  return (
    <div
      style={{
        background: "white",
        borderRadius: 16,
        border: `2px solid ${isBestTotal ? color : "#E5E7EB"}`,
        overflow: "hidden",
        position: "relative",
      }}
    >
      {isBestTotal && (
        <div
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            background: color,
            color: "white",
            fontSize: 11,
            fontWeight: 600,
            padding: "3px 10px",
            borderRadius: 20,
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <Trophy size={11} /> Best Value
        </div>
      )}

      <div
        style={{
          background: lightBg,
          padding: "16px 20px",
          borderBottom: `1px solid ${borderColor}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: color,
            }}
          />
          <span style={{ fontWeight: 700, fontSize: 16, color: darkColor }}>
            {result.name}
          </span>
        </div>
        <p style={{ fontSize: 12, color: "#666", margin: "4px 0 0 18px" }}>
          {result.rate}% · {result.years}yr · {result.rateType}
        </p>
      </div>

      <div style={{ padding: "20px" }}>
        <StatRow
          label="Monthly Payment"
          value={fmt(result.monthly)}
          highlight={isBestMonthly}
          color={color}
        />
        <StatRow
          label="Total Interest"
          value={fmt(result.totalInterest)}
          highlight={isBestInterest}
          color={color}
        />
        <StatRow
          label="Upfront Fees"
          value={fmt(result.fees)}
        />
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #F3F4F6" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>Total Cost</span>
            <span
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: isBestTotal ? color : "#111",
              }}
            >
              {fmt(result.totalCost)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatRow({ label, value, highlight, color }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "8px 0",
        borderBottom: "1px solid #F9FAFB",
      }}
    >
      <span style={{ fontSize: 13, color: "#6B7280" }}>{label}</span>
      <span
        style={{
          fontSize: 14,
          fontWeight: highlight ? 700 : 500,
          color: highlight ? color : "#111",
          display: "flex",
          alignItems: "center",
          gap: 4,
        }}
      >
        {highlight && <CheckCircle size={13} color={color} />}
        {value}
      </span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   COMPARISON TABLE
   ═══════════════════════════════════════════════════════════════════════════════ */

function ComparisonTable({ results, colors, lightBgs, darkColors, bestMonthly, bestInterest, bestTotal }) {
  const rows = [
    { label: "Loan Amount", key: "principal", format: fmt, bestFn: null },
    { label: "Interest Rate", key: "rate", format: (v) => `${v.toFixed(2)}%`, bestFn: null },
    { label: "Term", key: "years", format: (v) => `${v} years`, bestFn: null },
    { label: "Rate Type", key: "rateType", format: (v) => v, bestFn: null },
    { label: "Monthly Payment", key: "monthly", format: fmtFull, bestVal: bestMonthly },
    { label: "Total Repaid", key: "totalPaid", format: fmtFull, bestVal: null },
    { label: "Total Interest", key: "totalInterest", format: fmtFull, bestVal: bestInterest },
    { label: "Upfront Fees", key: "fees", format: fmt, bestVal: null },
    { label: "Total Cost", key: "totalCost", format: fmtFull, bestVal: bestTotal },
  ];

  return (
    <div
      style={{
        background: "white",
        borderRadius: 16,
        border: "1px solid #E5E7EB",
        overflow: "hidden",
      }}
    >
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "#F9FAFB" }}>
            <th
              style={{
                textAlign: "left",
                padding: "14px 20px",
                fontSize: 13,
                fontWeight: 600,
                color: "#6B7280",
                borderBottom: "1px solid #E5E7EB",
                width: "28%",
              }}
            >
              Metric
            </th>
            {results.map((r, i) => (
              <th
                key={i}
                style={{
                  textAlign: "right",
                  padding: "14px 20px",
                  fontSize: 13,
                  fontWeight: 600,
                  color: darkColors[r.idx],
                  borderBottom: "1px solid #E5E7EB",
                  background: lightBgs[r.idx],
                }}
              >
                {r.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => {
            const isTotalCostRow = row.key === "totalCost";
            return (
              <tr
                key={ri}
                style={{
                  background: isTotalCostRow ? "#F9FAFB" : ri % 2 === 0 ? "white" : "#FAFAFA",
                }}
              >
                <td
                  style={{
                    padding: "13px 20px",
                    fontSize: 13,
                    fontWeight: isTotalCostRow ? 600 : 400,
                    color: "#374151",
                    borderBottom: "1px solid #F3F4F6",
                  }}
                >
                  {row.label}
                </td>
                {results.map((r, i) => {
                  const val = r[row.key];
                  const isBest = row.bestVal != null && typeof val === "number" && Math.abs(val - row.bestVal) < 1;
                  return (
                    <td
                      key={i}
                      style={{
                        textAlign: "right",
                        padding: "13px 20px",
                        fontSize: isTotalCostRow ? 15 : 13,
                        fontWeight: isBest || isTotalCostRow ? 700 : 400,
                        color: isBest ? colors[r.idx] : "#111",
                        borderBottom: "1px solid #F3F4F6",
                      }}
                    >
                      <span style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4 }}>
                        {isBest && <CheckCircle size={13} color={colors[r.idx]} />}
                        {row.format(val)}
                      </span>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   MINI BAR CHART
   ═══════════════════════════════════════════════════════════════════════════════ */

function MiniBarChart({ title, data, prefix }) {
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload?.length) {
      return (
        <div style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: 8, padding: "8px 12px", fontSize: 13 }}>
          <p style={{ margin: 0, fontWeight: 600 }}>{payload[0].payload.name}</p>
          <p style={{ margin: 0, color: payload[0].payload.fill }}>
            {prefix}{payload[0].value.toLocaleString("en-GB")}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{ background: "white", borderRadius: 16, border: "1px solid #E5E7EB", padding: 24 }}>
      <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 20, color: "#111" }}>{title}</h3>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} barSize={40}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#6B7280" }} axisLine={false} tickLine={false} />
          <YAxis
            tick={{ fontSize: 11, fill: "#9CA3AF" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${prefix}${(v / 1000).toFixed(0)}k`}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "#F9FAFB" }} />
          <Bar dataKey="value" radius={[6, 6, 0, 0]}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   GROUPED BAR CHART
   ═══════════════════════════════════════════════════════════════════════════════ */

function GroupedBarChart({ data, names, colors }) {
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload?.length) {
      return (
        <div style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: 8, padding: "10px 14px", fontSize: 13 }}>
          <p style={{ margin: "0 0 6px", fontWeight: 600, color: "#111" }}>{label}</p>
          {payload.map((p, i) => (
            <p key={i} style={{ margin: "2px 0", color: p.fill }}>
              {p.name}: £{p.value.toLocaleString("en-GB")}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{ background: "white", borderRadius: 16, border: "1px solid #E5E7EB", padding: 24 }}>
      <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 20, color: "#111" }}>
        Full Comparison — Monthly Payment · Total Interest · Total Cost
      </h3>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} barGap={6} barCategoryGap="30%">
          <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
          <XAxis dataKey="metric" tick={{ fontSize: 12, fill: "#6B7280" }} axisLine={false} tickLine={false} />
          <YAxis
            tick={{ fontSize: 11, fill: "#9CA3AF" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `£${(v / 1000).toFixed(0)}k`}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "#F9FAFB" }} />
          <Legend
            wrapperStyle={{ fontSize: 13, paddingTop: 12 }}
            iconType="circle"
            iconSize={8}
          />
          {names.map((name, i) => (
            <Bar key={name} dataKey={name} fill={colors[i]} radius={[4, 4, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   SAVINGS INSIGHT PANEL
   ═══════════════════════════════════════════════════════════════════════════════ */

function SavingsInsight({ results, bestTotal, bestInterest }) {
  const best = results.find((r) => Math.abs(r.totalCost - bestTotal) < 1);
  const worst = results.reduce((a, b) => (a.totalCost > b.totalCost ? a : b));

  if (!best || best === worst) return null;

  const costSaving = Math.round(worst.totalCost - best.totalCost);
  const interestSaving = Math.round(worst.totalInterest - best.totalInterest);
  const monthlyDiff = Math.round(worst.monthly - best.monthly);

  return (
    <div
      style={{
        background: "linear-gradient(135deg, #EEF2FF, #E0E7FF)",
        borderRadius: 16,
        border: "1px solid #C7D2FE",
        padding: 24,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <TrendingDown size={20} color="#6366F1" />
        <h3 style={{ fontSize: 16, fontWeight: 700, color: "#312E81", margin: 0 }}>
          Key Savings Insight
        </h3>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
        <InsightStat
          label="Total cost saving"
          value={`£${costSaving.toLocaleString("en-GB")}`}
          sub={`${best.name} vs ${worst.name}`}
        />
        <InsightStat
          label="Interest saving"
          value={`£${interestSaving.toLocaleString("en-GB")}`}
          sub="over full term"
        />
        <InsightStat
          label="Monthly saving"
          value={`£${Math.abs(monthlyDiff).toLocaleString("en-GB")}`}
          sub="per month"
        />
      </div>
      <p style={{ fontSize: 13, color: "#4338CA", margin: "16px 0 0", lineHeight: 1.6 }}>
        <strong>{best.name}</strong> offers the best overall value — choosing it over{" "}
        <strong>{worst.name}</strong> would save you{" "}
        <strong>£{costSaving.toLocaleString("en-GB")}</strong> over the full term
        {monthlyDiff > 0 && ` while also saving £${monthlyDiff}/month`}.
      </p>
    </div>
  );
}

function InsightStat({ label, value, sub }) {
  return (
    <div>
      <p style={{ fontSize: 12, color: "#6366F1", marginBottom: 4, fontWeight: 500 }}>{label}</p>
      <p style={{ fontSize: 22, fontWeight: 700, color: "#312E81", marginBottom: 2 }}>{value}</p>
      <p style={{ fontSize: 12, color: "#6366F1" }}>{sub}</p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   SHARED STYLES
   ═══════════════════════════════════════════════════════════════════════════════ */

const S = {
  page: {
    minHeight: "100vh",
    background: "#FAFBFC",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
  header: {
    borderBottom: "1px solid #E5E7EB",
    background: "white",
    padding: "14px 24px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  logo: {
    width: 34,
    height: 34,
    borderRadius: 10,
    background: "linear-gradient(135deg, #6366F1, #4F46E5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  backBtn: {
    background: "none",
    border: "none",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 6,
    color: "#6366F1",
    fontSize: 14,
    fontWeight: 500,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: 700,
    marginBottom: 16,
    color: "#111",
  },
  label: {
    display: "block",
    fontSize: 12,
    fontWeight: 500,
    color: "#374151",
    marginBottom: 5,
  },
  input: {
    width: "100%",
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid #D1D5DB",
    fontSize: 14,
    background: "white",
    outline: "none",
    boxSizing: "border-box",
    appearance: "none",
  },
  select: {
    width: "100%",
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid #D1D5DB",
    fontSize: 14,
    background: "white",
    outline: "none",
    boxSizing: "border-box",
    cursor: "pointer",
  },
  secondaryBtn: {
    padding: "10px 20px",
    background: "white",
    border: "1px solid #D1D5DB",
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 500,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 8,
    color: "#374151",
  },
  compareBtn: {
    padding: "12px 28px",
    color: "white",
    border: "none",
    borderRadius: 10,
    fontSize: 15,
    fontWeight: 600,
    display: "flex",
    alignItems: "center",
    gap: 8,
    transition: "all 0.2s",
  },
  hint: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "14px 18px",
    background: "#EEF2FF",
    borderRadius: 12,
    fontSize: 13,
    color: "#4338CA",
    border: "1px solid #C7D2FE",
  },
};
