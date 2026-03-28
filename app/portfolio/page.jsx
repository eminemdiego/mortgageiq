"use client";

import { useEffect, useState, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Building2, Plus, Search, ChevronUp, ChevronDown, AlertTriangle, CheckCircle, Clock,
} from "lucide-react";

const fmt = (n) => "£" + Number(n || 0).toLocaleString("en-GB");

function calcCashFlow(p) {
  const agentFee = (p.monthly_rent * (p.management_fee_pct || 0)) / 100;
  const costs = agentFee + (p.buildings_insurance || 0) + (p.landlord_insurance || 0) +
    (p.ground_rent || 0) + (p.service_charge || 0) + (p.maintenance_reserve || 0);
  return {
    net: p.monthly_rent - (p.monthly_payment || 0) - costs,
    agentFee,
    costs: (p.monthly_payment || 0) + costs,
  };
}

function grossYield(p) {
  if (!p.estimated_value || !p.monthly_rent) return null;
  return ((p.monthly_rent * 12) / p.estimated_value * 100);
}

function isOccupied(p) {
  return p.tenancy_status !== "vacant" && p.is_tenanted !== false;
}

function rentReviewInfo(p) {
  if (!p.last_rent_increase_date) return { eligible: true, months: null };
  const months = Math.round((new Date() - new Date(p.last_rent_increase_date)) / (1000 * 60 * 60 * 24 * 30.44));
  return { eligible: months >= 12, months };
}

function complianceStatus(dateStr) {
  if (!dateStr) return "missing";
  const d = new Date(dateStr);
  const now = new Date();
  if (d < now) return "expired";
  const days = Math.round((d - now) / (1000 * 60 * 60 * 24));
  if (days <= 30) return "expiring";
  return "valid";
}

