"use client";

import { useState, useMemo } from "react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";
import {
  Upload, Calculator, TrendingDown, Clock, PoundSterling,
  FileText, AlertTriangle, CheckCircle, Info, ArrowRight,
  Banknote, Target, Zap, Shield, ChevronDown,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════════════════
   MORTGAGE CALCULATION ENGINE
   ═══════════════════════════════════════════════════════════════════════════════ */

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
    if (principalPaid <= 0) break; // payment doesn't cover interest
    balance = Math.max(0, balance - principalPaid);
    totalInterest += interest;

    if (month % 12 === 0 || balance <= 0.01) {
      schedule.push({
        year: Math.ceil(month / 12),
        month,
        balance: Math.round(balance),
        totalInterest: Math.round(totalInterest),
        principalPaid: Math.round(principal - balance),
      });
    }
  }
  return { schedule, totalMonths: month, totalInterest: Math.round(totalInterest) };
}

function buildRateScenarios(principal, currentRate, remainingYears, monthlyPayment) {
  const scenarios = [];
  const offsets = [-2, -1, -0.5, 0, 0.5, 1, 2, 3];

  for (const offset of offsets) {
    const rate = currentRate + offset;
    if (rate < 0.1) continue;
    const newPayment = calcMonthlyPayment(principal, rate, remainingYears);
    const amort = buildAmortization(principal, rate, newPayment);
    scenarios.push({
      rate: rate.toFixed(2) + "%",
      rateNum: rate,
      monthlyPayment: Math.round(newPayment),
      totalInterest: amort.totalInterest,
      difference: Math.round(newPayment - monthlyPayment),
    });
  }
  return scenarios;
}

/* ═══════════════════════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════════════════════ */

const UK_BANKS = [
  "Barclays", "HSBC", "Lloyds Banking Group", "NatWest", "Santander UK",
  "Nationwide Building Society", "Halifax", "TSB", "Virgin Money", "Metro Bank",
  "Skipton Building Society", "Yorkshire Building Society",
  "Coventry Building Society", "First Direct", "Monzo", "Starling Bank", "Other",
];

const MORTGAGE_TYPES = ["Repayment", "Interest Only", "Part & Part"];
const RATE_TYPES = [
  "Fixed",
  "Variable / Tracker",
  "SVR (Standard Variable Rate)",
  "Discounted Variable",
];

const fmt = (n) => "£" + Number(n).toLocaleString("en-GB");

/* ═══════════════════════════════════════════════════════════════════════════════
   MAIN APP
   ═══════════════════════════════════════════════════════════════════════════════ */

