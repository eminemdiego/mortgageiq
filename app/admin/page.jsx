"use client";

import { useEffect, useState, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Users, ArrowLeft, ArrowUpDown, ArrowUp, ArrowDown,
  Download, Building2, TrendingDown, Mail, RefreshCw,
} from "lucide-react";

const ADMIN_EMAIL = "ahmed.sarwar@hotmail.co.uk";

const PAGE = {
  minHeight: "100vh",
  background: "#0F172A",
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  color: "#F1F5F9",
};

function fmt(n) {
  return Number(n || 0).toLocaleString("en-GB");
}

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function fmtDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) +
    " " + d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function SortIcon({ field, sortKey, sortDir }) {
  if (sortKey !== field) return <ArrowUpDown size={13} style={{ opacity: 0.4 }} />;
  return sortDir === "asc" ? <ArrowUp size={13} /> : <ArrowDown size={13} />;
}

export default function AdminDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sortKey, setSortKey] = useState("created_at");
  const [sortDir, setSortDir] = useState("desc");
  const [search, setSearch] = useState("");

  // Lender rates state
  const [lenderRates, setLenderRates] = useState([]);
  const [lenderLoading, setLenderLoading] = useState(false);
  const [editingRate, setEditingRate] = useState(null);
  const [editSvr, setEditSvr] = useState("");
  const [showRates, setShowRates] = useState(false);

  // Gate: redirect non-admins immediately
  useEffect(() => {
    if (status === "loading") return;
    if (status === "unauthenticated" || session?.user?.email !== ADMIN_EMAIL) {
      router.replace("/");
    }
  }, [status, session, router]);

  useEffect(() => {
    if (session?.user?.email === ADMIN_EMAIL) {
      fetchUsers();
      fetchLenderRates();
    }
  }, [session]);

  const fetchLenderRates = async () => {
    setLenderLoading(true);
    try {
      const res = await fetch("/api/lender-rates?all=true");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setLenderRates(data.lenders || []);
    } catch (err) {
      console.error("Failed to fetch lender rates:", err);
    } finally {
      setLenderLoading(false);
    }
  };

  const seedLenderRates = async () => {
    try {
      await fetch("/api/lender-rates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ seed: true }) });
      fetchLenderRates();
    } catch (err) {
      console.error("Seed failed:", err);
    }
  };

  const saveRate = async (id) => {
    const val = parseFloat(editSvr);
    if (!val || val <= 0) return;
    try {
      await fetch("/api/lender-rates", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, svr_rate: val }) });
      setEditingRate(null);
      setEditSvr("");
      fetchLenderRates();
    } catch (err) {
      console.error("Save rate failed:", err);
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/users");
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      setUsers(await res.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const sorted = useMemo(() => {
    const filtered = search.trim()
      ? users.filter((u) => u.email.toLowerCase().includes(search.toLowerCase()) || u.name?.toLowerCase().includes(search.toLowerCase()))
      : users;

    return [...filtered].sort((a, b) => {
      let av = a[sortKey], bv = b[sortKey];
      if (sortKey === "created_at" || sortKey === "last_login") {
        av = av ? new Date(av).getTime() : 0;
        bv = bv ? new Date(bv).getTime() : 0;
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [users, sortKey, sortDir, search]);

  const exportCSV = () => {
    const header = ["Email", "Name", "Provider", "Sign-up Date", "Last Login", "Properties", "Analyses"];
    const rows = sorted.map((u) => [
      u.email,
      u.name || "",
      u.auth_provider,
      fmtDate(u.created_at),
      fmtDate(u.last_login),
      u.property_count,
      u.analysis_count,
    ]);
    const csv = [header, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mortgageiq-users-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (status === "loading" || (status === "authenticated" && session?.user?.email !== ADMIN_EMAIL)) {
    return (
      <div style={{ ...PAGE, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 40, height: 40, borderRadius: "50%", border: "3px solid #334155", borderTopColor: "#6366F1", animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const totalProperties = users.reduce((s, u) => s + u.property_count, 0);
  const totalAnalyses = users.reduce((s, u) => s + u.analysis_count, 0);
  const activeUsers = users.filter((u) => u.last_login).length;

  const Th = ({ field, children }) => (
    <th
      onClick={() => handleSort(field)}
      style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, fontSize: 12, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em", cursor: "pointer", whiteSpace: "nowrap", userSelect: "none", borderBottom: "1px solid #1E293B" }}
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
        {children} <SortIcon field={field} sortKey={sortKey} sortDir={sortDir} />
      </span>
    </th>
  );

  return (
    <div style={PAGE}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .row-hover:hover { background: #1E293B !important; }
      `}</style>

      {/* Header */}
      <div style={{ borderBottom: "1px solid #1E293B", background: "#0F172A", padding: "16px 28px", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 1300, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <button onClick={() => router.push("/")} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748B", display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
              <ArrowLeft size={15} /> Back to site
            </button>
            <div style={{ width: 1, height: 20, background: "#1E293B" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg, #6366F1, #4F46E5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Users size={16} color="white" />
              </div>
              <span style={{ fontWeight: 700, fontSize: 16 }}>Admin Dashboard</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={fetchUsers} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", background: "#1E293B", color: "#94A3B8", border: "1px solid #334155", borderRadius: 8, fontSize: 13, cursor: "pointer" }}>
              <RefreshCw size={13} /> Refresh
            </button>
            <button onClick={exportCSV} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", background: "#10B981", color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              <Download size={13} /> Export CSV
            </button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1300, margin: "0 auto", padding: "32px 28px" }}>

        {/* Stats bar */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 32 }}>
          {[
            { label: "Total Users", value: fmt(users.length), icon: <Users size={18} />, color: "#6366F1" },
            { label: "Active (logged in)", value: fmt(activeUsers), icon: <Mail size={18} />, color: "#10B981" },
            { label: "Total Properties", value: fmt(totalProperties), icon: <Building2 size={18} />, color: "#F59E0B" },
            { label: "Total Analyses", value: fmt(totalAnalyses), icon: <TrendingDown size={18} />, color: "#EC4899" },
          ].map((s, i) => (
            <div key={i} style={{ background: "#1E293B", border: "1px solid #334155", borderRadius: 14, padding: "20px 22px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: s.color + "20", display: "flex", alignItems: "center", justifyContent: "center", color: s.color }}>
                  {s.icon}
                </div>
                <span style={{ fontSize: 12, color: "#64748B", fontWeight: 500 }}>{s.label}</span>
              </div>
              <p style={{ fontSize: 28, fontWeight: 700, color: "#F1F5F9" }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Search */}
        <div style={{ marginBottom: 20 }}>
          <input
            type="text"
            placeholder="Search by email or name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 320, padding: "10px 14px", background: "#1E293B", border: "1px solid #334155", borderRadius: 10, fontSize: 14, color: "#F1F5F9", outline: "none", boxSizing: "border-box" }}
          />
          {search && sorted.length !== users.length && (
            <span style={{ marginLeft: 12, fontSize: 13, color: "#64748B" }}>{sorted.length} result{sorted.length !== 1 ? "s" : ""}</span>
          )}
        </div>

        {/* Error */}
        {error && (
          <div style={{ background: "#450A0A", border: "1px solid #7F1D1D", borderRadius: 10, padding: "12px 16px", marginBottom: 20, color: "#FCA5A5", fontSize: 14 }}>
            {error}
          </div>
        )}

        {/* Table */}
        <div style={{ background: "#1E293B", border: "1px solid #334155", borderRadius: 16, overflow: "hidden" }}>
          {loading ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "60px 20px", gap: 12 }}>
              <div style={{ width: 24, height: 24, borderRadius: "50%", border: "2px solid #334155", borderTopColor: "#6366F1", animation: "spin 0.8s linear infinite" }} />
              <span style={{ color: "#64748B", fontSize: 14 }}>Loading users...</span>
            </div>
          ) : sorted.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 20px", color: "#64748B" }}>
              {search ? "No users match your search." : "No users found."}
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#0F172A" }}>
                    <Th field="email">Email</Th>
                    <Th field="name">Name</Th>
                    <Th field="auth_provider">Provider</Th>
                    <Th field="created_at">Signed up</Th>
                    <Th field="last_login">Last login</Th>
                    <Th field="property_count">Properties</Th>
                    <Th field="analysis_count">Analyses</Th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((u, i) => (
                    <tr key={u.id} className="row-hover" style={{ background: i % 2 === 0 ? "#1E293B" : "#162032", transition: "background 0.15s" }}>
                      <td style={{ padding: "13px 16px", fontSize: 14, color: "#E2E8F0", fontWeight: 500 }}>
                        {u.email}
                      </td>
                      <td style={{ padding: "13px 16px", fontSize: 14, color: "#94A3B8" }}>
                        {u.name || <span style={{ color: "#475569" }}>—</span>}
                      </td>
                      <td style={{ padding: "13px 16px" }}>
                        <span style={{
                          padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600,
                          background: u.auth_provider === "google" ? "#1e3a5f" : "#1a1a2e",
                          color: u.auth_provider === "google" ? "#60A5FA" : "#A78BFA",
                        }}>
                          {u.auth_provider === "google" ? "Google" : "Email"}
                        </span>
                      </td>
                      <td style={{ padding: "13px 16px", fontSize: 13, color: "#94A3B8", whiteSpace: "nowrap" }}>
                        {fmtDate(u.created_at)}
                      </td>
                      <td style={{ padding: "13px 16px", fontSize: 13, color: u.last_login ? "#94A3B8" : "#475569", whiteSpace: "nowrap" }}>
                        {u.last_login ? fmtDateTime(u.last_login) : "Never recorded"}
                      </td>
                      <td style={{ padding: "13px 16px", textAlign: "center" }}>
                        {u.property_count > 0 ? (
                          <span style={{ display: "inline-block", minWidth: 28, padding: "3px 10px", background: "#14532D", color: "#4ADE80", borderRadius: 20, fontSize: 13, fontWeight: 700 }}>
                            {u.property_count}
                          </span>
                        ) : (
                          <span style={{ color: "#475569", fontSize: 13 }}>0</span>
                        )}
                      </td>
                      <td style={{ padding: "13px 16px", textAlign: "center" }}>
                        {u.analysis_count > 0 ? (
                          <span style={{ display: "inline-block", minWidth: 28, padding: "3px 10px", background: "#1e1b4b", color: "#818CF8", borderRadius: 20, fontSize: 13, fontWeight: 700 }}>
                            {u.analysis_count}
                          </span>
                        ) : (
                          <span style={{ color: "#475569", fontSize: 13 }}>0</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {!loading && sorted.length > 0 && (
          <p style={{ marginTop: 12, fontSize: 12, color: "#475569", textAlign: "right" }}>
            {sorted.length} user{sorted.length !== 1 ? "s" : ""} · last refreshed {new Date().toLocaleTimeString("en-GB")}
          </p>
        )}

        {/* Lender Rates Management */}
        <div style={{ marginTop: 48 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: "#F59E0B20", display: "flex", alignItems: "center", justifyContent: "center", color: "#F59E0B" }}>
                <TrendingDown size={16} />
              </div>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Lender SVR Rates</h2>
              <button onClick={() => setShowRates(!showRates)} style={{ background: "none", border: "1px solid #334155", borderRadius: 6, padding: "4px 12px", fontSize: 12, color: "#94A3B8", cursor: "pointer" }}>
                {showRates ? "Hide" : "Show"}
              </button>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={seedLenderRates} style={{ padding: "8px 14px", background: "#1E293B", color: "#94A3B8", border: "1px solid #334155", borderRadius: 8, fontSize: 12, cursor: "pointer" }}>
                Seed Defaults
              </button>
              <button onClick={fetchLenderRates} style={{ padding: "8px 14px", background: "#1E293B", color: "#94A3B8", border: "1px solid #334155", borderRadius: 8, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                <RefreshCw size={12} /> Refresh
              </button>
            </div>
          </div>

          {showRates && (
            <div style={{ background: "#1E293B", border: "1px solid #334155", borderRadius: 16, overflow: "hidden" }}>
              {lenderLoading ? (
                <div style={{ padding: "40px 20px", textAlign: "center", color: "#64748B" }}>Loading rates...</div>
              ) : lenderRates.length === 0 ? (
                <div style={{ padding: "40px 20px", textAlign: "center", color: "#64748B" }}>
                  No lender rates found. Click "Seed Defaults" to populate with major UK lenders.
                </div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#0F172A" }}>
                      <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, color: "#94A3B8", fontWeight: 600, textTransform: "uppercase", borderBottom: "1px solid #1E293B" }}>Lender</th>
                      <th style={{ padding: "12px 16px", textAlign: "center", fontSize: 12, color: "#94A3B8", fontWeight: 600, textTransform: "uppercase", borderBottom: "1px solid #1E293B" }}>Type</th>
                      <th style={{ padding: "12px 16px", textAlign: "center", fontSize: 12, color: "#94A3B8", fontWeight: 600, textTransform: "uppercase", borderBottom: "1px solid #1E293B" }}>SVR Rate</th>
                      <th style={{ padding: "12px 16px", textAlign: "center", fontSize: 12, color: "#94A3B8", fontWeight: 600, textTransform: "uppercase", borderBottom: "1px solid #1E293B" }}>Last Updated</th>
                      <th style={{ padding: "12px 16px", textAlign: "center", fontSize: 12, color: "#94A3B8", fontWeight: 600, textTransform: "uppercase", borderBottom: "1px solid #1E293B" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lenderRates.map((lr, i) => {
                      const daysSince = lr.last_fetched ? Math.round((Date.now() - new Date(lr.last_fetched).getTime()) / 86400000) : 999;
                      const stale = daysSince > 14;
                      return (
                        <tr key={lr.id} className="row-hover" style={{ background: i % 2 === 0 ? "#1E293B" : "#162032" }}>
                          <td style={{ padding: "12px 16px", fontSize: 14, fontWeight: 500, color: "#E2E8F0" }}>
                            {lr.lender_name}
                          </td>
                          <td style={{ padding: "12px 16px", textAlign: "center" }}>
                            <span style={{
                              padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600,
                              background: lr.rate_type?.includes("Islamic") ? "#1a2e1a" : lr.rate_type === "BTL" ? "#2e1a1a" : "#1a1a2e",
                              color: lr.rate_type?.includes("Islamic") ? "#4ADE80" : lr.rate_type === "BTL" ? "#FCA5A5" : "#818CF8",
                            }}>
                              {lr.rate_type || "Standard"}
                            </span>
                          </td>
                          <td style={{ padding: "12px 16px", textAlign: "center" }}>
                            {editingRate === lr.id ? (
                              <input
                                type="number"
                                step="0.01"
                                value={editSvr}
                                onChange={(e) => setEditSvr(e.target.value)}
                                onKeyDown={(e) => { if (e.key === "Enter") saveRate(lr.id); if (e.key === "Escape") { setEditingRate(null); setEditSvr(""); } }}
                                autoFocus
                                style={{ width: 80, padding: "4px 8px", background: "#0F172A", border: "1px solid #6366F1", borderRadius: 6, fontSize: 14, color: "#F1F5F9", textAlign: "center", outline: "none" }}
                              />
                            ) : (
                              <span style={{ fontSize: 16, fontWeight: 700, color: "#F1F5F9" }}>{lr.svr_rate}%</span>
                            )}
                          </td>
                          <td style={{ padding: "12px 16px", textAlign: "center" }}>
                            <span style={{ fontSize: 12, color: stale ? "#FCA5A5" : "#64748B" }}>
                              {lr.last_fetched ? fmtDate(lr.last_fetched) : "Never"}
                              {stale && <span style={{ marginLeft: 6, color: "#F59E0B", fontSize: 11 }}>⚠ stale</span>}
                            </span>
                          </td>
                          <td style={{ padding: "12px 16px", textAlign: "center" }}>
                            {editingRate === lr.id ? (
                              <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                                <button onClick={() => saveRate(lr.id)} style={{ padding: "4px 12px", background: "#10B981", color: "white", border: "none", borderRadius: 6, fontSize: 12, cursor: "pointer", fontWeight: 600 }}>Save</button>
                                <button onClick={() => { setEditingRate(null); setEditSvr(""); }} style={{ padding: "4px 12px", background: "#334155", color: "#94A3B8", border: "none", borderRadius: 6, fontSize: 12, cursor: "pointer" }}>Cancel</button>
                              </div>
                            ) : (
                              <button onClick={() => { setEditingRate(lr.id); setEditSvr(String(lr.svr_rate)); }} style={{ padding: "4px 14px", background: "#334155", color: "#94A3B8", border: "none", borderRadius: 6, fontSize: 12, cursor: "pointer" }}>Edit</button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
