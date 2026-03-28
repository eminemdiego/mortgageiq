"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Upload, CheckCircle, Building2, Key, Briefcase, AlertCircle } from "lucide-react";

const PAGE = { minHeight: "100vh", background: "#FAFBFC", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" };
const CARD = { background: "white", border: "1px solid #E5E7EB", borderRadius: 16, padding: 28, marginBottom: 20 };
const INPUT = { width: "100%", padding: "10px 14px", border: "1px solid #D1D5DB", borderRadius: 10, fontSize: 14, outline: "none", boxSizing: "border-box" };
const LABEL = { fontSize: 12, fontWeight: 500, color: "#6B7280", display: "block", marginBottom: 5 };
const GRID2 = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 };

const INITIAL_FORM = {
  address: "", estimated_value: "",
  outstanding_balance: "", interest_rate: "", monthly_payment: "", remaining_years: "", lender: "",
  monthly_rent: "", tenant_name: "", tenancy_start: "", tenancy_end: "",
  agent_name: "", management_fee_pct: "",
  deposit_amount: "",
};

function PulsingDots() {
  return (
    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            width: 5, height: 5, borderRadius: "50%", background: "#6366F1",
            animation: `dotBounce 1.2s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

const UPLOAD_MESSAGES = {
  mortgage: [
    [0,  "Reading document..."],
    [5,  "Extracting mortgage details..."],
    [20, "Analysing statement — almost there..."],
    [40, "Large document, still working..."],
  ],
  tenancy: [
    [0,  "Reading tenancy agreement..."],
    [5,  "Extracting tenancy details..."],
    [20, "Almost there..."],
  ],
  agent: [
    [0,  "Reading agent agreement..."],
    [5,  "Extracting fee details..."],
  ],
};

function uploadMsg(type, elapsed) {
  const steps = UPLOAD_MESSAGES[type] || UPLOAD_MESSAGES.mortgage;
  let msg = steps[0][1];
  for (const [t, m] of steps) {
    if (elapsed >= t) msg = m;
  }
  return msg;
}

const DOC_CONFIGS = [
  {
    type: "mortgage",
    label: "Mortgage Statement",
    subtitle: "Extracts: balance, rate, payment, lender, term",
    icon: Building2,
    required: true,
    fields: [
      { key: "lender", label: "Lender" },
      { key: "outstanding_balance", label: "Balance", prefix: "£" },
      { key: "interest_rate", label: "Rate", suffix: "%" },
      { key: "monthly_payment", label: "Payment", prefix: "£" },
      { key: "remaining_years", label: "Years remaining" },
    ],
  },
  {
    type: "tenancy",
    label: "Tenancy Agreement (AST)",
    subtitle: "Extracts: rent, tenant name, tenancy dates, deposit",
    icon: Key,
    required: true,
    fields: [
      { key: "monthly_rent", label: "Monthly rent", prefix: "£" },
      { key: "tenant_name", label: "Tenant" },
      { key: "tenancy_end", label: "End date" },
      { key: "deposit_amount", label: "Deposit", prefix: "£" },
    ],
  },
  {
    type: "agent",
    label: "Estate Agent Agreement",
    subtitle: "Extracts: agent name, management fee",
    icon: Briefcase,
    required: false,
    fields: [
      { key: "agent_name", label: "Agent" },
      { key: "management_fee_pct", label: "Fee (exc. VAT)", suffix: "%" },
    ],
  },
];

function UploadSlot({ config, docState, onFile, agentManual, setAgentManual }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const { type, label, subtitle, icon: Icon, required, fields } = config;
  const { status, data, error } = docState;
  const isDone = status === "done";
  const isUploading = status === "uploading";
  const isError = status === "error";

  useEffect(() => {
    if (!isUploading) { setElapsed(0); return; }
    const interval = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [isUploading]);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) onFile(type, file);
  };

  const borderColor = isDone ? "#10B981" : dragging ? "#6366F1" : isError ? "#EF4444" : "#D1D5DB";
  const bg = isDone ? "#F0FDF4" : dragging ? "#F5F3FF" : "white";

  return (
    <div
      style={{ border: `2px dashed ${borderColor}`, borderRadius: 14, padding: 20, background: bg, transition: "all 0.2s" }}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
        <div style={{ width: 42, height: 42, borderRadius: 11, background: isDone ? "#ECFDF5" : "#EEF2FF", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: isDone ? "#10B981" : "#6366F1" }}>
          <Icon size={20} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>{label}</span>
            {!required && <span style={{ fontSize: 11, color: "#9CA3AF", background: "#F3F4F6", padding: "1px 7px", borderRadius: 4 }}>Optional</span>}
            {isDone && <CheckCircle size={14} color="#10B981" />}
          </div>
          <p style={{ fontSize: 12, color: "#6B7280", margin: 0 }}>{subtitle}</p>
        </div>
        <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 8 }}>
          {(status === "idle" || isError) && (
            <button
              onClick={() => inputRef.current?.click()}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", background: isError ? "#FEE2E2" : "#EEF2FF", color: isError ? "#EF4444" : "#6366F1", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}
            >
              <Upload size={13} /> {isError ? "Retry" : "Upload"}
            </button>
          )}
          {isDone && (
            <button
              onClick={() => inputRef.current?.click()}
              style={{ padding: "6px 12px", background: "none", color: "#6B7280", border: "1px solid #E5E7EB", borderRadius: 7, fontSize: 11, cursor: "pointer" }}
            >
              Replace
            </button>
          )}
        </div>
      </div>

      {/* Upload progress */}
      {isUploading && (
        <div style={{ marginTop: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <PulsingDots />
            <span style={{ fontSize: 12, color: "#6366F1", fontWeight: 500 }}>{uploadMsg(type, elapsed)}</span>
          </div>
          {elapsed >= 8 && (
            <p style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 8 }}>
              This may take up to 30 seconds for larger documents
            </p>
          )}
          {/* Indeterminate progress bar */}
          <div style={{ height: 3, background: "#E0E7FF", borderRadius: 99, overflow: "hidden", position: "relative" }}>
            <div style={{
              position: "absolute", top: 0, height: "100%", width: "45%",
              background: "linear-gradient(90deg, transparent, #6366F1, transparent)",
              animation: "slideProgress 1.4s ease-in-out infinite",
              borderRadius: 99,
            }} />
          </div>
        </div>
      )}

      {/* Extracted fields */}
      {isDone && data && Object.keys(data).length > 0 && (
        <div style={{ marginTop: 14, display: "flex", flexWrap: "wrap", gap: 6 }}>
          {fields.map(({ key, label: fl, prefix = "", suffix = "" }) =>
            data[key] != null ? (
              <span key={key} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, background: "#ECFDF5", color: "#065F46", padding: "3px 10px", borderRadius: 20 }}>
                <CheckCircle size={11} color="#10B981" />
                {fl}: {prefix}{typeof data[key] === "number" ? data[key].toLocaleString("en-GB") : data[key]}{suffix}
              </span>
            ) : null
          )}
        </div>
      )}

      {/* Error message */}
      {isError && error && (
        <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#EF4444" }}>
          <AlertCircle size={12} /> {error}
        </div>
      )}

      {/* Agent manual fallback */}
      {type === "agent" && status === "idle" && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px dashed #E5E7EB" }}>
          <p style={{ fontSize: 12, color: "#6B7280", marginBottom: 10 }}>No document? Just tell us:</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={LABEL}>Agent name</label>
              <input
                style={{ ...INPUT, fontSize: 13, padding: "8px 12px" }}
                value={agentManual.agent_name}
                onChange={(e) => setAgentManual((p) => ({ ...p, agent_name: e.target.value }))}
                placeholder="e.g. Foxtons"
              />
            </div>
            <div>
              <label style={LABEL}>Estate agent fee % (exc. VAT)</label>
              <input
                style={{ ...INPUT, fontSize: 13, padding: "8px 12px" }}
                type="number"
                step="0.5"
                value={agentManual.management_fee_pct}
                onChange={(e) => setAgentManual((p) => ({ ...p, management_fee_pct: e.target.value }))}
                placeholder="e.g. 10"
              />
            </div>
          </div>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(type, f); e.target.value = ""; }}
        style={{ display: "none" }}
      />
    </div>
  );
}

function SummaryField({ label, value, onChange, type = "text", placeholder = "" }) {
  const hasValue = value !== "" && value != null;
  return (
    <div>
      <label style={{ ...LABEL, display: "flex", alignItems: "center", gap: 5 }}>
        {label}
        {hasValue && <CheckCircle size={11} color="#10B981" />}
      </label>
      <input
        style={{ ...INPUT, borderColor: hasValue ? "#A7F3D0" : "#D1D5DB", background: hasValue ? "#F0FDF4" : "white" }}
        type={type}
        step={type === "number" ? "any" : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

export default function AddProperty() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [step, setStep] = useState("method"); // "method" | "upload" | "manual"
  const [docs, setDocs] = useState({
    mortgage: { status: "idle", data: {} },
    tenancy: { status: "idle", data: {} },
    agent: { status: "idle", data: {} },
  });
  const [agentManual, setAgentManual] = useState({ agent_name: "", management_fee_pct: "" });
  const [form, setForm] = useState({ ...INITIAL_FORM });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") router.push("/auth/signin");
  }, [status, router]);

  const setField = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const handleFile = useCallback(async (docType, file) => {
    setDocs((prev) => ({ ...prev, [docType]: { status: "uploading", data: {}, error: null } }));
    const fd = new FormData();
    fd.append("file", file);
    fd.append("type", docType);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    try {
      const res = await fetch("/api/portfolio-parse", { method: "POST", body: fd, signal: controller.signal });
      clearTimeout(timeoutId);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Extraction failed");
      setDocs((prev) => ({ ...prev, [docType]: { status: "done", data: json } }));
      setForm((prev) => {
        const merged = { ...prev };
        Object.entries(json).forEach(([k, v]) => {
          if (v != null && v !== "" && (prev[k] === "" || prev[k] == null)) {
            merged[k] = String(v);
          }
        });
        return merged;
      });
    } catch (err) {
      clearTimeout(timeoutId);
      const msg = err.name === "AbortError"
        ? "Timed out after 60 seconds — please try again."
        : err.message;
      setDocs((prev) => ({ ...prev, [docType]: { status: "error", data: {}, error: msg } }));
    }
  }, []);

  const anyDocDone = Object.values(docs).some((d) => d.status === "done");

  const handleSubmit = async () => {
    const payload = { ...form };

    // For upload flow, merge agent manual if no doc uploaded
    if (step === "upload" && docs.agent.status !== "done") {
      if (agentManual.agent_name) payload.agent_name = agentManual.agent_name;
      if (agentManual.management_fee_pct) payload.management_fee_pct = agentManual.management_fee_pct;
    }

    if (!payload.address?.trim()) { setError("Property address is required."); return; }
    if (!payload.monthly_rent) { setError("Monthly rent is required."); return; }

    // Package extra tenancy fields into JSONB (no matching DB columns)
    const extraTenancyKeys = ["break_clause_date", "break_clause_notice_months", "deposit_scheme", "pet_clause", "notice_period_months", "permitted_occupants"];
    const tenancyExtras = {};
    extraTenancyKeys.forEach((k) => {
      if (payload[k] != null && payload[k] !== "") {
        tenancyExtras[k] = payload[k];
        delete payload[k];
      }
    });
    if (Object.keys(tenancyExtras).length > 0) payload.tenancy_extras = tenancyExtras;

    setError("");
    setSaving(true);
    try {
      const numericFields = ["estimated_value", "outstanding_balance", "interest_rate", "monthly_payment", "remaining_years", "monthly_rent", "deposit_amount", "management_fee_pct"];
      numericFields.forEach((f) => {
        if (payload[f] !== "" && payload[f] != null) payload[f] = parseFloat(payload[f]) || 0;
        else payload[f] = undefined;
      });

      const res = await fetch("/api/portfolio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error || "Failed to save."); return; }
      const data = await res.json();
      router.push(`/portfolio/${data.id}`);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (status === "loading") {
    return (
      <div style={{ ...PAGE, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 40, height: 40, borderRadius: "50%", border: "3px solid #E5E7EB", borderTopColor: "#6366F1", animation: "spin 0.8s linear infinite" }} />
      </div>
    );
  }

  return (
    <div style={PAGE}>
      {/* Header */}
      <div style={{ borderBottom: "1px solid #E5E7EB", background: "white", padding: "16px 24px" }}>
        <div style={{ maxWidth: 680, margin: "0 auto" }}>
          <button
            onClick={() => step === "method" ? router.push("/portfolio") : setStep("method")}
            style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, color: "#6366F1", fontSize: 14, fontWeight: 500 }}
          >
            <ArrowLeft size={16} /> {step === "method" ? "Portfolio" : "Back"}
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 680, margin: "0 auto", padding: "40px 20px 60px" }}>
        {/* Title */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 6 }}>Add Property</h1>
          {step === "method" && <p style={{ color: "#6B7280", fontSize: 14 }}>How would you like to add your property?</p>}
        </div>

        {/* ───── STEP: METHOD SELECTION ───── */}
        {step === "method" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {/* Upload Card */}
            <button
              onClick={() => setStep("upload")}
              style={{ background: "white", border: "2px solid #6366F1", borderRadius: 16, padding: 28, cursor: "pointer", textAlign: "left", position: "relative", overflow: "hidden" }}
            >
              <div style={{ position: "absolute", top: 10, right: 12, fontSize: 11, fontWeight: 700, color: "#6366F1", background: "#EEF2FF", padding: "3px 9px", borderRadius: 20 }}>
                RECOMMENDED
              </div>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: "linear-gradient(135deg, #6366F1, #4F46E5)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16, color: "white" }}>
                <Upload size={22} />
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: "#111" }}>Upload Documents</h3>
              <p style={{ fontSize: 13, color: "#6B7280", lineHeight: 1.5, margin: 0 }}>
                Upload your documents and we&apos;ll extract everything automatically
              </p>
            </button>

            {/* Manual Card */}
            <button
              onClick={() => setStep("manual")}
              style={{ background: "white", border: "2px solid #E5E7EB", borderRadius: 16, padding: 28, cursor: "pointer", textAlign: "left" }}
            >
              <div style={{ width: 48, height: 48, borderRadius: 14, background: "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16, color: "#374151" }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: "#111" }}>Enter Manually</h3>
              <p style={{ fontSize: 13, color: "#6B7280", lineHeight: 1.5, margin: 0 }}>
                Fill in your property details by hand
              </p>
            </button>
          </div>
        )}

        {/* ───── STEP: UPLOAD FLOW ───── */}
        {step === "upload" && (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
              {DOC_CONFIGS.map((config) => (
                <UploadSlot
                  key={config.type}
                  config={config}
                  docState={docs[config.type]}
                  onFile={handleFile}
                  agentManual={agentManual}
                  setAgentManual={setAgentManual}
                />
              ))}
            </div>

            {/* Summary card — appears after any extraction */}
            {anyDocDone && (
              <div style={CARD}>
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Extracted Details</h3>
                <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 24 }}>
                  Review and correct anything if needed.
                </p>

                {/* Property */}
                <div style={{ marginBottom: 20 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>Property</p>
                  <div style={GRID2}>
                    <SummaryField label="Address *" value={form.address} onChange={(v) => setField("address", v)} placeholder="14 Victoria Road, Manchester" />
                    <SummaryField label="Estimated value (£)" value={form.estimated_value} onChange={(v) => setField("estimated_value", v)} type="number" placeholder="250000" />
                  </div>
                </div>

                {/* Mortgage */}
                {docs.mortgage.status === "done" && (
                  <div style={{ marginBottom: 20 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>Mortgage</p>
                    <div style={GRID2}>
                      <SummaryField label="Outstanding balance (£)" value={form.outstanding_balance} onChange={(v) => setField("outstanding_balance", v)} type="number" />
                      <SummaryField label="Interest rate (%)" value={form.interest_rate} onChange={(v) => setField("interest_rate", v)} type="number" />
                      <SummaryField label="Monthly payment (£)" value={form.monthly_payment} onChange={(v) => setField("monthly_payment", v)} type="number" />
                      <SummaryField label="Remaining term (years)" value={form.remaining_years} onChange={(v) => setField("remaining_years", v)} type="number" />
                      <SummaryField label="Lender" value={form.lender} onChange={(v) => setField("lender", v)} placeholder="e.g. Barclays" />
                    </div>
                  </div>
                )}

                {/* Tenancy */}
                {docs.tenancy.status === "done" && (
                  <div style={{ marginBottom: 20 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>Tenancy</p>
                    <div style={GRID2}>
                      <SummaryField label="Monthly rent (£) *" value={form.monthly_rent} onChange={(v) => setField("monthly_rent", v)} type="number" />
                      <SummaryField label="Tenant name" value={form.tenant_name} onChange={(v) => setField("tenant_name", v)} placeholder="John Smith" />
                      <SummaryField label="Tenancy end date" value={form.tenancy_end} onChange={(v) => setField("tenancy_end", v)} type="date" />
                      <SummaryField label="Deposit (£)" value={form.deposit_amount} onChange={(v) => setField("deposit_amount", v)} type="number" />
                    </div>
                  </div>
                )}

                {/* Agent */}
                <div style={{ marginBottom: 24 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>Agent</p>
                  <div style={GRID2}>
                    <SummaryField label="Agent name" value={form.agent_name} onChange={(v) => setField("agent_name", v)} placeholder="e.g. Foxtons" />
                    <SummaryField label="Estate agent fee (%) (exc. VAT)" value={form.management_fee_pct} onChange={(v) => setField("management_fee_pct", v)} type="number" placeholder="10" />
                  </div>
                </div>

                {error && (
                  <div style={{ padding: "10px 14px", background: "#FEE2E2", border: "1px solid #FECACA", borderRadius: 8, color: "#991B1B", fontSize: 13, marginBottom: 16 }}>
                    {error}
                  </div>
                )}

                <button
                  onClick={handleSubmit}
                  disabled={saving || !form.address || !form.monthly_rent}
                  style={{ width: "100%", padding: "14px 0", background: (saving || !form.address || !form.monthly_rent) ? "#A5B4FC" : "linear-gradient(135deg, #6366F1, #4F46E5)", color: "white", border: "none", borderRadius: 12, fontSize: 16, fontWeight: 600, cursor: (saving || !form.address || !form.monthly_rent) ? "not-allowed" : "pointer" }}
                >
                  {saving ? "Saving..." : "Add to Portfolio"}
                </button>
              </div>
            )}

            {/* Hint when no docs uploaded yet */}
            {!anyDocDone && (
              <div style={{ textAlign: "center", padding: "20px 0", color: "#9CA3AF", fontSize: 13 }}>
                Upload your documents above to get started
              </div>
            )}
          </>
        )}

        {/* ───── STEP: MANUAL FLOW ───── */}
        {step === "manual" && (
          <div style={CARD}>
            {error && (
              <div style={{ padding: "10px 14px", background: "#FEE2E2", border: "1px solid #FECACA", borderRadius: 8, color: "#991B1B", fontSize: 13, marginBottom: 20 }}>
                {error}
              </div>
            )}

            {/* Property */}
            <div style={{ marginBottom: 24 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.05em" }}>Property</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <label style={LABEL}>Property address *</label>
                  <input style={INPUT} value={form.address} onChange={(e) => setField("address", e.target.value)} placeholder="14 Victoria Road, Manchester, M14 5BT" />
                </div>
                <div>
                  <label style={LABEL}>Estimated current value (£)</label>
                  <input style={INPUT} type="number" value={form.estimated_value} onChange={(e) => setField("estimated_value", e.target.value)} placeholder="250000" />
                </div>
              </div>
            </div>

            {/* Mortgage */}
            <div style={{ marginBottom: 24 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.05em" }}>Mortgage</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={GRID2}>
                  <div>
                    <label style={LABEL}>Outstanding balance (£)</label>
                    <input style={INPUT} type="number" value={form.outstanding_balance} onChange={(e) => setField("outstanding_balance", e.target.value)} placeholder="150000" />
                  </div>
                  <div>
                    <label style={LABEL}>Interest rate (%)</label>
                    <input style={INPUT} type="number" step="0.01" value={form.interest_rate} onChange={(e) => setField("interest_rate", e.target.value)} placeholder="4.5" />
                  </div>
                </div>
                <div style={GRID2}>
                  <div>
                    <label style={LABEL}>Monthly payment (£)</label>
                    <input style={INPUT} type="number" value={form.monthly_payment} onChange={(e) => setField("monthly_payment", e.target.value)} placeholder="800" />
                  </div>
                  <div>
                    <label style={LABEL}>Remaining term (years)</label>
                    <input style={INPUT} type="number" step="0.5" value={form.remaining_years} onChange={(e) => setField("remaining_years", e.target.value)} placeholder="22" />
                  </div>
                </div>
              </div>
            </div>

            {/* Tenancy */}
            <div style={{ marginBottom: 24 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.05em" }}>Tenancy</p>
              <div style={GRID2}>
                <div>
                  <label style={LABEL}>Monthly rent (£) *</label>
                  <input style={INPUT} type="number" value={form.monthly_rent} onChange={(e) => setField("monthly_rent", e.target.value)} placeholder="1200" />
                </div>
                <div>
                  <label style={LABEL}>Tenancy end date</label>
                  <input style={INPUT} type="date" value={form.tenancy_end} onChange={(e) => setField("tenancy_end", e.target.value)} />
                </div>
              </div>
            </div>

            {/* Agent */}
            <div style={{ marginBottom: 28 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.05em" }}>Agent</p>
              <div style={GRID2}>
                <div>
                  <label style={LABEL}>Agent name</label>
                  <input style={INPUT} value={form.agent_name} onChange={(e) => setField("agent_name", e.target.value)} placeholder="Your Letting Agency" />
                </div>
                <div>
                  <label style={LABEL}>Estate agent fee (%) (exc. VAT)</label>
                  <input style={INPUT} type="number" step="0.5" value={form.management_fee_pct} onChange={(e) => setField("management_fee_pct", e.target.value)} placeholder="10" />
                </div>
              </div>
            </div>

            <button
              onClick={handleSubmit}
              disabled={saving}
              style={{ width: "100%", padding: "14px 0", background: saving ? "#A5B4FC" : "linear-gradient(135deg, #6366F1, #4F46E5)", color: "white", border: "none", borderRadius: 12, fontSize: 16, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer" }}
            >
              {saving ? "Saving..." : "Add to Portfolio"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
