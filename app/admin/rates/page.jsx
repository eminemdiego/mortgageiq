"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Save, Loader, AlertTriangle } from "lucide-react";

const ADMIN_EMAIL = "ahmed.sarwar@hotmail.co.uk";
const RATE_FIELDS = [
  { key: "fixed_2yr", label: "2yr Fixed" },
  { key: "fixed_5yr", label: "5yr Fixed" },
  { key: "svr", label: "SVR / Variable" },
];

function daysSince(dateStr) {
  if (!dateStr) return 999;
  return Math.round((new Date() - new Date(dateStr)) / 86400000);
}

export default function AdminRates() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const [banks, setBanks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);
  const [editValues, setEditValues] = useState({});

  useEffect(() => {
    if (authStatus === "loading") return;
    if (!session?.user?.email || session.user.email !== ADMIN_EMAIL) router.push("/");
  }, [session, authStatus, router]);

  useEffect(() => {
    if (session?.user?.email === ADMIN_EMAIL) fetchRates();
  }, [session]);

  const fetchRates = async () => {
    try {
      const r = await fetch("/api/rates");
      const data = await r.json();
      setBanks(Array.isArray(data) ? data : []);
      const vals = {};
      (Array.isArray(data) ? data : []).forEach(b => {
        vals[b.id] = { fixed_2yr: b.fixed_2yr || "", fixed_5yr: b.fixed_5yr || "", svr: b.svr || "" };
      });
      setEditValues(vals);
    } catch {} finally { setLoading(false); }
  };

  const handleSave = async (bank) => {
    setSaving(bank.id);
    try {
      await fetch("/api/rates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: bank.id, ...editValues[bank.id] }),
      });
      await fetchRates();
    } catch {} finally { setSaving(null); }
  };

  if (authStatus === "loading" || loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#FAFBFC" }}>
        <Loader size={28} color="#6366F1" style={{ animation: "spin 1s linear infinite" }} />
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#FAFBFC", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 20px" }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 4 }}>Bank Rates</h1>
        <p style={{ fontSize: 14, color: "#6B7280", marginBottom: 32 }}>Manage indicative mortgage rates shown in the payment calculator.</p>

        <div style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: 14, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#F9FAFB", borderBottom: "1px solid #E5E7EB" }}>
                <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, color: "#6B7280", textTransform: "uppercase", fontWeight: 600 }}>Bank</th>
                {RATE_FIELDS.map(f => (
                  <th key={f.key} style={{ padding: "12px 12px", textAlign: "center", fontSize: 11, color: "#6B7280", textTransform: "uppercase", fontWeight: 600 }}>{f.label}</th>
                ))}
                <th style={{ padding: "12px 12px", textAlign: "center", fontSize: 11, color: "#6B7280", textTransform: "uppercase", fontWeight: 600 }}>Updated</th>
                <th style={{ padding: "12px 12px", width: 60 }}></th>
              </tr>
            </thead>
            <tbody>
              {banks.map((bank, i) => {
                const days = daysSince(bank.updated_at);
                const stale = days > 14;
                return (
                  <tr key={bank.id} style={{ borderBottom: i < banks.length - 1 ? "1px solid #F3F4F6" : "none" }}>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{ fontWeight: 600, color: "#111" }}>{bank.bank_name}</span>
                      {bank.is_islamic && <span style={{ marginLeft: 6, fontSize: 10, background: "#FEF3C7", color: "#92400E", padding: "1px 6px", borderRadius: 4, fontWeight: 600 }}>Islamic</span>}
                    </td>
                    {RATE_FIELDS.map(f => (
                      <td key={f.key} style={{ padding: "8px 8px", textAlign: "center" }}>
                        <input
                          type="number"
                          step="0.01"
                          value={editValues[bank.id]?.[f.key] ?? ""}
                          onChange={(e) => setEditValues(v => ({ ...v, [bank.id]: { ...v[bank.id], [f.key]: e.target.value } }))}
                          style={{ width: 70, padding: "6px 8px", border: "1px solid #D1D5DB", borderRadius: 6, fontSize: 13, textAlign: "center", outline: "none" }}
                          placeholder="—"
                        />
                      </td>
                    ))}
                    <td style={{ padding: "8px 12px", textAlign: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                        {stale && <AlertTriangle size={12} color="#F59E0B" />}
                        <span style={{ fontSize: 11, color: stale ? "#F59E0B" : "#9CA3AF" }}>
                          {days === 0 ? "Today" : `${days}d ago`}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: "8px 12px", textAlign: "center" }}>
                      <button
                        onClick={() => handleSave(bank)}
                        disabled={saving === bank.id}
                        style={{ padding: "6px 10px", background: "#EEF2FF", color: "#6366F1", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4 }}
                      >
                        {saving === bank.id ? <Loader size={11} style={{ animation: "spin 1s linear infinite" }} /> : <Save size={11} />}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
