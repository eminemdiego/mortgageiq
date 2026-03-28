"use client";

import { useState, useEffect, useMemo } from "react";
import { Calculator, ChevronDown, ChevronUp, Info } from "lucide-react";

const fmt = (n) => "£" + Number(n || 0).toLocaleString("en-GB", { maximumFractionDigits: 0 });

function calcMonthly(principal, annualRate, years) {
  const r = annualRate / 100 / 12;
  const n = years * 12;
  if (r === 0) return principal / n;
  return (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

function buildSchedule(principal, annualRate, monthlyPmt, extraMonthly = 0) {
  const r = annualRate / 100 / 12;
  let balance = principal;
  const years = [];
  let month = 0, totalInterest = 0, yearInterest = 0, yearCapital = 0;

  while (balance > 0.01 && month < 600) {
    month++;
    const interest = balance * r;
    const total = monthlyPmt + extraMonthly;
    const capital = Math.min(balance, total - interest);
    if (capital <= 0) break;
    balance = Math.max(0, balance - capital);
    totalInterest += interest;
    yearInterest += interest;
    yearCapital += capital;

    if (month % 12 === 0 || balance <= 0.01) {
      years.push({ year: Math.ceil(month / 12), payment: Math.round((monthlyPmt + extraMonthly) * (month % 12 === 0 ? 12 : month % 12)), interest: Math.round(yearInterest), capital: Math.round(yearCapital), balance: Math.round(balance) });
      yearInterest = 0;
      yearCapital = 0;
    }
  }
  return { years, totalMonths: month, totalInterest: Math.round(totalInterest) };
}

function calcStampDuty(price, firstTime, additional) {
  if (price <= 0) return 0;
  let duty = 0;
  if (firstTime && price <= 625000) {
    // First-time buyer relief: 0% up to £425k, 5% on £425k-£625k
    if (price > 425000) duty = (price - 425000) * 0.05;
  } else {
    // Standard rates
    if (price > 250000) duty += Math.min(price - 250000, 675000) * 0.05;
    if (price > 925000) duty += Math.min(price - 925000, 575000) * 0.10;
    if (price > 1500000) duty += (price - 1500000) * 0.12;
  }
  if (additional) duty += price * 0.05; // 5% surcharge on additional properties
  return Math.round(duty);
}

const BANKS = [
  { name: "Barclays", islamic: false },
  { name: "HSBC", islamic: false },
  { name: "NatWest", islamic: false },
  { name: "Santander", islamic: false },
  { name: "Nationwide", islamic: false },
  { name: "Halifax", islamic: false },
  { name: "Lloyds", islamic: false },
  { name: "Virgin Money", islamic: false },
  { name: "TSB", islamic: false },
  { name: "Skipton BS", islamic: false },
  { name: "Leeds BS", islamic: false },
  { name: "Yorkshire BS", islamic: false },
  { name: "Gatehouse Bank", islamic: true },
  { name: "Al Rayan Bank", islamic: true },
  { name: "Wayhome", islamic: true },
  { name: "Stride Up", islamic: true },
];

const PAGE = { minHeight: "100vh", background: "#FAFBFC", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" };
const CARD = { background: "white", border: "1px solid #E5E7EB", borderRadius: 16, padding: 28 };
const INPUT = { width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid #D1D5DB", fontSize: 14, outline: "none", boxSizing: "border-box" };
const LABEL = { fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 };

export default function MortgageCalculator() {
  const [price, setPrice] = useState("");
  const [depositPct, setDepositPct] = useState("10");
  const [depositAmt, setDepositAmt] = useState("");
  const [term, setTerm] = useState(25);
  const [rate, setRate] = useState("5.5");
  const [mortgageType, setMortgageType] = useState("repayment");
  const [isIslamic, setIsIslamic] = useState(false);
  const [selectedBank, setSelectedBank] = useState("");
  const [rateTerm, setRateTerm] = useState("5yr");
  const [firstTimeBuyer, setFirstTimeBuyer] = useState(false);
  const [additionalProperty, setAdditionalProperty] = useState(false);
  const [overpayment, setOverpayment] = useState(0);
  const [showSchedule, setShowSchedule] = useState(false);
  const [calculated, setCalculated] = useState(false);
  const [bankRates, setBankRates] = useState([]);
  const [ratesDate, setRatesDate] = useState(null);

  // Fetch bank rates
  useEffect(() => {
    fetch("/api/rates")
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setBankRates(data);
          const latest = data.reduce((d, b) => b.updated_at > d ? b.updated_at : d, "");
          if (latest) setRatesDate(new Date(latest));
        }
      })
      .catch(() => {});
  }, []);

  // Linked deposit fields
  const handlePriceChange = (v) => {
    setPrice(v);
    if (depositPct && v) setDepositAmt(String(Math.round(parseFloat(v) * parseFloat(depositPct) / 100)));
  };
  const handleDepositPctChange = (v) => {
    setDepositPct(v);
    if (v && price) setDepositAmt(String(Math.round(parseFloat(price) * parseFloat(v) / 100)));
  };
  const handleDepositAmtChange = (v) => {
    setDepositAmt(v);
    if (v && price) setDepositPct(String(Math.round((parseFloat(v) / parseFloat(price)) * 10000) / 100));
  };

  // Bank selection → auto-fill rate
  const handleBankChange = (bankName) => {
    setSelectedBank(bankName);
    if (!bankName) return;
    const bank = BANKS.find(b => b.name === bankName);
    if (bank?.islamic) setIsIslamic(true);
    const dbBank = bankRates.find(b => b.bank_name === bankName);
    if (dbBank) {
      const rateKey = rateTerm === "2yr" ? "fixed_2yr" : rateTerm === "5yr" ? "fixed_5yr" : "svr";
      if (dbBank[rateKey]) setRate(String(dbBank[rateKey]));
    }
  };

  useEffect(() => {
    if (!selectedBank) return;
    const dbBank = bankRates.find(b => b.bank_name === selectedBank);
    if (dbBank) {
      const rateKey = rateTerm === "2yr" ? "fixed_2yr" : rateTerm === "5yr" ? "fixed_5yr" : "svr";
      if (dbBank[rateKey]) setRate(String(dbBank[rateKey]));
    }
  }, [rateTerm, selectedBank, bankRates]);

  const interestLabel = isIslamic ? "rental cost" : "interest";
  const rateLabel = isIslamic ? "Rental Rate" : "Interest Rate";

  // Calculations
  const results = useMemo(() => {
    if (!calculated) return null;
    const p = parseFloat(price) || 0;
    const dep = parseFloat(depositAmt) || 0;
    const loan = p - dep;
    const r = parseFloat(rate) || 0;
    if (loan <= 0 || r <= 0) return null;

    const monthly = mortgageType === "repayment"
      ? calcMonthly(loan, r, term)
      : (loan * r / 100) / 12;

    const totalRepayable = mortgageType === "repayment"
      ? monthly * term * 12
      : (monthly * term * 12) + loan;

    const totalInterest = totalRepayable - loan;

    // Stress test: +3%
    const stressMonthly = mortgageType === "repayment"
      ? calcMonthly(loan, r + 3, term)
      : (loan * (r + 3) / 100) / 12;

    // Schedule
    const schedule = mortgageType === "repayment"
      ? buildSchedule(loan, r, monthly)
      : { years: [], totalMonths: term * 12, totalInterest: Math.round(totalInterest) };

    // Overpayment
    let overpayResult = null;
    if (overpayment > 0 && mortgageType === "repayment") {
      const ov = buildSchedule(loan, r, monthly, overpayment);
      overpayResult = {
        monthsSaved: schedule.totalMonths - ov.totalMonths,
        interestSaved: schedule.totalInterest - ov.totalInterest,
        newTotalMonths: ov.totalMonths,
      };
    }

    const stampDuty = calcStampDuty(p, firstTimeBuyer, additionalProperty);

    return { loan, monthly: Math.round(monthly), totalRepayable: Math.round(totalRepayable), totalInterest: Math.round(totalInterest), stressMonthly: Math.round(stressMonthly), schedule, overpayResult, stampDuty };
  }, [calculated, price, depositAmt, rate, term, mortgageType, overpayment, firstTimeBuyer, additionalProperty]);

  return (
    <div style={PAGE}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 20px 80px" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
            <Calculator size={32} color="#6366F1" /> Mortgage Payment Calculator
          </h1>
          <p style={{ fontSize: 15, color: "#6B7280", maxWidth: 500, margin: "0 auto" }}>
            Estimate your monthly payments, total {interestLabel}, stamp duty, and overpayment savings.
          </p>
          {ratesDate && (
            <p style={{ fontSize: 11, color: "#9CA3AF", marginTop: 8 }}>
              Bank rates last updated: {ratesDate.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
            </p>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: results ? "1fr 1fr" : "1fr", gap: 24 }} className="grid-cols-2">
          {/* ── INPUTS ── */}
          <div>
            <div style={{ ...CARD, marginBottom: 20 }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 20 }}>Mortgage Details</h2>

              <div style={{ marginBottom: 16 }}>
                <label style={LABEL}>Property Price (£) *</label>
                <input style={INPUT} type="text" value={price} onChange={(e) => handlePriceChange(e.target.value)} placeholder="350,000" />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={LABEL}>Deposit (%)</label>
                  <input style={INPUT} type="number" step="1" value={depositPct} onChange={(e) => handleDepositPctChange(e.target.value)} />
                </div>
                <div>
                  <label style={LABEL}>Deposit (£)</label>
                  <input style={INPUT} type="text" value={depositAmt} onChange={(e) => handleDepositAmtChange(e.target.value)} placeholder="35,000" />
                </div>
              </div>

              {price && depositAmt && (
                <div style={{ marginBottom: 16, padding: "10px 14px", background: "#F0FDF4", borderRadius: 8, fontSize: 13, color: "#065F46" }}>
                  Loan amount: <strong>{fmt(parseFloat(price) - parseFloat(depositAmt))}</strong>
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={LABEL}>Term (years)</label>
                  <select style={INPUT} value={term} onChange={(e) => setTerm(parseInt(e.target.value))}>
                    {Array.from({ length: 36 }, (_, i) => i + 5).map(y => (
                      <option key={y} value={y}>{y} years</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={LABEL}>{rateLabel} (%) *</label>
                  <input style={INPUT} type="number" step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="5.5" />
                </div>
              </div>

              {/* Bank selector */}
              <div style={{ marginBottom: 16 }}>
                <label style={LABEL}>Select a lender (optional)</label>
                <select style={INPUT} value={selectedBank} onChange={(e) => handleBankChange(e.target.value)}>
                  <option value="">— Enter rate manually —</option>
                  <optgroup label="Major Lenders">
                    {BANKS.filter(b => !b.islamic).map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
                  </optgroup>
                  <optgroup label="Islamic Finance">
                    {BANKS.filter(b => b.islamic).map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
                  </optgroup>
                </select>
              </div>

              {selectedBank && (
                <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
                  {["2yr", "5yr", "svr"].map(t => (
                    <button key={t} onClick={() => setRateTerm(t)} style={{ flex: 1, padding: "7px 0", border: "none", borderRadius: 8, fontSize: 12, fontWeight: rateTerm === t ? 600 : 400, background: rateTerm === t ? "#EEF2FF" : "#F9FAFB", color: rateTerm === t ? "#4F46E5" : "#6B7280", cursor: "pointer" }}>
                      {t === "svr" ? "SVR" : t === "2yr" ? "2-Year Fix" : "5-Year Fix"}
                    </button>
                  ))}
                </div>
              )}

              {selectedBank && (
                <p style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 16, fontStyle: "italic" }}>
                  Indicative rate only — always confirm directly with the lender.
                </p>
              )}

              {/* Toggles */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={LABEL}>Mortgage Type</label>
                  <div style={{ display: "flex", gap: 2, background: "#F3F4F6", borderRadius: 8, padding: 2 }}>
                    {[{ k: "repayment", l: "Repayment" }, { k: "interestOnly", l: "Interest Only" }].map(o => (
                      <button key={o.k} onClick={() => setMortgageType(o.k)} style={{ flex: 1, padding: "8px 0", border: "none", borderRadius: 6, fontSize: 12, fontWeight: mortgageType === o.k ? 600 : 400, background: mortgageType === o.k ? "white" : "transparent", color: mortgageType === o.k ? "#111" : "#6B7280", cursor: "pointer", boxShadow: mortgageType === o.k ? "0 1px 3px rgba(0,0,0,0.1)" : "none" }}>{o.l}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={LABEL}>Financing Type</label>
                  <div style={{ display: "flex", gap: 2, background: "#F3F4F6", borderRadius: 8, padding: 2 }}>
                    {[{ k: false, l: "Conventional" }, { k: true, l: "Islamic" }].map(o => (
                      <button key={String(o.k)} onClick={() => setIsIslamic(o.k)} style={{ flex: 1, padding: "8px 0", border: "none", borderRadius: 6, fontSize: 12, fontWeight: isIslamic === o.k ? 600 : 400, background: isIslamic === o.k ? "white" : "transparent", color: isIslamic === o.k ? "#111" : "#6B7280", cursor: "pointer", boxShadow: isIslamic === o.k ? "0 1px 3px rgba(0,0,0,0.1)" : "none" }}>{o.l}</button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Stamp duty options */}
              <div style={{ display: "flex", gap: 20, marginBottom: 20 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
                  <input type="checkbox" checked={firstTimeBuyer} onChange={(e) => { setFirstTimeBuyer(e.target.checked); if (e.target.checked) setAdditionalProperty(false); }} style={{ width: 15, height: 15 }} />
                  First-time buyer
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
                  <input type="checkbox" checked={additionalProperty} onChange={(e) => { setAdditionalProperty(e.target.checked); if (e.target.checked) setFirstTimeBuyer(false); }} style={{ width: 15, height: 15 }} />
                  Additional property
                </label>
              </div>

              <button
                onClick={() => setCalculated(true)}
                disabled={!price || !rate}
                style={{ width: "100%", padding: "14px 0", background: !price || !rate ? "#D1D5DB" : "linear-gradient(135deg, #6366F1, #4F46E5)", color: "white", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 600, cursor: !price || !rate ? "not-allowed" : "pointer" }}
              >
                Calculate
              </button>
            </div>
          </div>

          {/* ── RESULTS ── */}
          {results && (
            <div>
              {/* Monthly payment hero */}
              <div style={{ ...CARD, marginBottom: 20, textAlign: "center", background: "linear-gradient(135deg, #F5F3FF, #EEF2FF)", border: "1px solid #C7D2FE" }}>
                <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 6 }}>Your estimated monthly payment</p>
                <p style={{ fontSize: 48, fontWeight: 800, color: "#4338CA", margin: "0 0 8px", lineHeight: 1 }}>{fmt(results.monthly)}</p>
                <p style={{ fontSize: 13, color: "#6B7280" }}>per month for {term} years</p>
              </div>

              {/* Summary cards */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
                <div style={{ ...CARD, padding: 18 }}>
                  <p style={{ fontSize: 11, color: "#6B7280", marginBottom: 3 }}>Loan Amount</p>
                  <p style={{ fontSize: 20, fontWeight: 700 }}>{fmt(results.loan)}</p>
                </div>
                <div style={{ ...CARD, padding: 18 }}>
                  <p style={{ fontSize: 11, color: "#6B7280", marginBottom: 3 }}>Total {isIslamic ? "Rental Cost" : "Interest"}</p>
                  <p style={{ fontSize: 20, fontWeight: 700, color: "#EF4444" }}>{fmt(results.totalInterest)}</p>
                </div>
                <div style={{ ...CARD, padding: 18 }}>
                  <p style={{ fontSize: 11, color: "#6B7280", marginBottom: 3 }}>Total Repayable</p>
                  <p style={{ fontSize: 20, fontWeight: 700 }}>{fmt(results.totalRepayable)}</p>
                </div>
                <div style={{ ...CARD, padding: 18 }}>
                  <p style={{ fontSize: 11, color: "#6B7280", marginBottom: 3 }}>Stamp Duty</p>
                  <p style={{ fontSize: 20, fontWeight: 700, color: results.stampDuty > 0 ? "#F59E0B" : "#10B981" }}>
                    {results.stampDuty > 0 ? fmt(results.stampDuty) : "£0"}
                  </p>
                  <p style={{ fontSize: 10, color: "#9CA3AF", marginTop: 2 }}>
                    {firstTimeBuyer ? "First-time buyer relief applied" : additionalProperty ? "Includes 5% surcharge" : "Standard rate"}
                  </p>
                </div>
              </div>

              {/* Stress test */}
              <div style={{ ...CARD, marginBottom: 20, padding: 20, background: "#FEF3C7", border: "1px solid #FDE68A" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <Info size={16} color="#92400E" />
                  <p style={{ fontSize: 13, fontWeight: 600, color: "#92400E", margin: 0 }}>Affordability stress test</p>
                </div>
                <p style={{ fontSize: 13, color: "#78716C", margin: 0 }}>
                  If your {isIslamic ? "rental rate" : "rate"} increased by 3% to {(parseFloat(rate) + 3).toFixed(1)}%, your payment would be <strong>{fmt(results.stressMonthly)}/mo</strong> — {fmt(results.stressMonthly - results.monthly)} more per month.
                </p>
              </div>

              {/* Overpayment */}
              {mortgageType === "repayment" && (
                <div style={{ ...CARD, marginBottom: 20 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Overpayment Savings</h3>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                    <span style={{ fontSize: 13, color: "#6B7280", whiteSpace: "nowrap" }}>Extra £/mo:</span>
                    <input type="range" min={0} max={1000} step={50} value={overpayment} onChange={(e) => setOverpayment(parseInt(e.target.value))} style={{ flex: 1 }} />
                    <span style={{ fontSize: 14, fontWeight: 700, color: "#6366F1", minWidth: 50 }}>{fmt(overpayment)}</span>
                  </div>
                  {results.overpayResult && overpayment > 0 && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                      <div style={{ padding: "12px 14px", background: "#ECFDF5", borderRadius: 10, textAlign: "center" }}>
                        <p style={{ fontSize: 11, color: "#065F46", marginBottom: 2 }}>{isIslamic ? "Rental" : "Interest"} Saved</p>
                        <p style={{ fontSize: 18, fontWeight: 700, color: "#10B981" }}>{fmt(results.overpayResult.interestSaved)}</p>
                      </div>
                      <div style={{ padding: "12px 14px", background: "#EEF2FF", borderRadius: 10, textAlign: "center" }}>
                        <p style={{ fontSize: 11, color: "#4338CA", marginBottom: 2 }}>Months Saved</p>
                        <p style={{ fontSize: 18, fontWeight: 700, color: "#6366F1" }}>{results.overpayResult.monthsSaved}</p>
                      </div>
                      <div style={{ padding: "12px 14px", background: "#F8FAFC", borderRadius: 10, textAlign: "center" }}>
                        <p style={{ fontSize: 11, color: "#6B7280", marginBottom: 2 }}>Paid Off In</p>
                        <p style={{ fontSize: 18, fontWeight: 700 }}>{(results.overpayResult.newTotalMonths / 12).toFixed(1)} yrs</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Amortisation schedule */}
              {mortgageType === "repayment" && results.schedule.years.length > 0 && (
                <div style={{ ...CARD, padding: 0, overflow: "hidden" }}>
                  <button
                    onClick={() => setShowSchedule(!showSchedule)}
                    style={{ width: "100%", padding: "18px 24px", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 14, fontWeight: 600, color: "#374151" }}
                  >
                    <span>Amortisation Schedule</span>
                    {showSchedule ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </button>
                  {showSchedule && (
                    <div style={{ borderTop: "1px solid #F3F4F6", overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                        <thead>
                          <tr style={{ background: "#F9FAFB" }}>
                            {["Year", "Payment", isIslamic ? "Rental" : "Interest", "Capital", "Balance"].map(h => (
                              <th key={h} style={{ padding: "10px 14px", textAlign: "right", fontSize: 10, color: "#6B7280", textTransform: "uppercase", fontWeight: 600 }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {results.schedule.years.map((yr, i) => (
                            <tr key={yr.year} style={{ borderBottom: i < results.schedule.years.length - 1 ? "1px solid #F3F4F6" : "none" }}>
                              <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 600 }}>{yr.year}</td>
                              <td style={{ padding: "10px 14px", textAlign: "right" }}>{fmt(yr.payment)}</td>
                              <td style={{ padding: "10px 14px", textAlign: "right", color: "#EF4444" }}>{fmt(yr.interest)}</td>
                              <td style={{ padding: "10px 14px", textAlign: "right", color: "#10B981" }}>{fmt(yr.capital)}</td>
                              <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 600 }}>{fmt(yr.balance)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