const PAGE = { minHeight: "100vh", background: "#FAFBFC", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" };

export default function PortfolioDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [properties, setProperties] = useState([]);
  const [allCerts, setAllCerts] = useState({}); // { propertyId: [certs] }
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState("address");
  const [sortDir, setSortDir] = useState("asc");
  const [filterStatus, setFilterStatus] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") router.push("/auth/signin");
  }, [status, router]);

  useEffect(() => {
    if (session?.user?.id) fetchProperties();
  }, [session]);

  const fetchProperties = async () => {
    try {
      const res = await fetch("/api/portfolio");
      if (!res.ok) throw new Error();
      const props = await res.json();
      setProperties(props);
      // Fetch certificates for all properties in parallel
      const certResults = await Promise.all(
        props.map(async (p) => {
          try {
            const r = await fetch(`/api/portfolio/${p.id}/certificates`);
            return { id: p.id, certs: r.ok ? await r.json() : [] };
          } catch { return { id: p.id, certs: [] }; }
        })
      );
      const certsMap = {};
      certResults.forEach(({ id, certs }) => { certsMap[id] = certs; });
      setAllCerts(certsMap);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  function getPropertyCompliance(propertyId) {
    const certs = allCerts[propertyId] || [];
    let expired = 0, expiring = 0;
    certs.forEach(c => {
      const s = complianceStatus(c.expiry_date);
      if (s === "expired") expired++;
      else if (s === "expiring") expiring++;
    });
    if (expired > 0) return { label: expired, color: "#EF4444", bg: "#FEE2E2" };
    if (expiring > 0) return { label: expiring, color: "#F59E0B", bg: "#FEF3C7" };
    if (certs.length > 0) return { label: "✓", color: "#10B981", bg: "#ECFDF5" };
    return { label: "—", color: "#D1D5DB", bg: "#F3F4F6" };
  }

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const filtered = useMemo(() => {
    let list = [...properties];

    // Filter by status
    if (filterStatus === "occupied") list = list.filter(isOccupied);
    if (filterStatus === "vacant") list = list.filter(p => !isOccupied(p));

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p => (p.address || "").toLowerCase().includes(q) || (p.tenant_name || "").toLowerCase().includes(q));
    }

    // Sort
    list.sort((a, b) => {
      let va, vb;
      switch (sortKey) {
        case "address": va = (a.address || "").toLowerCase(); vb = (b.address || "").toLowerCase(); break;
        case "status": va = isOccupied(a) ? 0 : 1; vb = isOccupied(b) ? 0 : 1; break;
        case "tenant": va = (a.tenant_name || "").toLowerCase(); vb = (b.tenant_name || "").toLowerCase(); break;
        case "rent": va = a.monthly_rent || 0; vb = b.monthly_rent || 0; break;
        case "mortgage": va = a.monthly_payment || 0; vb = b.monthly_payment || 0; break;
        case "agentFee": va = (a.monthly_rent * (a.management_fee_pct || 0)) / 100; vb = (b.monthly_rent * (b.management_fee_pct || 0)) / 100; break;
        case "profit": va = calcCashFlow(a).net; vb = calcCashFlow(b).net; break;
        case "yield": va = grossYield(a) || 0; vb = grossYield(b) || 0; break;
        case "value": va = a.estimated_value || 0; vb = b.estimated_value || 0; break;
        case "ltv": va = a.estimated_value ? ((a.outstanding_balance || 0) / a.estimated_value) * 100 : 0; vb = b.estimated_value ? ((b.outstanding_balance || 0) / b.estimated_value) * 100 : 0; break;
        case "rate": va = a.interest_rate || 0; vb = b.interest_rate || 0; break;
        case "rateEnds": va = a.fixed_until ? new Date(a.fixed_until).getTime() : Infinity; vb = b.fixed_until ? new Date(b.fixed_until).getTime() : Infinity; break;
        case "termLeft": va = a.remaining_years || 0; vb = b.remaining_years || 0; break;
        case "rentReview": va = rentReviewInfo(a).eligible ? 0 : 1; vb = rentReviewInfo(b).eligible ? 0 : 1; break;
        default: va = 0; vb = 0;
      }
      if (typeof va === "string") return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
      return sortDir === "asc" ? va - vb : vb - va;
    });

    return list;
  }, [properties, filterStatus, search, sortKey, sortDir]);

  if (status === "loading" || loading) {
    return (
      <div style={{ ...PAGE, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%", border: "3px solid #E5E7EB", borderTopColor: "#6366F1", margin: "0 auto 16px", animation: "spin 0.8s linear infinite" }} />
          <p style={{ color: "#666", fontSize: 14 }}>Loading your portfolio...</p>
        </div>
      </div>
    );
  }

  const totalIncome = properties.reduce((s, p) => s + (p.monthly_rent || 0), 0);
  const totalCosts = properties.reduce((s, p) => s + calcCashFlow(p).costs, 0);
  const totalNet = totalIncome - totalCosts;
  const totalValue = properties.reduce((s, p) => s + (p.estimated_value || 0), 0);
  const yieldProps = properties.filter(p => grossYield(p));
  const avgYield = yieldProps.length ? (yieldProps.reduce((s, p) => s + grossYield(p), 0) / yieldProps.length).toFixed(1) : null;
  const eligibleCount = properties.filter(p => rentReviewInfo(p).eligible).length;
  const vacantCount = properties.filter(p => !isOccupied(p)).length;
  const certsExpiring = properties.reduce((s, p) => {
    const c = getPropertyCompliance(p.id);
    return s + (c.color === "#F59E0B" ? parseInt(c.label) || 0 : 0);
  }, 0);
  const certsExpired = properties.reduce((s, p) => {
    const c = getPropertyCompliance(p.id);
    return s + (c.color === "#EF4444" ? parseInt(c.label) || 0 : 0);
  }, 0);

  return (
    <div style={PAGE}>
      <div style={{ maxWidth: 1600, margin: "0 auto", padding: "32px 16px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 4, display: "flex", alignItems: "center", gap: 10 }}>
              <Building2 size={28} color="#6366F1" /> Portfolio Manager
            </h1>
            <p style={{ fontSize: 14, color: "#6B7280" }}>Track your buy-to-let properties, cash flow, and yields.</p>
          </div>
          <button onClick={() => router.push("/portfolio/add")} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 22px", background: "linear-gradient(135deg, #6366F1, #4F46E5)", color: "white", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
            <Plus size={16} /> Add Property
          </button>
        </div>

        {properties.length === 0 ? (
          <div style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: 16, padding: "60px 20px", textAlign: "center" }}>
            <div style={{ width: 72, height: 72, borderRadius: 20, background: "#EEF2FF", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", color: "#6366F1" }}>
              <Building2 size={32} />
            </div>
            <h3 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>No properties yet</h3>
            <p style={{ fontSize: 14, color: "#666", marginBottom: 24 }}>Add your first buy-to-let property to start tracking your portfolio.</p>
            <button onClick={() => router.push("/portfolio/add")} style={{ padding: "12px 28px", background: "linear-gradient(135deg, #6366F1, #4F46E5)", color: "white", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
              Add your first property
            </button>
          </div>
        ) : (
          <>
            {/* Summary cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 12 }} className="grid-cols-4">
              {[
                { label: "Total Properties", value: properties.length, raw: true },
                { label: "Portfolio Value", value: totalValue > 0 ? fmt(totalValue) : "—" },
                { label: "Monthly Income", value: fmt(Math.round(totalIncome)), color: "#10B981" },
                { label: "Monthly Costs", value: fmt(Math.round(totalCosts)), color: "#EF4444" },
              ].map((s, i) => (
                <div key={i} style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: 12, padding: "16px 18px" }}>
                  <p style={{ fontSize: 11, color: "#6B7280", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.5px" }}>{s.label}</p>
                  <p style={{ fontSize: s.raw ? 26 : 18, fontWeight: 700, color: s.color || "#111" }}>{s.raw ? s.value : s.value}</p>
                </div>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }} className="grid-cols-4">
              {[
                { label: "Net Monthly Profit", value: fmt(Math.round(totalNet)), color: totalNet >= 0 ? "#10B981" : "#EF4444" },
                { label: "Average Yield", value: avgYield ? avgYield + "%" : "—", color: "#6366F1" },
                { label: "Eligible for Rent Review", value: eligibleCount, raw: true, color: eligibleCount > 0 ? "#065F46" : "#6B7280" },
                { label: "Vacant Properties", value: vacantCount, raw: true, color: vacantCount > 0 ? "#EF4444" : "#10B981" },
              ].map((s, i) => (
                <div key={i} style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: 12, padding: "16px 18px" }}>
                  <p style={{ fontSize: 11, color: "#6B7280", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.5px" }}>{s.label}</p>
                  <p style={{ fontSize: s.raw ? 26 : 18, fontWeight: 700, color: s.color || "#111" }}>{s.raw ? s.value : s.value}</p>
                </div>
              ))}
            </div>

            {/* Compliance overview */}
            {(certsExpired > 0 || certsExpiring > 0) && (
              <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
                {certsExpired > 0 && (
                  <div style={{ padding: "10px 16px", background: "#FEE2E2", border: "1px solid #FECACA", borderRadius: 10, fontSize: 13, color: "#991B1B", fontWeight: 500 }}>
                    {certsExpired} certificate{certsExpired > 1 ? "s" : ""} expired across portfolio
                  </div>
                )}
                {certsExpiring > 0 && (
                  <div style={{ padding: "10px 16px", background: "#FEF3C7", border: "1px solid #FDE68A", borderRadius: 10, fontSize: 13, color: "#92400E", fontWeight: 500 }}>
                    {certsExpiring} certificate{certsExpiring > 1 ? "s" : ""} expiring soon
                  </div>
                )}
              </div>
            )}

            {/* Filter bar */}
            <div style={{ display: "flex", gap: 12, marginBottom: 20, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ display: "flex", gap: 2, background: "white", border: "1px solid #E5E7EB", borderRadius: 10, padding: 3 }}>
                {[
                  { key: "all", label: "All" },
                  { key: "occupied", label: "Occupied" },
                  { key: "vacant", label: "Vacant" },
                ].map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setFilterStatus(f.key)}
                    style={{
                      padding: "7px 16px",
                      border: "none",
                      borderRadius: 8,
                      fontSize: 13,
                      fontWeight: filterStatus === f.key ? 600 : 400,
                      background: filterStatus === f.key ? "#EEF2FF" : "transparent",
                      color: filterStatus === f.key ? "#4F46E5" : "#6B7280",
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <div style={{ position: "relative", flex: 1, maxWidth: 280 }}>
                <Search size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#9CA3AF" }} />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by address or tenant..."
                  style={{ width: "100%", padding: "9px 14px 9px 36px", border: "1px solid #E5E7EB", borderRadius: 10, fontSize: 13, outline: "none", background: "white", boxSizing: "border-box" }}
                />
              </div>
              <span style={{ fontSize: 12, color: "#9CA3AF" }}>{filtered.length} of {properties.length}</span>
            </div>

            {/* Desktop table */}
            <div className="portfolio-table-desktop" style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: 14, overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
              <table style={{ width: "100%", minWidth: 1100, borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "#F9FAFB", borderBottom: "1px solid #E5E7EB" }}>
                    {[
                      { key: "address", label: "Property" },
                      { key: "status", label: "Status" },
                      { key: "tenant", label: "Tenant" },
                      { key: "rent", label: "Rent" },
                      { key: "mortgage", label: "Mortgage" },
                      { key: "agentFee", label: "Agent" },
                      { key: "profit", label: "Profit" },
                      { key: "yield", label: "Yield" },
                      { key: "value", label: "Value" },
                      { key: "ltv", label: "LTV" },
                      { key: "rate", label: "Rate" },
                      { key: "rateEnds", label: "Ends" },
                      { key: "termLeft", label: "Term" },
                      { key: "rentReview", label: "Review" },
                      { key: null, label: "" },
                    ].map((col) => (
                      <th
                        key={col.label || "comp"}
                        onClick={col.key ? () => handleSort(col.key) : undefined}
                        style={{
                          padding: "10px 8px",
                          textAlign: col.key === "rent" || col.key === "mortgage" || col.key === "agentFee" || col.key === "profit" || col.key === "value" ? "right" : "left",
                          fontWeight: 600,
                          fontSize: 10,
                          color: "#6B7280",
                          textTransform: "uppercase",
                          letterSpacing: "0.4px",
                          cursor: col.key ? "pointer" : "default",
                          userSelect: "none",
                          whiteSpace: "nowrap",
                        }}
                      >
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                          {col.label}
                          {col.key && sortKey === col.key && (
                            sortDir === "asc" ? <ChevronUp size={10} /> : <ChevronDown size={10} />
                          )}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p, i) => {
                    const { net, agentFee } = calcCashFlow(p);
                    const gy = grossYield(p);
                    const occupied = isOccupied(p);
                    const rr = rentReviewInfo(p);
                    const compliance = getPropertyCompliance(p.id);
                    const P = "10px 8px";

                    return (
                      <tr
                        key={p.id}
                        style={{
                          borderBottom: i < filtered.length - 1 ? "1px solid #F3F4F6" : "none",
                          background: i % 2 === 1 ? "#FAFBFC" : "white",
                          transition: "background 0.15s",
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = "#F5F3FF"}
                        onMouseLeave={(e) => e.currentTarget.style.background = i % 2 === 1 ? "#FAFBFC" : "white"}
                      >
                        <td style={{ padding: P, maxWidth: 180 }}>
                          <a href={`/portfolio/${p.id}`} style={{ color: "#111", fontWeight: 600, textDecoration: "none", fontSize: 12, lineHeight: 1.35, display: "block" }}
                            onMouseEnter={(e) => e.target.style.color = "#6366F1"} onMouseLeave={(e) => e.target.style.color = "#111"}>
                            {p.address?.split(",")[0] || p.address || "—"}
                          </a>
                          {p.lender && <p style={{ fontSize: 10, color: "#9CA3AF", marginTop: 1 }}>{p.lender}</p>}
                        </td>

                        <td style={{ padding: P }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "2px 8px", borderRadius: 20, fontSize: 10, fontWeight: 600, background: occupied ? "#ECFDF5" : "#FEE2E2", color: occupied ? "#065F46" : "#991B1B" }}>
                            {occupied ? <CheckCircle size={9} /> : <AlertTriangle size={9} />}
                            {occupied ? "Let" : "Void"}
                          </span>
                        </td>

                        <td style={{ padding: P, color: p.tenant_name ? "#374151" : "#D1D5DB", maxWidth: 110, overflow: "hidden", textOverflow: "ellipsis" }}>
                          {p.tenant_name || "—"}
                        </td>

                        <td style={{ padding: P, fontWeight: 600, textAlign: "right" }}>{fmt(p.monthly_rent)}</td>
                        <td style={{ padding: P, color: "#6B7280", textAlign: "right" }}>{p.monthly_payment ? fmt(p.monthly_payment) : "—"}</td>
                        <td style={{ padding: P, color: "#6B7280", textAlign: "right" }}>{agentFee > 0 ? fmt(Math.round(agentFee)) : "—"}</td>
                        <td style={{ padding: P, fontWeight: 700, color: net >= 0 ? "#10B981" : "#EF4444", textAlign: "right" }}>{fmt(Math.round(net))}</td>
                        <td style={{ padding: P, fontWeight: 600 }}>{gy ? gy.toFixed(1) + "%" : "—"}</td>
                        <td style={{ padding: P, textAlign: "right", color: "#374151" }}>{p.estimated_value ? "£" + (p.estimated_value / 1000).toFixed(0) + "k" : "—"}</td>

                        <td style={{ padding: P }}>
                          {(() => {
                            if (!p.estimated_value || !p.outstanding_balance) return <span style={{ color: "#D1D5DB" }}>—</span>;
                            const ltv = (p.outstanding_balance / p.estimated_value) * 100;
                            const color = ltv > 75 ? "#EF4444" : ltv > 60 ? "#F59E0B" : "#10B981";
                            return <span style={{ fontWeight: 600, color }}>{ltv.toFixed(0)}%</span>;
                          })()}
                        </td>

                        <td style={{ padding: P }}>
                          {p.interest_rate ? (
                            <span style={{ fontWeight: 600, color: "#374151" }}>{p.interest_rate}%</span>
                          ) : <span style={{ color: "#D1D5DB" }}>—</span>}
                        </td>

                        <td style={{ padding: P }}>
                          {(() => {
                            if (!p.fixed_until) return <span style={{ fontSize: 10, color: "#9CA3AF" }}>SVR</span>;
                            const end = new Date(p.fixed_until);
                            const months = Math.round((end - new Date()) / (1000 * 60 * 60 * 24 * 30.44));
                            const color = months <= 3 ? "#EF4444" : months <= 6 ? "#F59E0B" : "#10B981";
                            return <span style={{ fontSize: 11, fontWeight: 500, color }}>{end.toLocaleDateString("en-GB", { month: "short", year: "2-digit" })}</span>;
                          })()}
                        </td>

                        <td style={{ padding: P, color: p.remaining_years && p.remaining_years < 5 ? "#F59E0B" : "#374151" }}>
                          {p.remaining_years ? Math.round(p.remaining_years) + "y" : "—"}
                        </td>

                        <td style={{ padding: P }}>
                          {rr.eligible ? (
                            <span style={{ padding: "2px 7px", borderRadius: 20, fontSize: 10, fontWeight: 600, background: "#F0FDF4", color: "#065F46" }}>Yes</span>
                          ) : (
                            <span style={{ fontSize: 10, color: "#9CA3AF" }}>{12 - rr.months}m</span>
                          )}
                        </td>

                        <td style={{ padding: P }}>
                          <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 22, height: 22, borderRadius: 6, background: compliance.bg, color: compliance.color, fontSize: 10, fontWeight: 700 }}>
                            {compliance.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="portfolio-mobile-cards" style={{ display: "none" }}>
              {filtered.map((p) => {
                const { net } = calcCashFlow(p);
                const occupied = isOccupied(p);
                return (
                  <a key={p.id} href={`/portfolio/${p.id}`} style={{ display: "block", background: "white", border: "1px solid #E5E7EB", borderRadius: 14, padding: "18px 20px", marginBottom: 12, textDecoration: "none", color: "inherit" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <h3 style={{ fontSize: 14, fontWeight: 700, color: "#111", lineHeight: 1.3 }}>{p.address?.split(",")[0] || p.address}</h3>
                      <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: occupied ? "#ECFDF5" : "#FEE2E2", color: occupied ? "#065F46" : "#991B1B" }}>
                        {occupied ? "Occupied" : "Vacant"}
                      </span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <div>
                        <p style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 2 }}>Rent</p>
                        <p style={{ fontSize: 15, fontWeight: 700 }}>{fmt(p.monthly_rent)}</p>
                      </div>
                      <div>
                        <p style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 2 }}>Net Profit</p>
                        <p style={{ fontSize: 15, fontWeight: 700, color: net >= 0 ? "#10B981" : "#EF4444" }}>{fmt(Math.round(net))}</p>
                      </div>
                    </div>
                  </a>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
