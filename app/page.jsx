"use client";

import { useState, useMemo, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";
import {
  Upload, Calculator, TrendingDown, Clock, PoundSterling, Lock,
  FileText, AlertTriangle, CheckCircle, Info, ArrowRight, Server,
  Banknote, Target, Zap, Shield, ChevronDown, Mail, Loader, Building2,
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
   ROLL-FORWARD ENGINE
   ═══════════════════════════════════════════════════════════════════════════════ */

function rollForward(balance, annualRate, monthlyPayment, months) {
  const r = annualRate / 100 / 12;
  let bal = balance;
  let totalInterest = 0;
  let totalPrincipal = 0;
  for (let i = 0; i < months; i++) {
    if (bal <= 0.01) break;
    const interest = bal * r;
    const principal = monthlyPayment - interest;
    if (principal <= 0) break; // payment doesn't cover interest
    bal = Math.max(0, bal - principal);
    totalInterest += interest;
    totalPrincipal += principal;
  }
  return {
    balance: Math.round(bal),
    totalInterest: Math.round(totalInterest),
    totalPrincipal: Math.round(totalPrincipal),
  };
}

function parseStatementDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

function monthsElapsedBetween(from, to) {
  return (to.getFullYear() - from.getFullYear()) * 12 +
    (to.getMonth() - from.getMonth());
}

// Try to parse a free-text month-year string like "March 2027" or "August 2025"
function parseMonthYear(str) {
  if (!str) return null;
  const d = new Date(str.trim() + " 1");
  return isNaN(d.getTime()) ? null : d;
}

function fmtDate(d) {
  return d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
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
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState(null);
  const [parsedData, setParsedData] = useState(null);

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
  const [adjustment, setAdjustment] = useState(null);
  // "residential" | "buy_to_let" | "commercial" | "unclear" | null
  const [mortgageCategory, setMortgageCategory] = useState(null);
  // User-editable overrides for rolled-forward figures
  const [adjBalance, setAdjBalance] = useState("");
  const [adjYears, setAdjYears] = useState("");

  const updateForm = (key, value) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  // Handle file upload and parsing
  const handleFileUpload = async (file) => {
    if (!file) return;
    
    setUploadedFile(file);
    setParsing(true);
    setParseError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/parse", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        setParseError(errorData.error || "Failed to parse document");
        setParsing(false);
        return;
      }

      const extractedData = await response.json();

      // Auto-fill form with extracted data (all fields)
      setForm((prev) => ({
        ...prev,
        outstandingBalance:   extractedData.outstandingBalance   || prev.outstandingBalance,
        monthlyPayment:       extractedData.monthlyPayment       || prev.monthlyPayment,
        interestRate:         extractedData.interestRate         || prev.interestRate,
        remainingYears:       extractedData.remainingYears       || prev.remainingYears,
        bank:                 extractedData.bank                 || prev.bank,
        mortgageType:         extractedData.mortgageType         || prev.mortgageType,
        rateType:             extractedData.rateType             || prev.rateType,
        fixedUntil:           extractedData.fixedUntil           || prev.fixedUntil,
        earlyRepaymentCharge: extractedData.earlyRepaymentCharge || prev.earlyRepaymentCharge,
        originalLoanAmount:   extractedData.originalLoanAmount   || prev.originalLoanAmount,
        originalTerm:         extractedData.originalTerm         || prev.originalTerm,
      }));

      setParsedData(extractedData);
      setMortgageCategory(extractedData.propertyCategory || null);
      setParseError(null);
    } catch (error) {
      console.error("Error parsing file:", error);
      setParseError("Failed to process file. Please try again or enter details manually.");
    } finally {
      setParsing(false);
    }
  };

  /* ─── Analysis ────────────────────────────────────────────────────────────── */

  const analysis = useMemo(() => {
    // Use user-edited override → rolled-forward → original form values
    const balance = parseFloat(adjBalance) || (adjustment?.adjustedBalance) || parseFloat(form.outstandingBalance);
    const years   = parseFloat(adjYears)   || (adjustment?.adjustedYears)   || parseFloat(form.remainingYears);
    const payment = parseFloat(form.monthlyPayment);
    const rate = parseFloat(form.interestRate);
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

    // "Pay off 10 years sooner" calculation
    const tenYearsTarget = Math.max(years - 10, 1);
    const tenYearsPayment = calcMonthlyPayment(balance, rate, tenYearsTarget);
    const tenYearsAmort = buildAmortization(balance, rate, tenYearsPayment);
    const tenYearsExtra = Math.round(tenYearsPayment - payment);
    const tenYearsInterestSaved = current.totalInterest - tenYearsAmort.totalInterest;
    const tenYearsWithinLimit = tenYearsExtra <= maxMonthlyOverpayment;
    const tenYearsMaxAllowedAmort = buildAmortization(balance, rate, payment, maxMonthlyOverpayment);
    const tenYearsMaxYearsSaved = ((current.totalMonths - tenYearsMaxAllowedAmort.totalMonths) / 12).toFixed(1);

    return {
      current, withExtra, targetPayment, targetAmort,
      rateScenarios, overpaymentScenarios,
      maxMonthlyOverpayment, maxAnnualOverpayment,
      currentMonthlyPayment: payment, interestRate: rate, balance,
      tenYears: {
        targetYears: tenYearsTarget,
        payment: tenYearsPayment,
        extra: tenYearsExtra,
        interestSaved: tenYearsInterestSaved,
        withinLimit: tenYearsWithinLimit,
        maxYearsSaved: tenYearsMaxYearsSaved,
        maxInterestSaved: current.totalInterest - tenYearsMaxAllowedAmort.totalInterest,
      },
    };
  }, [form, extraPayment, targetYears, adjBalance, adjYears, adjustment]);

  const handleAnalyze = () => {
    setStep("analyzing");
    setTimeout(() => setStep("results"), 2200);
  };

  const isFormValid =
    form.outstandingBalance && form.monthlyPayment &&
    form.interestRate && form.remainingYears;

  // Compute roll-forward adjustment whenever parsedData arrives with a statement date
  useEffect(() => {
    if (!parsedData?.statementDate) { setAdjustment(null); return; }
    const stmtDate = parseStatementDate(parsedData.statementDate);
    if (!stmtDate) { setAdjustment(null); return; }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const months = monthsElapsedBetween(stmtDate, today);

    // No adjustment needed this month or future-dated statement
    if (months <= 0) { setAdjustment(null); return; }

    const balance  = parseFloat(form.outstandingBalance);
    const payment  = parseFloat(form.monthlyPayment);
    const rate     = parseFloat(form.interestRate);
    const years    = parseFloat(form.remainingYears);
    if (!balance || !payment || !rate || !years) { setAdjustment(null); return; }

    const rolled = rollForward(balance, rate, payment, months);
    const adjY   = Math.max(0, Math.round((years * 12 - months) / 12 * 10) / 10);

    // Check if fixed rate period has lapsed between statement date and today
    const fixedEndDate = parseMonthYear(form.fixedUntil);
    const fixedRateLapsed =
      fixedEndDate &&
      fixedEndDate > stmtDate &&
      fixedEndDate <= today;

    const adj = {
      statementDate: stmtDate,
      today,
      months,
      originalBalance: balance,
      originalYears:   years,
      adjustedBalance: rolled.balance,
      adjustedYears:   adjY,
      interestInGap:   rolled.totalInterest,
      principalInGap:  rolled.totalPrincipal,
      tooOld:          months > 24,
      fixedRateLapsed,
      fixedEndDate,
    };
    setAdjustment(adj);
    setAdjBalance(String(rolled.balance));
    setAdjYears(String(adjY));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsedData]);

  // Auto-trigger analysis after upload-only extraction completes (residential only)
  useEffect(() => {
    if (
      inputMethod === "upload" && parsedData && isFormValid &&
      (mortgageCategory === "residential" || mortgageCategory === null)
    ) {
      const timer = setTimeout(() => handleAnalyze(), 1500);
      return () => clearTimeout(timer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsedData, inputMethod, mortgageCategory]);

  /* ─── Render: Landing ─────────────────────────────────────────────────────── */

  if (step === "landing") return <LandingPage onStart={() => setStep("input")} />;
  if (step === "analyzing") return <AnalyzingScreen />;
  if (step === "results" && analysis)
    return (
      <ResultsDashboard
        analysis={analysis}
        form={form}
        parsedData={parsedData}
        adjustment={adjustment}
        adjBalance={adjBalance}
        setAdjBalance={setAdjBalance}
        adjYears={adjYears}
        setAdjYears={setAdjYears}
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
            <div style={{ display: "flex", gap: 16, justifyContent: "center", maxWidth: 560, margin: "0 auto" }}>
              {[
                { id: "upload", icon: <Upload size={28} />, title: "Upload Statement", desc: "Upload your latest mortgage statement PDF and we'll extract the details", tag: "Fastest" },
                { id: "manual", icon: <Calculator size={28} />, title: "Enter Manually", desc: "Input your mortgage details by hand — quick and straightforward" },
              ].map((opt) => (
                <div key={opt.id} style={{ flex: 1 }}>
                  <MethodCard {...opt} onClick={() => setInputMethod(opt.id)} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upload */}
        {inputMethod === "upload" && (
          <UploadSection
            uploadedFile={uploadedFile}
            setUploadedFile={(f) => { setUploadedFile(f); if (!f) setParsedData(null); }}
            dragOver={dragOver}
            setDragOver={setDragOver}
            onFileUpload={handleFileUpload}
            parsing={parsing}
            parseError={parseError}
            parsedData={parsedData}
          />
        )}

        {/* BTL / Commercial detected → redirect screen */}
        {inputMethod === "upload" && parsedData && (mortgageCategory === "buy_to_let" || mortgageCategory === "commercial") && (
          <BtlRedirectScreen
            category={mortgageCategory}
            onAnalyseAnyway={() => { setMortgageCategory("residential"); handleAnalyze(); }}
          />
        )}

        {/* Unclear type → ask the user */}
        {inputMethod === "upload" && parsedData && mortgageCategory === "unclear" && (
          <PropertyTypeQuestion
            onMyHome={() => { setMortgageCategory("residential"); handleAnalyze(); }}
          />
        )}

        {/* Residential → show analyse button */}
        {inputMethod === "upload" && parsedData && isFormValid && (mortgageCategory === "residential" || mortgageCategory === null) && (
          <div style={{ marginTop: 20, textAlign: "center" }}>
            <div style={{ marginBottom: 12, fontSize: 13, color: "#10B981", fontWeight: 500 }}>
              ✓ Details extracted — generating your analysis…
            </div>
            <button onClick={handleAnalyze} style={{ ...S.primaryBtn, background: "linear-gradient(135deg, #6366F1, #4F46E5)", display: "inline-flex" }}>
              <Zap size={18} /> Analyse My Mortgage
            </button>
          </div>
        )}

        {/* Manual form */}
        {inputMethod === "manual" && (
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
  const { data: session } = useSession();
  const router = useRouter();
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div style={{ borderBottom: "1px solid #E5E7EB", background: "white", padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={onBack}>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg, #6366F1, #4F46E5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Banknote size={18} color="white" />
        </div>
        <span style={{ fontWeight: 700, fontSize: 18 }}>Mortgage AI Calc</span>
      </div>
      <div style={{ display: "flex", gap: 24, fontSize: 14, color: "#666", alignItems: "center" }}>
        <span style={{ cursor: "pointer" }}>How it works</span>
        <span style={{ cursor: "pointer" }}>Pricing</span>
        <span
          onClick={() => router.push("/compare")}
          style={{ cursor: "pointer", color: "#6366F1", fontWeight: 500 }}
        >
          Compare Deals
        </span>
        {session?.user ? (
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setShowMenu(!showMenu)}
              style={{
                background: "white",
                border: "1px solid #D1D5DB",
                borderRadius: 8,
                padding: "8px 18px",
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #6366F1, #4F46E5)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "white",
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                {session.user.name?.charAt(0) || session.user.email?.charAt(0)}
              </div>
              {session.user.name || "Account"}
            </button>
            {showMenu && (
              <div style={{ position: "absolute", top: "100%", right: 0, marginTop: 8, background: "white", border: "1px solid #E5E7EB", borderRadius: 10, boxShadow: "0 4px 20px rgba(0,0,0,0.1)", minWidth: 200, zIndex: 10 }}>
                <button
                  onClick={() => {
                    router.push("/analyses");
                    setShowMenu(false);
                  }}
                  style={{ width: "100%", textAlign: "left", padding: "12px 16px", background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "#111", borderBottom: "1px solid #F3F4F6" }}
                >
                  My Analyses
                </button>
                <button
                  onClick={() => {
                    signOut();
                    setShowMenu(false);
                  }}
                  style={{ width: "100%", textAlign: "left", padding: "12px 16px", background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "#EF4444" }}
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            <button onClick={() => router.push("/auth/signin")} style={{ background: "none", border: "none", cursor: "pointer", color: "#666", fontSize: 13, fontWeight: 500 }}>
              Sign in
            </button>
            <button
              onClick={() => router.push("/auth/signup")}
              style={{ background: "#111", color: "white", border: "none", borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 500, cursor: "pointer" }}
            >
              Sign up
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   MONEY BACKGROUND
   ═══════════════════════════════════════════════════════════════════════════════ */

function MoneyBackground() {
  const icons = [
    // [symbol/type, top%, left%, size, floatClass, color]
    ["£", 8,  7,  64, "money-float-1",  "#6366F1"],
    ["£", 14, 88, 48, "money-float-2",  "#8B5CF6"],
    ["£", 72, 5,  56, "money-float-3",  "#6366F1"],
    ["£", 80, 92, 44, "money-float-4",  "#4F46E5"],
    ["£", 44, 3,  36, "money-float-5",  "#7C3AED"],
    ["£", 55, 95, 52, "money-float-6",  "#6366F1"],
    ["coin", 22, 20, 52, "money-float-7",  "#6366F1"],
    ["coin", 65, 78, 44, "money-float-8",  "#8B5CF6"],
    ["coin", 38, 58, 36, "money-float-9",  "#4F46E5"],
    ["coin", 85, 40, 48, "money-float-10", "#7C3AED"],
    ["spark", 30, 12, 28, "money-float-11", "#6366F1"],
    ["spark", 50, 85, 24, "money-float-12", "#8B5CF6"],
    ["spark", 18, 50, 20, "money-float-1",  "#4F46E5"],
    ["spark", 75, 65, 22, "money-float-3",  "#6366F1"],
  ];

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 0 }}>
      {icons.map(([type, top, left, size, cls, color], i) => (
        <div
          key={i}
          className={cls}
          style={{ position: "absolute", top: `${top}%`, left: `${left}%` }}
        >
          {type === "£" && (
            <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
              <circle cx="32" cy="32" r="30" stroke={color} strokeWidth="2.5" opacity="0.25" />
              <text x="50%" y="54%" dominantBaseline="middle" textAnchor="middle"
                fontSize="30" fontWeight="800" fill={color} opacity="0.6"
                fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif">£</text>
            </svg>
          )}
          {type === "coin" && (
            <svg width={size} height={size} viewBox="0 0 56 56" fill="none">
              <ellipse cx="28" cy="28" rx="26" ry="26" fill={color} opacity="0.08" />
              <ellipse cx="28" cy="28" rx="26" ry="26" stroke={color} strokeWidth="2" opacity="0.3" />
              <ellipse cx="28" cy="22" rx="22" ry="6" fill="none" stroke={color} strokeWidth="1.5" opacity="0.25" />
              <line x1="28" y1="16" x2="28" y2="40" stroke={color} strokeWidth="2" opacity="0.25" />
              <path d="M22 22 Q28 26 34 22" stroke={color} strokeWidth="1.5" fill="none" opacity="0.3" />
              <path d="M22 34 Q28 38 34 34" stroke={color} strokeWidth="1.5" fill="none" opacity="0.3" />
            </svg>
          )}
          {type === "spark" && (
            <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
              <path d="M16 2 L18 13 L29 16 L18 19 L16 30 L14 19 L3 16 L14 13 Z"
                fill={color} opacity="0.35" />
            </svg>
          )}
        </div>
      ))}

      {/* Large blurred orbs for depth */}
      <div style={{
        position: "absolute", top: "5%", right: "10%",
        width: 320, height: 320, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(99,102,241,0.09) 0%, transparent 70%)",
        filter: "blur(40px)",
      }} />
      <div style={{
        position: "absolute", bottom: "10%", left: "5%",
        width: 260, height: 260, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(139,92,246,0.08) 0%, transparent 70%)",
        filter: "blur(40px)",
      }} />
    </div>
  );
}

function LandingPage({ onStart }) {
  return (
    <div style={S.page}>
      <Header onBack={() => {}} />

      {/* Hero */}
      <div style={{ position: "relative", overflow: "hidden", background: "linear-gradient(160deg, #f8f7ff 0%, #fafbff 50%, #f0f4ff 100%)" }}>
        <MoneyBackground />
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "80px 20px 60px", textAlign: "center", position: "relative", zIndex: 1 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#EEF2FF", border: "1px solid #C7D2FE", borderRadius: 20, padding: "6px 16px", fontSize: 13, color: "#4338CA", fontWeight: 500, marginBottom: 24 }}>
          <Zap size={14} /> Advanced Mortgage Analysis
        </div>

        <h1 style={{ fontSize: 52, fontWeight: 800, lineHeight: 1.15, marginBottom: 20, letterSpacing: "-0.02em" }}>
          Pay off your mortgage<br />
          <span style={{ background: "linear-gradient(135deg, #6366F1, #8B5CF6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>years faster</span>
        </h1>

        <p style={{ fontSize: 19, color: "#555", maxWidth: 600, margin: "0 auto 40px", lineHeight: 1.6 }}>
          Upload your mortgage statement or enter your details. Our calculator analyses your mortgage and shows you exactly how to save thousands in interest and pay it off faster.
        </p>

        <div style={{ display: "flex", gap: 20, justifyContent: "center", flexWrap: "wrap", marginBottom: 8 }}>
          <div style={{ textAlign: "center" }}>
            <button onClick={onStart} style={{ ...S.heroBtn }}>
              Analyse My Mortgage <ArrowRight size={18} />
            </button>
            <p style={{ marginTop: 8, fontSize: 12, color: "#9CA3AF" }}>For personal residential mortgages</p>
          </div>
          <div style={{ textAlign: "center" }}>
            <button onClick={() => window.location.href = "/portfolio"} style={{ ...S.heroBtn, background: "linear-gradient(135deg, #7C3AED, #6366F1)", boxShadow: "0 4px 20px rgba(124,58,237,0.3)" }}>
              <Building2 size={18} /> Portfolio Manager
            </button>
            <p style={{ marginTop: 8, fontSize: 12, color: "#9CA3AF" }}>For buy-to-let &amp; investment properties</p>
          </div>
        </div>
        <p style={{ marginTop: 4, fontSize: 13, color: "#999" }}>Free to use — no sign-up required</p>
        </div>
      </div>

      {/* Features */}
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "0 20px 80px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20 }}>
          {[
            { icon: <Upload size={22} />, title: "Smart Statement Scan", desc: "Upload your mortgage PDF and we'll extract your balance, rate, term, and lender automatically." },
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
        <p style={{ fontSize: 13, color: "#999", margin: 0 }}>Mortgage AI Calc is for informational purposes only and does not constitute financial advice. Always consult a qualified mortgage adviser.</p>
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

/* ═══════════════════════════════════════════════════════════════════════════════
   COUNT-UP ANIMATION
   ═══════════════════════════════════════════════════════════════════════════════ */

function CountUp({ target, duration = 1800, prefix = "£" }) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!target) return;
    let rafId;
    const startTime = performance.now();
    const tick = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // cubic ease-out
      setValue(Math.round(target * eased));
      if (progress < 1) rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [target, duration]);
  return `${prefix}${value.toLocaleString("en-GB")}`;
}

/* ═══════════════════════════════════════════════════════════════════════════════
   INTEREST HERO
   ═══════════════════════════════════════════════════════════════════════════════ */

function InterestHero({ totalInterest, balance, origLoan, interestRate, monthlyPayment, isIslamicFinance }) {
  const interestLabel = isIslamicFinance ? "rental payments" : "interest";
  const totalRepaid = totalInterest + balance;

  const scenarios = [100, 250, 500].map((extra) => {
    const base = buildAmortization(balance, interestRate, monthlyPayment);
    const withExtra = buildAmortization(balance, interestRate, monthlyPayment, extra);
    return { extra, saved: base.totalInterest - withExtra.totalInterest };
  });

  return (
    <div style={{
      background: "white",
      borderRadius: 20,
      border: "1px solid #FECACA",
      borderTop: "5px solid #DC2626",
      padding: "44px 40px 36px",
      marginBottom: 32,
      boxShadow: "0 4px 24px rgba(220,38,38,0.06)",
    }}>
      {/* Main headline */}
      <div style={{ textAlign: "center", marginBottom: 36 }}>
        <p style={{ fontSize: 18, fontWeight: 500, color: "#6B7280", marginBottom: 10, letterSpacing: "-0.01em" }}>
          You&apos;re set to pay
        </p>
        <p style={{
          fontSize: 62,
          fontWeight: 800,
          color: "#DC2626",
          lineHeight: 1,
          marginBottom: 10,
          fontVariantNumeric: "tabular-nums",
          letterSpacing: "-0.03em",
        }}>
          <CountUp target={totalInterest} />
        </p>
        <p style={{ fontSize: 20, fontWeight: 600, color: "#374151", marginBottom: 18 }}>
          in {interestLabel}
        </p>
        <p style={{ fontSize: 15, color: "#6B7280", maxWidth: 540, margin: "0 auto", lineHeight: 1.6 }}>
          That&apos;s on top of your{" "}
          <strong style={{ color: "#111" }}>{fmt(balance)}</strong>{" "}
          balance — meaning you&apos;ll pay back{" "}
          <strong style={{ color: "#111" }}>{fmt(totalRepaid)}</strong> in total
          {origLoan ? ` for a home that cost ${fmt(origLoan)}` : ""}.
        </p>
      </div>

      {/* Quick-win cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 28 }}>
        {scenarios.map((s) => (
          <div key={s.extra} style={{
            background: "linear-gradient(135deg, #ECFDF5, #D1FAE5)",
            border: "1px solid #A7F3D0",
            borderRadius: 14,
            padding: "20px 16px",
            textAlign: "center",
          }}>
            <p style={{ fontSize: 13, color: "#374151", marginBottom: 8 }}>
              Overpay <strong>£{s.extra}/month</strong>
            </p>
            <p style={{ fontSize: 26, fontWeight: 800, color: "#059669", marginBottom: 4, letterSpacing: "-0.02em" }}>
              {fmt(s.saved)}
            </p>
            <p style={{ fontSize: 12, color: "#6B7280" }}>saved in {interestLabel}</p>
          </div>
        ))}
      </div>

      {/* Scroll CTA */}
      <div style={{ textAlign: "center" }}>
        <p style={{ fontSize: 14, color: "#9CA3AF", display: "inline-flex", alignItems: "center", gap: 6 }}>
          <ChevronDown size={16} color="#9CA3AF" />
          Scroll down to see exactly how to reduce this
        </p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   BTL / COMMERCIAL REDIRECT SCREEN
   ═══════════════════════════════════════════════════════════════════════════════ */

function BtlRedirectScreen({ category, onAnalyseAnyway }) {
  const router = useRouter();
  const isBtl = category === "buy_to_let";
  return (
    <div style={{ maxWidth: 560, margin: "32px auto 0", background: "white", border: "1px solid #E5E7EB", borderRadius: 20, padding: "44px 40px", textAlign: "center" }}>
      <div style={{ width: 64, height: 64, borderRadius: 18, background: "#EEF2FF", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px", color: "#6366F1" }}>
        <Building2 size={28} />
      </div>
      <h2 style={{ fontSize: 21, fontWeight: 700, marginBottom: 14, lineHeight: 1.3 }}>
        This looks like a {isBtl ? "buy-to-let" : "commercial"} mortgage
      </h2>
      <p style={{ fontSize: 15, color: "#6B7280", lineHeight: 1.7, marginBottom: 36 }}>
        Our mortgage analyser is designed for personal residential mortgages.
        For {isBtl ? "buy-to-let and investment" : "commercial"} properties, we have a dedicated
        Portfolio Manager with tools built specifically for landlords — including cash flow analysis,
        yield calculations, and tenant management.
      </p>
      <button
        onClick={() => router.push("/portfolio")}
        style={{ width: "100%", padding: "14px 0", background: "linear-gradient(135deg, #6366F1, #4F46E5)", color: "white", border: "none", borderRadius: 12, fontSize: 16, fontWeight: 600, cursor: "pointer", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
      >
        <Building2 size={18} /> Go to Portfolio Manager
      </button>
      <button
        onClick={onAnalyseAnyway}
        style={{ background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", fontSize: 13, textDecoration: "underline" }}
      >
        Analyse anyway — I know this is a residential mortgage
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   PROPERTY TYPE QUESTION (when type is unclear)
   ═══════════════════════════════════════════════════════════════════════════════ */

function PropertyTypeQuestion({ onMyHome }) {
  const router = useRouter();
  return (
    <div style={{ maxWidth: 480, margin: "32px auto 0", background: "white", border: "1px solid #E5E7EB", borderRadius: 20, padding: "44px 40px", textAlign: "center" }}>
      <div style={{ width: 56, height: 56, borderRadius: 16, background: "#EEF2FF", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", color: "#6366F1" }}>
        <Info size={24} />
      </div>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>
        Is this your personal home or a rental property?
      </h2>
      <p style={{ fontSize: 14, color: "#6B7280", marginBottom: 32, lineHeight: 1.6 }}>
        We couldn&apos;t automatically detect the mortgage type from your document.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <button
          onClick={onMyHome}
          style={{ padding: "14px 24px", background: "linear-gradient(135deg, #6366F1, #4F46E5)", color: "white", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: "pointer" }}
        >
          My personal home
        </button>
        <button
          onClick={() => router.push("/portfolio")}
          style={{ padding: "14px 24px", background: "white", color: "#374151", border: "2px solid #E5E7EB", borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
        >
          <Building2 size={16} /> Investment / buy-to-let property
        </button>
      </div>
    </div>
  );
}

function UploadSection({ uploadedFile, setUploadedFile, dragOver, setDragOver, onFileUpload, parsing, parseError, parsedData }) {
  const fieldsExtracted = parsedData ? [
    parsedData.outstandingBalance && "Outstanding balance",
    parsedData.monthlyPayment     && "Monthly payment",
    parsedData.interestRate       && "Interest rate",
    parsedData.remainingYears     && "Remaining term",
    parsedData.bank               && `Lender (${parsedData.bank})`,
    parsedData.fixedUntil         && `Fixed until ${parsedData.fixedUntil}`,
    parsedData.earlyRepaymentCharge && `ERC ${parsedData.earlyRepaymentCharge}%`,
  ].filter(Boolean) : [];

  return (
    <div style={{ marginBottom: 32 }}>
      <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Upload Mortgage Statement</h3>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); onFileUpload(e.dataTransfer.files[0]); }}
        onClick={() => !parsing && !uploadedFile && document.getElementById("fileInput")?.click()}
        style={{
          border: `2px dashed ${uploadedFile ? "#10B981" : dragOver ? "#6366F1" : "#D1D5DB"}`,
          borderRadius: 16, padding: "32px", textAlign: "center",
          background: uploadedFile ? "#F0FDF4" : dragOver ? "#EEF2FF" : "white",
          transition: "all 0.2s", cursor: parsing || uploadedFile ? "default" : "pointer",
          opacity: parsing ? 0.6 : 1,
        }}
      >
        <input id="fileInput" type="file" accept=".pdf,.jpg,.png" style={{ display: "none" }} onChange={(e) => onFileUpload(e.target.files[0])} disabled={parsing} />
        {parsing ? (
          <div>
            <div style={{ width: 40, height: 40, borderRadius: "50%", border: "3px solid #E5E7EB", borderTopColor: "#6366F1", margin: "0 auto 12px", animation: "spin 0.8s linear infinite" }} />
            <p style={{ fontWeight: 600, marginBottom: 4 }}>Analysing your document...</p>
            <p style={{ fontSize: 13, color: "#666" }}>Extracting mortgage details...</p>
          </div>
        ) : uploadedFile ? (
          <div>
            <CheckCircle size={36} color="#10B981" style={{ marginBottom: 10 }} />
            <p style={{ fontWeight: 600, marginBottom: 2, fontSize: 15 }}>{uploadedFile.name}</p>
            {parsedData?.isIslamicFinance && (
              <div style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "#FEF3C7", border: "1px solid #FDE68A", borderRadius: 20, padding: "3px 12px", fontSize: 12, color: "#92400E", fontWeight: 500, margin: "8px 0" }}>
                <Info size={12} /> Islamic Finance / Home Purchase Plan detected
              </div>
            )}
            {fieldsExtracted.length > 0 && (
              <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>
                {fieldsExtracted.map((f, i) => (
                  <span key={i} style={{ background: "#DCFCE7", color: "#166534", fontSize: 12, borderRadius: 20, padding: "2px 10px", fontWeight: 500 }}>✓ {f}</span>
                ))}
              </div>
            )}
            <button onClick={(e) => { e.stopPropagation(); setUploadedFile(null); }} style={{ marginTop: 14, background: "none", border: "1px solid #D1D5DB", borderRadius: 8, padding: "6px 16px", cursor: "pointer", fontSize: 13, color: "#666" }}>Remove</button>
          </div>
        ) : (
          <div>
            <Upload size={40} color="#9CA3AF" style={{ marginBottom: 12 }} />
            <p style={{ fontWeight: 600, marginBottom: 4 }}>Drop your mortgage statement here</p>
            <p style={{ fontSize: 13, color: "#666" }}>PDF, JPG, or PNG — we'll extract all the key details automatically</p>
          </div>
        )}
      </div>
      {parseError && (
        <div style={{ marginTop: 12, padding: "12px 16px", background: "#FEE2E2", borderRadius: 10, display: "flex", alignItems: "flex-start", gap: 10 }}>
          <AlertTriangle size={16} color="#DC2626" style={{ flexShrink: 0, marginTop: 2 }} />
          <p style={{ fontSize: 12, color: "#991B1B", lineHeight: 1.5, margin: 0 }}>{parseError}</p>
        </div>
      )}
      {/* Accurate security badges */}
      <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {[
          { icon: <Lock size={14} />, text: "Encrypted in transit (HTTPS/TLS)" },
          { icon: <Shield size={14} />, text: "Not stored — deleted after processing" },
          { icon: <Server size={14} />, text: "Advanced document processing" },
          { icon: <FileText size={14} />, text: "Max 10 MB · PDF only" },
        ].map((b, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "#F9FAFB", borderRadius: 8, border: "1px solid #E5E7EB" }}>
            <span style={{ color: "#6366F1", flexShrink: 0 }}>{b.icon}</span>
            <span style={{ fontSize: 12, color: "#374151" }}>{b.text}</span>
          </div>
        ))}
      </div>
      <p style={{ marginTop: 10, fontSize: 11, color: "#9CA3AF", textAlign: "center" }}>
        By uploading you agree to our{" "}
        <a href="/privacy" style={{ color: "#6366F1" }}>Privacy Policy</a>.
        Your PDF is sent securely to our server and processed securely, then discarded.
      </p>
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
   STATEMENT ADJUSTMENT CARD
   ═══════════════════════════════════════════════════════════════════════════════ */

function StatementAdjustmentCard({ adjustment, adjBalance, setAdjBalance, adjYears, setAdjYears, isIslamicFinance }) {
  const [showEdit, setShowEdit] = useState(false);
  const interestLabel = isIslamicFinance ? "rental charges" : "interest";

  const {
    statementDate, today, months,
    originalBalance, adjustedBalance, adjustedYears,
    interestInGap, principalInGap,
    tooOld, fixedRateLapsed, fixedEndDate,
  } = adjustment;

  return (
    <div style={{ marginBottom: 24 }}>
      {/* Too-old warning */}
      {tooOld && (
        <div style={{ background: "#FEF3C7", border: "1px solid #FCD34D", borderRadius: 12, padding: "12px 16px", marginBottom: 12, display: "flex", gap: 10, alignItems: "flex-start" }}>
          <AlertTriangle size={16} color="#D97706" style={{ flexShrink: 0, marginTop: 2 }} />
          <p style={{ margin: 0, fontSize: 13, color: "#92400E" }}>
            <strong>Your statement is over 2 years old.</strong> For the most accurate results, please upload a more recent statement.
          </p>
        </div>
      )}

      {/* Fixed rate lapsed warning */}
      {fixedRateLapsed && (
        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 12, padding: "12px 16px", marginBottom: 12, display: "flex", gap: 10, alignItems: "flex-start" }}>
          <AlertTriangle size={16} color="#DC2626" style={{ flexShrink: 0, marginTop: 2 }} />
          <p style={{ margin: 0, fontSize: 13, color: "#991B1B" }}>
            <strong>Your fixed rate period ended in {fmtDate(fixedEndDate)}.</strong> Your actual rate may have changed — please check with your lender and update the interest rate field if needed.
          </p>
        </div>
      )}

      {/* Main roll-forward panel */}
      <div style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: 16, padding: 24 }}>
        {/* Header row with dates */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 6px" }}>Figures updated to today</h3>
            <p style={{ margin: 0, fontSize: 13, color: "#6B7280" }}>
              Your statement is from <strong>{fmtDate(statementDate)}</strong>. We've calculated what's changed in the{" "}
              <strong>{months} month{months !== 1 ? "s" : ""}</strong> since then.
            </p>
          </div>
          <div style={{ display: "flex", gap: 16, fontSize: 12, color: "#9CA3AF", flexShrink: 0 }}>
            <span>Statement: <strong style={{ color: "#374151" }}>{fmtDate(statementDate)}</strong></span>
            <span>Analysis: <strong style={{ color: "#374151" }}>{fmtDate(today)}</strong></span>
            <span>Adjusted: <strong style={{ color: "#6366F1" }}>{months}mo</strong></span>
          </div>
        </div>

        {/* Stats grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 20 }} className="grid-cols-4">
          {[
            { label: "Payments made", value: `${months}`, sub: "estimated" },
            { label: "Current balance", value: fmt(adjustedBalance), sub: `was ${fmt(originalBalance)}`, highlight: true },
            { label: "Principal paid", value: fmt(principalInGap), sub: "since statement", color: "#10B981" },
            { label: `${isIslamicFinance ? "Rental charges" : "Interest"} paid`, value: fmt(interestInGap), sub: "since statement", color: "#F59E0B" },
          ].map((s, i) => (
            <div key={i} style={{ padding: "14px 16px", background: s.highlight ? "#EEF2FF" : "#F9FAFB", borderRadius: 10, border: s.highlight ? "1px solid #C7D2FE" : "1px solid #F3F4F6" }}>
              <p style={{ margin: "0 0 4px", fontSize: 11, color: "#9CA3AF", fontWeight: 500, textTransform: "uppercase", letterSpacing: 0.4 }}>{s.label}</p>
              <p style={{ margin: "0 0 2px", fontSize: 18, fontWeight: 700, color: s.color || (s.highlight ? "#4338CA" : "#111") }}>{s.value}</p>
              <p style={{ margin: 0, fontSize: 11, color: "#9CA3AF" }}>{s.sub}</p>
            </div>
          ))}
        </div>

        <p style={{ margin: "0 0 12px", fontSize: 12, color: "#10B981", fontWeight: 500 }}>
          ✓ All analysis below uses estimated figures as of {fmtDate(today)}
        </p>

        {/* Edit override toggle */}
        <button
          onClick={() => setShowEdit((v) => !v)}
          style={{ background: "none", border: "none", cursor: "pointer", color: "#6366F1", fontSize: 13, fontWeight: 500, padding: 0 }}
        >
          {showEdit ? "▲ Hide" : "▼ Edit current figures"} — override if you know the exact numbers
        </button>

        {showEdit && (
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #F3F4F6", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Current balance (£)</label>
              <input
                type="text"
                value={adjBalance}
                onChange={(e) => setAdjBalance(e.target.value)}
                style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid #D1D5DB", fontSize: 14, boxSizing: "border-box", outline: "none" }}
                placeholder={String(adjustedBalance)}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Remaining term (years)</label>
              <input
                type="text"
                value={adjYears}
                onChange={(e) => setAdjYears(e.target.value)}
                style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid #D1D5DB", fontSize: 14, boxSizing: "border-box", outline: "none" }}
                placeholder={String(adjustedYears)}
              />
            </div>
            <p style={{ gridColumn: "1 / -1", margin: 0, fontSize: 12, color: "#9CA3AF" }}>
              Editing these fields instantly updates all charts, scenarios, and recommendations below.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   RESULTS DASHBOARD
   ═══════════════════════════════════════════════════════════════════════════════ */

function ResultsDashboard({ analysis, form, parsedData, adjustment, adjBalance, setAdjBalance, adjYears, setAdjYears, extraPayment, setExtraPayment, targetYears, setTargetYears, onBack }) {
  const { data: session } = useSession();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [saveSaved, setSaveSaved] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailAddress, setEmailAddress] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailError, setEmailError] = useState("");

  const [aiRecs, setAiRecs] = useState(null);
  const [aiLoading, setAiLoading] = useState(true);
  const [lumpSum, setLumpSum] = useState("");
  const [remortgageFee, setRemortgageFee] = useState("");
  const [customRemortgageRate, setCustomRemortgageRate] = useState("");

  const { current, withExtra, targetPayment, targetAmort, rateScenarios, overpaymentScenarios, maxMonthlyOverpayment, maxAnnualOverpayment, balance, tenYears } = analysis;
  const currentYears = (current.totalMonths / 12).toFixed(1);
  const isIslamicFinance = parsedData?.isIslamicFinance || false;
  const interestLabel = isIslamicFinance ? "rental payments" : "interest";

  // Progress through mortgage — use rolled-forward balance for accuracy
  const origLoan = parseFloat(form.originalLoanAmount) || null;
  const pctPaid = origLoan ? Math.max(0, Math.min(100, Math.round((1 - balance / origLoan) * 1000) / 10)) : null;

  // Lump sum calculations
  const lumpSumNum = parseFloat(lumpSum) || 0;
  const lumpSumAnalysis = lumpSumNum > 0 ? (() => {
    const rate = parseFloat(form.interestRate);
    const pmt = parseFloat(form.monthlyPayment);
    const yrs = parseFloat(form.remainingYears);
    const newBalance = Math.max(0, balance - lumpSumNum);
    const withLump = buildAmortization(newBalance, rate, pmt);
    const monthsSaved = current.totalMonths - withLump.totalMonths;
    const interestSaved = current.totalInterest - withLump.totalInterest;
    // Investment comparison: lump sum at 7% annualised for remaining term
    const investYears = yrs;
    const investGrowth = lumpSumNum * Math.pow(1.07, investYears);
    return { monthsSaved, interestSaved, withLump, investGrowth: Math.round(investGrowth), investYears };
  })() : null;

  // Remortgage comparison
  const remortgageScenarios = (() => {
    const rate = parseFloat(form.interestRate);
    const pmt = parseFloat(form.monthlyPayment);
    const yrs = parseFloat(form.remainingYears);
    const fee = parseFloat(remortgageFee) || 0;
    const cuts = [-1.5, -1, -0.5];
    const customR = parseFloat(customRemortgageRate);
    const allCuts = customR && customR > 0 ? [...cuts, -(rate - customR)] : cuts;
    return allCuts.map((cut) => {
      const newRate = Math.max(0.1, rate + cut);
      const newPmt = calcMonthlyPayment(balance, newRate, yrs);
      const monthlySaving = Math.round(pmt - newPmt);
      const amort = buildAmortization(balance, newRate, newPmt);
      const totalInterestSaving = current.totalInterest - amort.totalInterest;
      const breakEvenMonths = monthlySaving > 0 && fee > 0 ? Math.ceil(fee / monthlySaving) : 0;
      return {
        label: cut === -(rate - customR) ? `Custom (${newRate.toFixed(2)}%)` : `${newRate.toFixed(2)}% (${cut > 0 ? "+" : ""}${cut}%)`,
        newRate: newRate.toFixed(2),
        newPmt: Math.round(newPmt),
        monthlySaving,
        annualSaving: monthlySaving * 12,
        totalInterestSaving: Math.round(totalInterestSaving),
        breakEvenMonths,
      };
    });
  })();

  useEffect(() => {
    setAiLoading(true);
    fetch("/api/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        balance: form.outstandingBalance,
        payment: form.monthlyPayment,
        rate: form.interestRate,
        years: form.remainingYears,
        bank: form.bank,
        mortgageType: form.mortgageType,
        rateType: form.rateType,
        fixedUntil: form.fixedUntil,
        earlyRepaymentCharge: form.earlyRepaymentCharge,
        overpaymentAllowance: form.overpaymentAllowance,
        originalLoanAmount: form.originalLoanAmount,
        originalTerm: form.originalTerm,
        isIslamicFinance: parsedData?.isIslamicFinance || false,
        revertingTo: parsedData?.revertingTo || "",
        ercEndDate: parsedData?.ercEndDate || "",
        propertyAddress: parsedData?.propertyAddress || "",
        totalInterest: current.totalInterest,
        maxMonthlyOverpayment,
        maxAnnualOverpayment,
        tenYearsExtra: tenYears.extra,
        tenYearsInterestSaved: tenYears.interestSaved,
        tenYearsWithinLimit: tenYears.withinLimit,
        tenYearsMaxYearsSaved: tenYears.maxYearsSaved,
        tenYearsMaxInterestSaved: tenYears.maxInterestSaved,
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.recommendations && Array.isArray(data.recommendations)) {
          setAiRecs(data.recommendations);
        }
      })
      .catch((err) => console.error("recommendations fetch error:", err))
      .finally(() => setAiLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSaveAnalysis = async () => {
    if (!session?.user?.id) {
      router.push("/auth/signin");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/analyses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `${form.bank || "Mortgage"} Analysis - ${new Date().toLocaleDateString()}`,
          outstandingBalance: form.outstandingBalance,
          monthlyPayment: form.monthlyPayment,
          interestRate: form.interestRate,
          remainingYears: form.remainingYears,
          mortgageType: form.mortgageType,
          rateType: form.rateType,
          bank: form.bank,
          analysisData: analysis,
        }),
      });

      if (!response.ok) throw new Error("Failed to save");
      setSaveSaved(true);
      setTimeout(() => setSaveSaved(false), 3000);
    } catch (error) {
      console.error("Error saving analysis:", error);
      alert("Failed to save analysis. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleSendReport = async (e) => {
    e.preventDefault();
    
    if (!emailAddress.trim()) {
      setEmailError("Please enter an email address");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailAddress)) {
      setEmailError("Please enter a valid email address");
      return;
    }

    setSendingEmail(true);
    setEmailError("");

    try {
      const response = await fetch("/api/send-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientEmail: emailAddress,
          form,
          analysis,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to send email");
      }

      setEmailSent(true);
      setEmailAddress("");
      setTimeout(() => {
        setEmailSent(false);
        setShowEmailModal(false);
      }, 2000);
    } catch (error) {
      console.error("Error sending email:", error);
      setEmailError(error.message || "Failed to send email. Please try again.");
    } finally {
      setSendingEmail(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#F3F4F6", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
      <Header onBack={onBack} />

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 20px" }}>
        <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", color: "#6366F1", fontSize: 14, fontWeight: 500, marginBottom: 24, padding: 0 }}>
          ← Edit mortgage details
        </button>

        <InterestHero
          totalInterest={current.totalInterest}
          balance={balance}
          origLoan={parseFloat(form.originalLoanAmount) || null}
          interestRate={parseFloat(form.interestRate)}
          monthlyPayment={parseFloat(form.monthlyPayment)}
          isIslamicFinance={isIslamicFinance}
        />

        {/* Statement date roll-forward banner */}
        {adjustment && (
          <StatementAdjustmentCard
            adjustment={adjustment}
            adjBalance={adjBalance}
            setAdjBalance={setAdjBalance}
            adjYears={adjYears}
            setAdjYears={setAdjYears}
            isIslamicFinance={parsedData?.isIslamicFinance || false}
          />
        )}

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

        {/* Mortgage Summary Card */}
        <div style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: 16, padding: 28, marginBottom: 24 }}>
          <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 20 }}>Your Mortgage at a Glance</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 20 }} className="grid-cols-4">
            {[
              { label: "Lender", value: form.bank || "—" },
              { label: "Property", value: parsedData?.propertyAddress || "—" },
              {
                label: "Mortgage Type",
                value: (
                  <span style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    {form.mortgageType}
                    {isIslamicFinance && (
                      <span style={{ background: "#FEF3C7", border: "1px solid #FDE68A", borderRadius: 20, padding: "2px 8px", fontSize: 11, color: "#92400E", fontWeight: 600 }}>
                        Islamic Finance
                      </span>
                    )}
                  </span>
                ),
              },
              { label: "Rate Type", value: form.rateType || "—" },
              { label: "Outstanding Balance", value: fmt(balance) },
              { label: "Original Loan", value: form.originalLoanAmount ? fmt(parseFloat(form.originalLoanAmount)) : "—" },
              { label: "Monthly Payment", value: fmt(Math.round(parseFloat(form.monthlyPayment))) },
              { label: "Remaining Term", value: form.remainingYears ? form.remainingYears + " years" : "—" },
              { label: "Current Rate", value: form.interestRate ? form.interestRate + "%" : "—" },
              { label: "Fixed Until", value: form.fixedUntil || "—" },
              { label: "Reverts To", value: parsedData?.revertingTo || "—" },
              {
                label: "ERC",
                value: form.earlyRepaymentCharge
                  ? `${form.earlyRepaymentCharge}% until ${parsedData?.ercEndDate || "end of fixed period"}`
                  : "None",
              },
            ].map((item, i) => (
              <div key={i}>
                <p style={{ fontSize: 12, color: "#9CA3AF", fontWeight: 500, marginBottom: 4, margin: "0 0 4px" }}>{item.label}</p>
                <p style={{ fontSize: 14, fontWeight: 600, color: "#111", margin: 0 }}>{item.value}</p>
              </div>
            ))}
          </div>

          {pctPaid !== null && (
            <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid #F3F4F6" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#111" }}>Mortgage Progress</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#6366F1" }}>{pctPaid}% paid off</span>
              </div>
              <div style={{ height: 12, background: "#EEF2FF", borderRadius: 99, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${pctPaid}%`, background: "linear-gradient(90deg, #6366F1, #10B981)", borderRadius: 99, transition: "width 0.6s ease" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                <span style={{ fontSize: 11, color: "#9CA3AF" }}>{fmt(origLoan - balance)} repaid</span>
                <span style={{ fontSize: 11, color: "#9CA3AF" }}>{fmt(balance)} remaining</span>
              </div>
            </div>
          )}
        </div>

        {/* Pay Off 10 Years Sooner Hero Banner */}
        <div style={{ background: "linear-gradient(135deg, #6366F1, #4338CA)", borderRadius: 16, padding: 28, marginBottom: 24, color: "white" }}>
          <h3 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8, margin: "0 0 8px" }}>
            Pay off your mortgage 10 years sooner
          </h3>
          <p style={{ fontSize: 15, opacity: 0.9, marginBottom: 20, margin: "0 0 20px" }}>
            Pay an extra {fmt(tenYears.extra)}/month → save {fmt(tenYears.interestSaved)} in {isIslamicFinance ? "rental charges" : "interest"}
          </p>
          {tenYears.withinLimit ? (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(16,185,129,0.25)", border: "1px solid rgba(16,185,129,0.4)", borderRadius: 20, padding: "6px 14px", fontSize: 13, fontWeight: 600, marginBottom: 20 }}>
              ✓ Within your penalty-free allowance
            </div>
          ) : (
            <div style={{ background: "rgba(245,158,11,0.2)", border: "1px solid rgba(245,158,11,0.4)", borderRadius: 12, padding: "12px 16px", marginBottom: 20, fontSize: 13, lineHeight: 1.5 }}>
              ⚠ Your overpayment allowance is {fmt(maxMonthlyOverpayment)}/month. At that rate you'd save {tenYears.maxYearsSaved} years and {fmt(tenYears.maxInterestSaved)}
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, maxWidth: 360 }}>
            <div style={{ background: "rgba(255,255,255,0.15)", borderRadius: 12, padding: "16px 20px" }}>
              <p style={{ margin: "0 0 4px", fontSize: 12, opacity: 0.8 }}>Extra per month</p>
              <p style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>{fmt(tenYears.extra)}</p>
            </div>
            <div style={{ background: "rgba(255,255,255,0.15)", borderRadius: 12, padding: "16px 20px" }}>
              <p style={{ margin: "0 0 4px", fontSize: 12, opacity: 0.8 }}>Total saved</p>
              <p style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>{fmt(tenYears.interestSaved)}</p>
            </div>
          </div>
        </div>

        {/* Remortgage Alert */}
        {form.fixedUntil && (
          <div style={{ background: "linear-gradient(135deg, #FEF3C7, #FDE68A)", borderRadius: 16, padding: 24, marginBottom: 24, border: "1px solid #FCD34D" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
              <AlertTriangle size={22} color="#D97706" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <p style={{ fontWeight: 700, color: "#92400E", margin: "0 0 6px", fontSize: 15 }}>
                  Your fixed rate ends {form.fixedUntil}
                </p>
                {parsedData?.revertingTo && (
                  <p style={{ color: "#A16207", margin: "0 0 6px", fontSize: 13 }}>
                    It will revert to {parsedData.revertingTo} — typically 1.5–2% higher than competitive rates.
                  </p>
                )}
                <p style={{ color: "#A16207", margin: "0 0 6px", fontSize: 13 }}>
                  Start comparing deals 3–6 months before your end date to avoid paying more.
                </p>
                {form.earlyRepaymentCharge && (
                  <p style={{ color: "#92400E", margin: 0, fontSize: 13, fontWeight: 500 }}>
                    Note: {form.earlyRepaymentCharge}% ERC applies until {parsedData?.ercEndDate || "end of fixed period"}.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

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

        {/* Lump Sum Impact */}
        <Card title="Lump Sum Payment Impact" subtitle="See how a one-off payment reduces your term — and how it compares to investing">
          <div style={{ display: "flex", gap: 12, alignItems: "flex-end", marginBottom: 16 }}>
            <div style={{ flex: 1 }}>
              <FormField value={lumpSum} onChange={setLumpSum} prefix="£" placeholder="e.g. 10000" label="One-off lump sum amount" />
            </div>
          </div>
          {lumpSumAnalysis ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }} className="grid-cols-2">
              <div style={{ padding: "20px", background: "#ECFDF5", borderRadius: 12, border: "1px solid #A7F3D0" }}>
                <p style={{ fontSize: 12, color: "#065F46", fontWeight: 600, margin: "0 0 12px", textTransform: "uppercase", letterSpacing: 0.5 }}>Pay Down Mortgage</p>
                <p style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 700, color: "#065F46" }}>
                  {lumpSumAnalysis.monthsSaved > 0
                    ? `${Math.floor(lumpSumAnalysis.monthsSaved / 12)}y ${lumpSumAnalysis.monthsSaved % 12}m sooner`
                    : "No term change"}
                </p>
                <p style={{ margin: 0, fontSize: 13, color: "#047857" }}>
                  Saves {fmt(Math.round(lumpSumAnalysis.interestSaved))} in {isIslamicFinance ? "rental charges" : "interest"}
                </p>
                <p style={{ margin: "6px 0 0", fontSize: 12, color: "#6EE7B7" }}>
                  New payoff: {lumpSumAnalysis.withLump.totalMonths > 0 ? `${(lumpSumAnalysis.withLump.totalMonths / 12).toFixed(1)} years` : "Paid off!"}
                </p>
              </div>
              <div style={{ padding: "20px", background: "#EEF2FF", borderRadius: 12, border: "1px solid #C7D2FE" }}>
                <p style={{ fontSize: 12, color: "#312E81", fontWeight: 600, margin: "0 0 12px", textTransform: "uppercase", letterSpacing: 0.5 }}>Invest Instead (7% p.a.)</p>
                <p style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 700, color: "#312E81" }}>
                  {fmt(lumpSumAnalysis.investGrowth)}
                </p>
                <p style={{ margin: 0, fontSize: 13, color: "#4338CA" }}>
                  After {lumpSumAnalysis.investYears} years at 7% annual return
                </p>
                <p style={{ margin: "6px 0 0", fontSize: 12, color: "#818CF8" }}>
                  Gain: {fmt(lumpSumAnalysis.investGrowth - lumpSumNum)} vs {fmt(Math.round(lumpSumAnalysis.interestSaved))} saved
                </p>
              </div>
            </div>
          ) : (
            <p style={{ fontSize: 13, color: "#9CA3AF", margin: 0 }}>Enter an amount above to see the impact.</p>
          )}
        </Card>

        {/* Remortgage Comparison */}
        <Card title="Remortgage Comparison" subtitle="How much could you save by switching to a better rate?">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }} className="grid-cols-2">
            <FormField value={customRemortgageRate} onChange={setCustomRemortgageRate} suffix="%" placeholder="e.g. 3.5" label="Custom new rate" />
            <FormField value={remortgageFee} onChange={setRemortgageFee} prefix="£" placeholder="e.g. 1500" label="Remortgage fee (for break-even)" />
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #E5E7EB" }}>
                  {["New Rate", "Monthly Payment", "Monthly Saving", "Annual Saving", "Total Interest Saving", "Break-even"].map((h) => (
                    <th key={h} style={{ textAlign: "left", padding: "10px 12px", color: "#666", fontWeight: 500, fontSize: 12 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {remortgageScenarios.map((s, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #F3F4F6", background: i % 2 === 0 ? "white" : "#FAFAFA" }}>
                    <td style={{ padding: 12, fontWeight: 600 }}>{s.label}</td>
                    <td style={{ padding: 12 }}>{fmt(s.newPmt)}/mo</td>
                    <td style={{ padding: 12, color: "#10B981", fontWeight: 600 }}>
                      {s.monthlySaving > 0 ? `${fmt(s.monthlySaving)}/mo` : <span style={{ color: "#EF4444" }}>{fmt(Math.abs(s.monthlySaving))} more</span>}
                    </td>
                    <td style={{ padding: 12, color: "#10B981", fontWeight: 600 }}>{s.annualSaving > 0 ? fmt(s.annualSaving) : "—"}</td>
                    <td style={{ padding: 12, color: "#6366F1", fontWeight: 600 }}>{fmt(s.totalInterestSaving)}</td>
                    <td style={{ padding: 12, fontSize: 13, color: "#666" }}>
                      {s.breakEvenMonths > 0 ? `${s.breakEvenMonths} months` : parseFloat(remortgageFee) > 0 ? "Instant" : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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

        {/* Risk Assessment */}
        <Card title="Risk Assessment" subtitle="How vulnerable is your mortgage to changes?">
          {(() => {
            const rate = parseFloat(form.interestRate);
            const years = parseFloat(form.remainingYears);
            const payment = parseFloat(form.monthlyPayment);
            const risePayment = Math.round(calcMonthlyPayment(balance, rate + 2, years));
            const riseDiff = risePayment - Math.round(payment);
            const affordRatio = (payment / 3500 * 100).toFixed(0);
            const affordColor = affordRatio < 30 ? "#10B981" : affordRatio <= 40 ? "#F59E0B" : "#EF4444";
            const riseColor = riseDiff > 200 ? "#EF4444" : "#F59E0B";
            return (
              <div style={{ display: "grid", gap: 16 }}>
                <div style={{ padding: "16px 20px", background: "#FEF2F2", borderRadius: 12, borderLeft: `4px solid ${riseColor}` }}>
                  <p style={{ fontWeight: 600, margin: "0 0 4px", color: "#111", fontSize: 14 }}>Rate Rise Vulnerability</p>
                  <p style={{ margin: 0, fontSize: 13, color: "#444" }}>
                    If rates rose 2%, your monthly payment would increase by{" "}
                    <span style={{ fontWeight: 700, color: riseColor }}>{fmt(riseDiff)}</span>
                    {" "}(to {fmt(risePayment)}/month).
                  </p>
                </div>
                <div style={{ padding: "16px 20px", background: "#F9FAFB", borderRadius: 12, borderLeft: `4px solid ${affordColor}` }}>
                  <p style={{ fontWeight: 600, margin: "0 0 4px", color: "#111", fontSize: 14 }}>Affordability Ratio</p>
                  <p style={{ margin: 0, fontSize: 13, color: "#444" }}>
                    Your mortgage payment is{" "}
                    <span style={{ fontWeight: 700, color: affordColor }}>{affordRatio}%</span>
                    {" "}of average UK household monthly income (£3,500).
                    {affordRatio < 30 ? " This is within a comfortable range." : affordRatio <= 40 ? " This is on the higher side — worth monitoring." : " This is above the recommended 40% threshold."}
                  </p>
                </div>
                <div style={{ padding: "16px 20px", background: "#ECFDF5", borderRadius: 12, borderLeft: "4px solid #10B981" }}>
                  <p style={{ fontWeight: 600, margin: "0 0 4px", color: "#111", fontSize: 14 }}>Overpayment Impact</p>
                  <p style={{ margin: 0, fontSize: 13, color: "#444" }}>
                    Paying the maximum {fmt(maxMonthlyOverpayment)}/month extra would clear your mortgage{" "}
                    <span style={{ fontWeight: 700, color: "#10B981" }}>{tenYears.maxYearsSaved} years</span>{" "}
                    early, saving <span style={{ fontWeight: 700, color: "#10B981" }}>{fmt(tenYears.maxInterestSaved)}</span>.
                  </p>
                </div>
              </div>
            );
          })()}
        </Card>

        {/* Recommendations */}
        <div style={{ background: "linear-gradient(135deg, #6366F1, #4F46E5)", borderRadius: 16, padding: 28, marginBottom: 24, color: "white" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
            <h3 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Your Personalised Recommendations</h3>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button
                onClick={() => window.print()}
                className="no-print"
                style={{
                  padding: "8px 16px",
                  background: "rgba(255,255,255,0.2)",
                  color: "white",
                  border: "1px solid rgba(255,255,255,0.3)",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                🖨 Print Report
              </button>
              <button
                onClick={() => setShowEmailModal(true)}
                style={{
                  padding: "8px 16px",
                  background: "rgba(255,255,255,0.2)",
                  color: "white",
                  border: "1px solid rgba(255,255,255,0.3)",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  opacity: 1,
                  transition: "all 0.2s",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
                onMouseEnter={(e) => (e.target.style.background = "rgba(255,255,255,0.3)")}
                onMouseLeave={(e) => (e.target.style.background = "rgba(255,255,255,0.2)")}
              >
                <Mail size={14} /> Email Report
              </button>
              {session?.user && (
                <button
                  onClick={handleSaveAnalysis}
                  disabled={saving}
                  style={{
                    padding: "8px 16px",
                    background: "rgba(255,255,255,0.2)",
                    color: "white",
                    border: "1px solid rgba(255,255,255,0.3)",
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: saving ? "not-allowed" : "pointer",
                    opacity: saving ? 0.7 : 1,
                    transition: "all 0.2s",
                  }}
                >
                  {saving ? "Saving..." : saveSaved ? "✓ Saved" : "Save Analysis"}
                </button>
              )}
            </div>
          </div>
          <div style={{ display: "grid", gap: 12 }}>
            {aiLoading ? (
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 0", opacity: 0.85 }}>
                <div style={{ width: 22, height: 22, borderRadius: "50%", border: "3px solid rgba(255,255,255,0.3)", borderTopColor: "white", animation: "spin 0.8s linear infinite", flexShrink: 0 }} />
                <p style={{ margin: 0, fontSize: 14 }}>Generating your personalised report...</p>
              </div>
            ) : (aiRecs || generateRecommendations(analysis, form)).map((rec, i) => (
              <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 14 }}>{i + 1}</div>
                <p style={{ margin: 0, lineHeight: 1.6, fontSize: 14, opacity: 0.95 }}>{rec}</p>
              </div>
            ))}
          </div>
          {!session?.user && (
            <div style={{ marginTop: 16, padding: "12px 16px", background: "rgba(255,255,255,0.1)", borderRadius: 10, fontSize: 13, lineHeight: 1.5 }}>
              <a href="/auth/signin" style={{ color: "white", fontWeight: 600, textDecoration: "none" }}>
                Sign in
              </a>
              {" "}to save your analysis and access it later
            </div>
          )}
        </div>

        {/* Email Modal */}
        {showEmailModal && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: "20px" }}>
            <div style={{ background: "white", borderRadius: 16, padding: 32, maxWidth: 420, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Email Your Report</h2>
              <p style={{ fontSize: 14, color: "#666", marginBottom: 20 }}>Get your mortgage analysis sent to your email inbox</p>

              {emailSent ? (
                <div style={{ textAlign: "center", padding: "20px 0" }}>
                  <CheckCircle size={48} color="#10B981" style={{ marginBottom: 16 }} />
                  <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Email sent!</h3>
                  <p style={{ color: "#666", fontSize: 14 }}>Check your inbox for your mortgage analysis report.</p>
                </div>
              ) : (
                <form onSubmit={handleSendReport}>
                  {emailError && (
                    <div style={{ padding: "12px 16px", background: "#FEE2E2", border: "1px solid #FECACA", borderRadius: 10, marginBottom: 16, color: "#991B1B", fontSize: 13 }}>
                      {emailError}
                    </div>
                  )}
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 8 }}>
                      Email address
                    </label>
                    <div style={{ position: "relative" }}>
                      <Mail size={18} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#9CA3AF", pointerEvents: "none" }} />
                      <input
                        type="email"
                        value={emailAddress}
                        onChange={(e) => {
                          setEmailAddress(e.target.value);
                          setEmailError("");
                        }}
                        placeholder="you@example.com"
                        disabled={sendingEmail}
                        style={{
                          width: "100%",
                          padding: "10px 14px 10px 40px",
                          borderRadius: 10,
                          border: "1px solid #D1D5DB",
                          fontSize: 14,
                          outline: "none",
                          boxSizing: "border-box",
                          opacity: sendingEmail ? 0.6 : 1,
                        }}
                      />
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => setShowEmailModal(false)}
                      disabled={sendingEmail}
                      style={{
                        flex: 1,
                        padding: "10px 16px",
                        background: "white",
                        color: "#111",
                        border: "1px solid #D1D5DB",
                        borderRadius: 10,
                        fontSize: 14,
                        fontWeight: 600,
                        cursor: sendingEmail ? "not-allowed" : "pointer",
                        opacity: sendingEmail ? 0.6 : 1,
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={sendingEmail}
                      style={{
                        flex: 1,
                        padding: "10px 16px",
                        background: "linear-gradient(135deg, #6366F1, #4F46E5)",
                        color: "white",
                        border: "none",
                        borderRadius: 10,
                        fontSize: 14,
                        fontWeight: 600,
                        cursor: sendingEmail ? "not-allowed" : "pointer",
                        opacity: sendingEmail ? 0.7 : 1,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                      }}
                    >
                      {sendingEmail ? <Loader size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Mail size={14} />}
                      {sendingEmail ? "Sending..." : "Send Report"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

        {/* Disclaimer */}
        <div style={{ padding: "16px 20px", background: "#F9FAFB", borderRadius: 12, border: "1px solid #E5E7EB", marginBottom: 40 }}>
          <p style={{ margin: 0, fontSize: 12, color: "#999", lineHeight: 1.6 }}>
            <strong>Disclaimer:</strong> Mortgage AI Calc provides estimates for informational purposes only. Actual figures may vary based on your lender's specific terms, fees, and calculation methods. This does not constitute financial advice. Always consult a qualified mortgage adviser before making changes to your mortgage.
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
  const { current, overpaymentScenarios } = analysis;
  const rate = parseFloat(form.interestRate);
  const isIslamic = form.bank === "Gatehouse Bank" || false;
  const interestWord = isIslamic ? "rental charges" : "interest";
  const productWord = isIslamic ? "Home Purchase Plan" : "mortgage";

  if (overpaymentScenarios.length > 0) {
    const best = overpaymentScenarios.filter((s) => s.withinLimit).pop();
    if (best) {
      recs.push(
        `Maximise your overpayment allowance: paying an extra ${best.extra}/month would save you £${best.saved.toLocaleString()} in ${interestWord} and cut ${best.yearsSaved} years off your ${productWord} — all within your penalty-free allowance.`
      );
    }
  }

  if (form.rateType === "Fixed" && form.fixedUntil) {
    recs.push(
      `Your fixed rate ends ${form.fixedUntil}. Start shopping for deals 3-6 months before to avoid falling onto your lender's revert rate, which is typically 1.5-2% higher.`
    );
  } else if (form.rateType.includes("SVR")) {
    recs.push(
      `You're on your lender's Standard Variable Rate — almost always higher than what's available. You could save hundreds per month by switching to a competitive fixed or tracker rate.`
    );
  }

  if (rate >= 5) {
    recs.push(
      `At ${rate}%, your rate is on the higher end. You'd pay £${current.totalInterest.toLocaleString()} in ${interestWord} alone. Even reducing by 0.5% through a product transfer could save tens of thousands.`
    );
  }

  if (form.bank) {
    recs.push(
      `Check with ${form.bank} about loyalty rates or product transfers — sometimes your existing lender offers competitive deals without full remortgage fees.`
    );
  }

  if (isIslamic) {
    recs.push(
      `As a Gatehouse Bank Home Purchase Plan holder, you can make lump sum overpayments directly to reduce your acquisition balance. Contact Gatehouse to confirm your current overpayment allowance and process.`
    );
  } else {
    recs.push(
      `Consider an offset mortgage if you have significant savings. Rather than earning taxable interest, offsetting against your balance reduces the interest you pay — effectively earning your mortgage rate tax-free.`
    );
  }

  recs.push(
    `If you receive a bonus or windfall, even a one-off £5,000 overpayment now could save over £${Math.round(5000 * rate / 100 * parseFloat(form.remainingYears) * 0.4).toLocaleString()} in ${interestWord} over your remaining term.`
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