export default function MortgageAnalyzer() {
  const [step, setStep] = useState("landing");
  const [inputMethod, setInputMethod] = useState(null);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [form, setForm] = useState({
    outstandingBalance: "",
    originalLoanAmount: "",
    monthlyPayment: "",
    interestRate: "",
    remainingYears: "",
    originalTerm: "",
    bank: "",
    mortgageType: "Repayment",
    rateType: "Fixed",
    fixedUntil: "",
    earlyRepaymentCharge: "",
    overpaymentAllowance: "10",
  });

  const [targetYears, setTargetYears] = useState("");
  const [extraPayment, setExtraPayment] = useState("");

  const updateForm = (key, value) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  /* ─── Analysis ────────────────────────────────────────────────────────────── */

  const analysis = useMemo(() => {
    const balance = parseFloat(form.outstandingBalance);
    const payment = parseFloat(form.monthlyPayment);
    const rate = parseFloat(form.interestRate);
    const years = parseFloat(form.remainingYears);
    const extra = parseFloat(extraPayment) || 0;
    const target = parseFloat(targetYears) || 0;
    const overpaymentPct = parseFloat(form.overpaymentAllowance) || 10;
    const originalAmount = parseFloat(form.originalLoanAmount) || balance * 1.2;

    if (!balance || !payment || !rate || !years) return null;

    const maxAnnualOverpayment = (originalAmount * overpaymentPct) / 100;
    const maxMonthlyOverpayment = Math.round(maxAnnualOverpayment / 12);

    const current = buildAmortization(balance, rate, payment);

    const withExtra =
      extra > 0
        ? buildAmortization(balance, rate, payment, Math.min(extra, maxMonthlyOverpayment))
        : null;

    const targetPayment =
      target > 0 ? calcMonthlyPayment(balance, rate, target) : null;
    const targetAmort =
      target > 0 ? buildAmortization(balance, rate, targetPayment) : null;

    const rateScenarios = buildRateScenarios(balance, rate, years, payment);

    const overpaymentScenarios = [100, 200, 300, 500, 750, 1000]
      .filter((amt) => amt <= maxMonthlyOverpayment + 100)
      .map((amt) => {
        const capped = Math.min(amt, maxMonthlyOverpayment);
        const amort = buildAmortization(balance, rate, payment, capped);
        return {
          extra: `£${capped}`,
          extraNum: capped,
          months: amort.totalMonths,
          years: (amort.totalMonths / 12).toFixed(1),
          totalInterest: amort.totalInterest,
          saved: current.totalInterest - amort.totalInterest,
          yearsSaved: ((current.totalMonths - amort.totalMonths) / 12).toFixed(1),
          withinLimit: amt <= maxMonthlyOverpayment,
        };
      });

    return {
      current, withExtra, targetPayment, targetAmort,
      rateScenarios, overpaymentScenarios,
      maxMonthlyOverpayment, maxAnnualOverpayment,
      currentMonthlyPayment: payment, interestRate: rate, balance,
    };
  }, [form, extraPayment, targetYears]);

  const handleAnalyze = () => {
    setStep("analyzing");
    setTimeout(() => setStep("results"), 2200);
  };

  const isFormValid =
    form.outstandingBalance && form.monthlyPayment &&
    form.interestRate && form.remainingYears;

  /* ─── Render: Landing ─────────────────────────────────────────────────────── */

  if (step === "landing") return <LandingPage onStart={() => setStep("input")} />;
  if (step === "analyzing") return <AnalyzingScreen />;
  if (step === "results" && analysis)
    return (
      <ResultsDashboard
        analysis={analysis}
        form={form}
        extraPayment={extraPayment}
        setExtraPayment={setExtraPayment}
        targetYears={targetYears}
        setTargetYears={setTargetYears}
        onBack={() => setStep("input")}
      />
    );

  /* ─── Render: Input ───────────────────────────────────────────────────────── */

  return (
    <div style={S.page}>
      <Header onBack={() => setStep("landing")} />

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "40px 20px" }}>
        {/* Method selector */}
        {!inputMethod && (
          <div>
            <h2 style={{ fontSize: 24, fontWeight: 600, textAlign: "center", marginBottom: 8 }}>
              How would you like to get started?
            </h2>
            <p style={{ color: "#666", textAlign: "center", marginBottom: 32 }}>
              Choose how you'd like to provide your mortgage details
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
              {[
                { id: "upload", icon: <Upload size={28} />, title: "Upload Statement", desc: "Upload your latest mortgage statement PDF and we'll extract the details" },
                { id: "manual", icon: <Calculator size={28} />, title: "Enter Manually", desc: "Input your mortgage details by hand — quick and straightforward" },
                { id: "both", icon: <FileText size={28} />, title: "Both", desc: "Upload a statement AND fill in any extra details for the most accurate analysis" },
              ].map((opt) => (
                <MethodCard key={opt.id} {...opt} onClick={() => setInputMethod(opt.id)} />
              ))}
            </div>
          </div>
        )}

        {/* Upload */}
        {inputMethod && (inputMethod === "upload" || inputMethod === "both") && (
          <UploadSection
            uploadedFile={uploadedFile}
            setUploadedFile={setUploadedFile}
            dragOver={dragOver}
            setDragOver={setDragOver}
          />
        )}

        {/* Manual form */}
        {inputMethod && (inputMethod === "manual" || inputMethod === "both") && (
          <div>
            <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 20 }}>
              Mortgage Details
            </h3>
            <div style={{ background: "white", borderRadius: 16, border: "1px solid #E5E7EB", padding: 32 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                <FormField label="Outstanding Balance" prefix="£" value={form.outstandingBalance} onChange={(v) => updateForm("outstandingBalance", v)} placeholder="185,000" required />
                <FormField label="Monthly Payment" prefix="£" value={form.monthlyPayment} onChange={(v) => updateForm("monthlyPayment", v)} placeholder="1,200" required />
                <FormField label="Interest Rate" suffix="%" value={form.interestRate} onChange={(v) => updateForm("interestRate", v)} placeholder="4.75" required />
                <FormField label="Remaining Term" suffix="years" value={form.remainingYears} onChange={(v) => updateForm("remainingYears", v)} placeholder="22" required />
              </div>

              {/* Bank */}
              <div style={{ marginTop: 20 }}>
                <label style={S.label}>Lender / Bank</label>
                <select value={form.bank} onChange={(e) => updateForm("bank", e.target.value)} style={{ ...S.input, color: form.bank ? "#111" : "#9CA3AF" }}>
                  <option value="">Select your lender...</option>
                  {UK_BANKS.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>

              {/* Type selectors */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginTop: 20 }}>
                <div>
                  <label style={S.label}>Mortgage Type</label>
                  <select value={form.mortgageType} onChange={(e) => updateForm("mortgageType", e.target.value)} style={S.input}>
                    {MORTGAGE_TYPES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label style={S.label}>Rate Type</label>
                  <select value={form.rateType} onChange={(e) => updateForm("rateType", e.target.value)} style={S.input}>
                    {RATE_TYPES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              {/* Advanced */}
              <button onClick={() => setShowAdvanced(!showAdvanced)} style={{ marginTop: 24, background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, color: "#6366F1", fontSize: 14, fontWeight: 500, padding: 0 }}>
                <ChevronDown size={16} style={{ transform: showAdvanced ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
                {showAdvanced ? "Hide" : "Show"} advanced options
              </button>

              {showAdvanced && (
                <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #F3F4F6" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                    <FormField label="Original Loan Amount" prefix="£" value={form.originalLoanAmount} onChange={(v) => updateForm("originalLoanAmount", v)} placeholder="250,000" />
                    <FormField label="Original Term" suffix="years" value={form.originalTerm} onChange={(v) => updateForm("originalTerm", v)} placeholder="25" />
                    <FormField label="Fixed Rate Ends" value={form.fixedUntil} onChange={(v) => updateForm("fixedUntil", v)} placeholder="e.g. March 2027" />
                    <FormField label="Early Repayment Charge" suffix="%" value={form.earlyRepaymentCharge} onChange={(v) => updateForm("earlyRepaymentCharge", v)} placeholder="3" />
                    <FormField label="Annual Overpayment Allowance" suffix="%" value={form.overpaymentAllowance} onChange={(v) => updateForm("overpaymentAllowance", v)} placeholder="10" />
                  </div>
                  <div style={{ marginTop: 12, padding: "12px 16px", background: "#EEF2FF", borderRadius: 10, display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <Info size={16} color="#6366F1" style={{ flexShrink: 0, marginTop: 2 }} />
                    <p style={{ fontSize: 12, color: "#4338CA", lineHeight: 1.5, margin: 0 }}>Most UK lenders allow you to overpay up to 10% of your outstanding balance per year without penalty. Check your mortgage terms or ask your lender.</p>
                  </div>
                </div>
              )}
            </div>

            {/* Analyse button */}
            <button onClick={handleAnalyze} disabled={!isFormValid} style={{ ...S.primaryBtn, background: isFormValid ? "linear-gradient(135deg, #6366F1, #4F46E5)" : "#D1D5DB", cursor: isFormValid ? "pointer" : "not-allowed" }}>
              <Zap size={18} /> Analyse My Mortgage
            </button>
          </div>
        )}

        {inputMethod && (
          <button onClick={() => setInputMethod(null)} style={{ marginTop: 16, background: "none", border: "none", cursor: "pointer", color: "#6366F1", fontSize: 14, fontWeight: 500 }}>
            ← Back to method selection
          </button>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   SUB-COMPONENTS
   ═══════════════════════════════════════════════════════════════════════════════ */

function Header({ onBack }) {
  return (
    <div style={{ borderBottom: "1px solid #E5E7EB", background: "white", padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={onBack}>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg, #6366F1, #4F46E5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Banknote size={18} color="white" />
        </div>
        <span style={{ fontWeight: 700, fontSize: 18 }}>MortgageIQ</span>
      </div>
      <div style={{ display: "flex", gap: 24, fontSize: 14, color: "#666", alignItems: "center" }}>
        <span style={{ cursor: "pointer" }}>How it works</span>
        <span style={{ cursor: "pointer" }}>Pricing</span>
        <button style={{ background: "#111", color: "white", border: "none", borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>Sign in</button>
      </div>
    </div>
  );
}

function LandingPage({ onStart }) {
  return (
    <div style={S.page}>
      <Header onBack={() => {}} />

      {/* Hero */}
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "80px 20px 60px", textAlign: "center" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#EEF2FF", border: "1px solid #C7D2FE", borderRadius: 20, padding: "6px 16px", fontSize: 13, color: "#4338CA", fontWeight: 500, marginBottom: 24 }}>
          <Zap size={14} /> AI-Powered Mortgage Analysis
        </div>

        <h1 style={{ fontSize: 52, fontWeight: 800, lineHeight: 1.15, marginBottom: 20, letterSpacing: "-0.02em" }}>
          Pay off your mortgage<br />
          <span style={{ background: "linear-gradient(135deg, #6366F1, #8B5CF6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>years faster</span>
        </h1>

        <p style={{ fontSize: 19, color: "#555", maxWidth: 600, margin: "0 auto 40px", lineHeight: 1.6 }}>
          Upload your mortgage statement or enter your details. Our AI analyses your mortgage and shows you exactly how to save thousands in interest and pay it off faster.
        </p>

        <button onClick={onStart} style={{ ...S.heroBtn }}>
          Analyse My Mortgage <ArrowRight size={18} />
        </button>
        <p style={{ marginTop: 16, fontSize: 13, color: "#999" }}>Free to use — no sign-up required</p>
      </div>

      {/* Features */}
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "0 20px 80px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20 }}>
          {[
            { icon: <Upload size={22} />, title: "Smart Statement Upload", desc: "Upload your mortgage PDF and our AI extracts your balance, rate, term, and lender automatically." },
            { icon: <TrendingDown size={22} />, title: "Overpayment Strategies", desc: "See exactly how extra monthly payments shrink your term and the total interest you'll save." },
            { icon: <Target size={22} />, title: "Rate Change Projections", desc: "What if rates go up 1%? Or drop? See how every scenario affects your monthly payments and total cost." },
          ].map((f, i) => (
            <div key={i} style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: 16, padding: "32px 24px" }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: "#EEF2FF", display: "flex", alignItems: "center", justifyContent: "center", color: "#6366F1", marginBottom: 16 }}>{f.icon}</div>
              <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>{f.title}</h3>
              <p style={{ fontSize: 14, color: "#666", lineHeight: 1.6, margin: 0 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* How it works */}
      <div style={{ background: "white", borderTop: "1px solid #E5E7EB", padding: "80px 20px" }}>
        <div style={{ maxWidth: 800, margin: "0 auto", textAlign: "center" }}>
          <h2 style={{ fontSize: 32, fontWeight: 700, marginBottom: 48 }}>How it works</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 40 }}>
            {[
              { step: "1", title: "Enter your details", desc: "Upload your statement or manually enter your mortgage information" },
              { step: "2", title: "AI analyses", desc: "Our engine runs projections on payoff timelines, rates, and overpayment strategies" },
              { step: "3", title: "Get your plan", desc: "See a clear, personalised roadmap to paying off your mortgage faster" },
            ].map((s, i) => (
              <div key={i}>
                <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#6366F1", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 700, margin: "0 auto 16px" }}>{s.step}</div>
                <h4 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>{s.title}</h4>
                <p style={{ fontSize: 14, color: "#666", lineHeight: 1.6, margin: 0 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ borderTop: "1px solid #E5E7EB", padding: "24px 20px", textAlign: "center" }}>
        <p style={{ fontSize: 13, color: "#999", margin: 0 }}>MortgageIQ is for informational purposes only and does not constitute financial advice. Always consult a qualified mortgage adviser.</p>
      </div>
    </div>
  );
}

function AnalyzingScreen() {
  return (
    <div style={{ minHeight: "100vh", background: "#FAFBFC", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: 64, height: 64, borderRadius: "50%", border: "3px solid #E5E7EB", borderTopColor: "#6366F1", margin: "0 auto 24px", animation: "spin 0.8s linear infinite" }} />
        <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 8 }}>Analysing your mortgage...</h2>
        <p style={{ color: "#666", fontSize: 15 }}>Running projections and crunching the numbers</p>
      </div>
    </div>
  );
}

function MethodCard({ icon, title, desc, onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: "white",
        border: `2px solid ${hovered ? "#6366F1" : "#E5E7EB"}`,
        borderRadius: 16,
        padding: "32px 20px",
        cursor: "pointer",
        textAlign: "center",
        transition: "all 0.2s",
        transform: hovered ? "translateY(-2px)" : "none",
        boxShadow: hovered ? "0 8px 25px rgba(99,102,241,0.12)" : "none",
      }}
    >
      <div style={{ width: 56, height: 56, borderRadius: 14, background: "#EEF2FF", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", color: "#6366F1" }}>{icon}</div>
      <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 13, color: "#666", lineHeight: 1.5 }}>{desc}</div>
    </button>
  );
}

function UploadSection({ uploadedFile, setUploadedFile, dragOver, setDragOver }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Upload Mortgage Statement</h3>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); setUploadedFile(e.dataTransfer.files[0]); }}
        onClick={() => document.getElementById("fileInput")?.click()}
        style={{
          border: `2px dashed ${dragOver ? "#6366F1" : "#D1D5DB"}`,
          borderRadius: 16, padding: "48px 32px", textAlign: "center",
          background: dragOver ? "#EEF2FF" : "white", transition: "all 0.2s", cursor: "pointer",
        }}
      >
        <input id="fileInput" type="file" accept=".pdf,.jpg,.png" style={{ display: "none" }} onChange={(e) => setUploadedFile(e.target.files[0])} />
        {uploadedFile ? (
          <div>
            <CheckCircle size={40} color="#10B981" style={{ marginBottom: 12 }} />
            <p style={{ fontWeight: 600, marginBottom: 4 }}>{uploadedFile.name}</p>
            <p style={{ fontSize: 13, color: "#666" }}>File ready for AI analysis</p>
            <button onClick={(e) => { e.stopPropagation(); setUploadedFile(null); }} style={{ marginTop: 12, background: "none", border: "1px solid #D1D5DB", borderRadius: 8, padding: "6px 16px", cursor: "pointer", fontSize: 13, color: "#666" }}>Remove</button>
          </div>
        ) : (
          <div>
            <Upload size={40} color="#9CA3AF" style={{ marginBottom: 12 }} />
            <p style={{ fontWeight: 600, marginBottom: 4 }}>Drop your mortgage statement here</p>
            <p style={{ fontSize: 13, color: "#666" }}>PDF, JPG, or PNG — we'll extract all the key details using AI</p>
          </div>
        )}
      </div>
      <div style={{ marginTop: 12, padding: "12px 16px", background: "#FEF3C7", borderRadius: 10, display: "flex", alignItems: "flex-start", gap: 10 }}>
        <Shield size={16} color="#D97706" style={{ flexShrink: 0, marginTop: 2 }} />
        <p style={{ fontSize: 12, color: "#92400E", lineHeight: 1.5, margin: 0 }}>Your document is processed securely and never stored on our servers. All analysis happens in real-time and data is deleted immediately after.</p>
      </div>
    </div>
  );
}

function FormField({ label, value, onChange, placeholder, prefix, suffix, required }) {
  const [focused, setFocused] = useState(false);
  return (
    <div>
      <label style={S.label}>
        {label} {required && <span style={{ color: "#EF4444" }}>*</span>}
      </label>
      <div style={{ position: "relative" }}>
        {prefix && <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#9CA3AF", fontSize: 14 }}>{prefix}</span>}
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            width: "100%",
            padding: `10px ${suffix ? "50px" : "14px"} 10px ${prefix ? "30px" : "14px"}`,
            borderRadius: 10,
            border: `1px solid ${focused ? "#6366F1" : "#D1D5DB"}`,
            fontSize: 14, outline: "none", transition: "border-color 0.2s",
            boxSizing: "border-box",
          }}
        />
        {suffix && <span style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", color: "#9CA3AF", fontSize: 13 }}>{suffix}</span>}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   RESULTS DASHBOARD
   ═══════════════════════════════════════════════════════════════════════════════ */

function ResultsDashboard({ analysis, form, extraPayment, setExtraPayment, targetYears, setTargetYears, onBack }) {
  const { current, withExtra, targetPayment, targetAmort, rateScenarios, overpaymentScenarios, maxMonthlyOverpayment, maxAnnualOverpayment, balance } = analysis;
  const currentYears = (current.totalMonths / 12).toFixed(1);

  return (
    <div style={{ minHeight: "100vh", background: "#F3F4F6", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
      <Header onBack={onBack} />

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 20px" }}>
        <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", color: "#6366F1", fontSize: 14, fontWeight: 500, marginBottom: 24, padding: 0 }}>
          ← Edit mortgage details
        </button>

        {/* Summary cards */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 16, marginBottom: 32 }}>
          {[
            { label: "Outstanding Balance", value: fmt(balance), icon: <PoundSterling size={18} />, color: "#6366F1" },
            { label: "Monthly Payment", value: fmt(Math.round(parseFloat(form.monthlyPayment))), icon: <Banknote size={18} />, color: "#10B981" },
            { label: "Interest Rate", value: form.interestRate + "%", icon: <TrendingDown size={18} />, color: "#F59E0B" },
            { label: "Estimated Payoff", value: currentYears + " years", icon: <Clock size={18} />, color: "#EF4444" },
          ].map((c, i) => (
            <div key={i} style={{ background: "white", borderRadius: 16, padding: "24px 20px", border: "1px solid #E5E7EB" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: c.color + "14", display: "flex", alignItems: "center", justifyContent: "center", color: c.color }}>{c.icon}</div>
                <span style={{ fontSize: 12, color: "#666", fontWeight: 500 }}>{c.label}</span>
              </div>
              <div style={{ fontSize: 24, fontWeight: 700 }}>{c.value}</div>
            </div>
          ))}
        </div>

        {/* Interest warning */}
        <div style={{ background: "linear-gradient(135deg, #FEF3C7, #FDE68A)", borderRadius: 16, padding: "20px 24px", marginBottom: 32, display: "flex", alignItems: "center", gap: 16 }}>
          <AlertTriangle size={24} color="#D97706" />
          <div>
            <p style={{ fontWeight: 600, color: "#92400E", margin: "0 0 4px" }}>Total interest at current rate: {fmt(current.totalInterest)}</p>
            <p style={{ fontSize: 13, color: "#A16207", margin: 0 }}>That's on top of your {fmt(balance)} balance. Read on to see how you can significantly reduce this.</p>
          </div>
        </div>

        {/* Balance chart */}
        <Card title="Balance Over Time" subtitle="How your mortgage balance decreases year by year">
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={current.schedule}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
              <XAxis dataKey="year" tickFormatter={(v) => `Yr ${v}`} fontSize={12} />
              <YAxis tickFormatter={(v) => `£${(v / 1000).toFixed(0)}k`} fontSize={12} />
              <Tooltip formatter={(v) => [`£${v.toLocaleString()}`, ""]} />
              <Area type="monotone" dataKey="balance" stroke="#6366F1" fill="#EEF2FF" strokeWidth={2} name="Balance" />
              <Area type="monotone" dataKey="totalInterest" stroke="#F59E0B" fill="#FEF3C7" strokeWidth={2} name="Cumulative Interest" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        {/* Overpayment strategies */}
        <Card title="Overpayment Strategies" subtitle={`Based on your ${form.overpaymentAllowance || "10"}% annual allowance, you can overpay up to ${fmt(maxAnnualOverpayment)}/year (${fmt(maxMonthlyOverpayment)}/month) without penalty.`}>
          {form.rateType === "Fixed" && form.earlyRepaymentCharge && (
            <div style={{ padding: "10px 14px", background: "#FEF2F2", borderRadius: 10, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
              <AlertTriangle size={14} color="#EF4444" />
              <p style={{ fontSize: 12, color: "#991B1B", margin: 0 }}>
                You have a {form.earlyRepaymentCharge}% early repayment charge. Overpayments within your allowance are fine, but paying off the entire mortgage early may incur a fee.
              </p>
            </div>
          )}

          <div style={{ overflowX: "auto", marginBottom: 24 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #E5E7EB" }}>
                  {["Extra/month", "New Term", "Interest Saved", "Years Saved", "Status"].map((h) => (
                    <th key={h} style={{ textAlign: "left", padding: "10px 12px", color: "#666", fontWeight: 500, fontSize: 12 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {overpaymentScenarios.map((s, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #F3F4F6" }}>
                    <td style={{ padding: 12, fontWeight: 600 }}>{s.extra}</td>
                    <td style={{ padding: 12 }}>{s.years} years</td>
                    <td style={{ padding: 12, color: "#10B981", fontWeight: 600 }}>{fmt(s.saved)}</td>
                    <td style={{ padding: 12, color: "#6366F1", fontWeight: 600 }}>{s.yearsSaved} years</td>
                    <td style={{ padding: 12 }}>
                      {s.withinLimit ? (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "#10B981", background: "#ECFDF5", padding: "4px 10px", borderRadius: 6 }}><CheckCircle size={12} /> Within allowance</span>
                      ) : (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "#D97706", background: "#FEF3C7", padding: "4px 10px", borderRadius: 6 }}><AlertTriangle size={12} /> Exceeds allowance</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Custom overpayment */}
          <div style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
            <div style={{ flex: 1 }}>
              <label style={S.label}>Try a custom extra monthly payment</label>
              <FormField value={extraPayment} onChange={setExtraPayment} prefix="£" placeholder="e.g. 350" label="" />
            </div>
          </div>
          {withExtra && (
            <div style={{ marginTop: 16, padding: "16px 20px", background: "#ECFDF5", borderRadius: 12, border: "1px solid #A7F3D0" }}>
              <p style={{ margin: 0, fontWeight: 600, color: "#065F46" }}>
                With an extra £{Math.min(parseFloat(extraPayment), maxMonthlyOverpayment)}/month, you'd pay off in {(withExtra.totalMonths / 12).toFixed(1)} years — saving {fmt(current.totalInterest - withExtra.totalInterest)} in interest!
              </p>
            </div>
          )}
        </Card>

        {/* Target payoff */}
        <Card title="Pay Off In X Years" subtitle="Enter a target and see the monthly payment you'd need">
          <div style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
            <div style={{ flex: 1 }}>
              <FormField value={targetYears} onChange={setTargetYears} suffix="years" placeholder="e.g. 10" label="" />
            </div>
          </div>
          {targetPayment && targetAmort && (
            <div style={{ marginTop: 16, padding: "16px 20px", background: "#EEF2FF", borderRadius: 12, border: "1px solid #C7D2FE" }}>
              <p style={{ margin: "0 0 8px", fontWeight: 600, color: "#312E81" }}>
                To pay off in {targetYears} years, you'd need to pay {fmt(Math.round(targetPayment))}/month
              </p>
              <p style={{ margin: 0, fontSize: 13, color: "#4338CA" }}>
                That's {fmt(Math.round(targetPayment - parseFloat(form.monthlyPayment)))} more per month. Total interest: {fmt(targetAmort.totalInterest)} (saving {fmt(current.totalInterest - targetAmort.totalInterest)}).
              </p>
            </div>
          )}
        </Card>

        {/* Rate scenarios */}
        <Card title="Interest Rate Scenarios" subtitle="What happens if rates change when your current deal ends?">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={rateScenarios}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
              <XAxis dataKey="rate" fontSize={12} />
              <YAxis tickFormatter={(v) => `£${v.toLocaleString()}`} fontSize={12} />
              <Tooltip formatter={(v) => [`£${v.toLocaleString()}`, ""]} />
              <Bar dataKey="monthlyPayment" fill="#6366F1" radius={[6, 6, 0, 0]} name="Monthly Payment" />
            </BarChart>
          </ResponsiveContainer>

          <div style={{ overflowX: "auto", marginTop: 20 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #E5E7EB" }}>
                  {["Rate", "Monthly Payment", "Difference", "Total Interest"].map((h) => (
                    <th key={h} style={{ textAlign: "left", padding: "10px 12px", color: "#666", fontWeight: 500, fontSize: 12 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rateScenarios.map((s, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #F3F4F6", background: s.rateNum === parseFloat(form.interestRate) ? "#EEF2FF" : "transparent" }}>
                    <td style={{ padding: 12, fontWeight: 600 }}>
                      {s.rate} {s.rateNum === parseFloat(form.interestRate) && <span style={{ fontSize: 11, color: "#6366F1", fontWeight: 500 }}>(current)</span>}
                    </td>
                    <td style={{ padding: 12 }}>{fmt(s.monthlyPayment)}</td>
                    <td style={{ padding: 12, fontWeight: 600, color: s.difference > 0 ? "#EF4444" : s.difference < 0 ? "#10B981" : "#666" }}>
                      {s.difference > 0 ? "+" : ""}{fmt(s.difference)}
                    </td>
                    <td style={{ padding: 12, color: "#666" }}>{fmt(s.totalInterest)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* AI Recommendations */}
        <div style={{ background: "linear-gradient(135deg, #6366F1, #4F46E5)", borderRadius: 16, padding: 28, marginBottom: 24, color: "white" }}>
          <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>AI Recommendations</h3>
          <div style={{ display: "grid", gap: 12 }}>
            {generateRecommendations(analysis, form).map((rec, i) => (
              <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 14 }}>{i + 1}</div>
                <p style={{ margin: 0, lineHeight: 1.6, fontSize: 14, opacity: 0.95 }}>{rec}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Disclaimer */}
        <div style={{ padding: "16px 20px", background: "#F9FAFB", borderRadius: 12, border: "1px solid #E5E7EB", marginBottom: 40 }}>
          <p style={{ margin: 0, fontSize: 12, color: "#999", lineHeight: 1.6 }}>
            <strong>Disclaimer:</strong> MortgageIQ provides estimates for informational purposes only. Actual figures may vary based on your lender's specific terms, fees, and calculation methods. This does not constitute financial advice. Always consult a qualified mortgage adviser before making changes to your mortgage.
          </p>
        </div>
      </div>
    </div>
  );
}

function Card({ title, subtitle, children }) {
  return (
    <div style={{ background: "white", borderRadius: 16, border: "1px solid #E5E7EB", padding: 28, marginBottom: 24 }}>
      <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>{title}</h3>
      {subtitle && <p style={{ fontSize: 13, color: "#666", marginBottom: 20 }}>{subtitle}</p>}
      {children}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   AI RECOMMENDATIONS
   ═══════════════════════════════════════════════════════════════════════════════ */

function generateRecommendations(analysis, form) {
  const recs = [];
  const { current, overpaymentScenarios, maxMonthlyOverpayment } = analysis;
  const rate = parseFloat(form.interestRate);

  if (overpaymentScenarios.length > 0) {
    const best = overpaymentScenarios.filter((s) => s.withinLimit).pop();
    if (best) {
      recs.push(
        `Maximise your overpayment allowance: paying an extra ${best.extra}/month would save you £${best.saved.toLocaleString()} in interest and cut ${best.yearsSaved} years off your mortgage — all within your penalty-free allowance.`
      );
    }
  }

  if (form.rateType === "Fixed" && form.fixedUntil) {
    recs.push(
      `Your fixed rate ends ${form.fixedUntil}. Start shopping for remortgage deals 3-6 months before to avoid falling onto your lender's SVR, which is typically 1.5-2% higher.`
    );
  } else if (form.rateType.includes("SVR")) {
    recs.push(
      `You're on your lender's Standard Variable Rate — almost always higher than what's available. You could save hundreds per month by switching to a competitive fixed or tracker rate.`
    );
  }

  if (rate >= 5) {
    recs.push(
      `At ${rate}%, your rate is on the higher end. You'd pay £${current.totalInterest.toLocaleString()} in interest alone. Even reducing by 0.5% through remortgaging could save tens of thousands.`
    );
  }

  if (form.bank) {
    recs.push(
      `Check with ${form.bank} about loyalty rates or product transfers — sometimes your existing lender offers competitive deals without full remortgage fees.`
    );
  }

  recs.push(
    `Consider an offset mortgage if you have significant savings. Rather than earning taxable interest, offsetting against your balance reduces the interest you pay — effectively earning your mortgage rate tax-free.`
  );

  recs.push(
    `If you receive a bonus or windfall, even a one-off £5,000 overpayment now could save over £${Math.round(5000 * rate / 100 * parseFloat(form.remainingYears) * 0.4).toLocaleString()} in interest over your remaining term.`
  );

  return recs.slice(0, 5);
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
  label: {
    display: "block",
    fontSize: 13,
    fontWeight: 500,
    color: "#374151",
    marginBottom: 6,
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
  },
  primaryBtn: {
    marginTop: 28,
    width: "100%",
    padding: "16px 24px",
    color: "white",
    border: "none",
    borderRadius: 14,
    fontSize: 16,
    fontWeight: 600,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    transition: "all 0.2s",
  },
  heroBtn: {
    padding: "18px 40px",
    background: "linear-gradient(135deg, #6366F1, #4F46E5)",
    color: "white",
    border: "none",
    borderRadius: 14,
    fontSize: 17,
    fontWeight: 600,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 10,
    transition: "all 0.2s",
    boxShadow: "0 4px 20px rgba(99,102,241,0.3)",
  },
};
