"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Trash2, Calendar, PoundSterling, TrendingDown, Loader, ArrowLeft } from "lucide-react";

export default function MyAnalyses() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [analyses, setAnalyses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
    }
  }, [status, router]);

  useEffect(() => {
    if (session?.user?.id) {
      fetchAnalyses();
    }
  }, [session]);

  const fetchAnalyses = async () => {
    try {
      const response = await fetch("/api/analyses");
      if (!response.ok) throw new Error("Failed to fetch");
      const data = await response.json();
      setAnalyses(data);
    } catch (err) {
      setError("Failed to load your analyses");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this analysis?")) return;

    setDeletingId(id);
    try {
      const response = await fetch(`/api/analyses/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete");
      setAnalyses(analyses.filter((a) => a.id !== id));
    } catch (err) {
      setError("Failed to delete analysis");
    } finally {
      setDeletingId(null);
    }
  };

  if (status === "loading" || loading) {
    return (
      <div style={S.page}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%", border: "3px solid #E5E7EB", borderTopColor: "#6366F1", margin: "0 auto 16px", animation: "spin 0.8s linear infinite" }} />
            <p style={{ color: "#666", fontSize: 14 }}>Loading your analyses...</p>
          </div>
        </div>
      </div>
    );
  }

  const fmt = (n) => "£" + Number(n).toLocaleString("en-GB");

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={{ borderBottom: "1px solid #E5E7EB", background: "white", padding: "16px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => router.push("/")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: 8, color: "#6366F1", fontSize: 14, fontWeight: 500 }}>
            <ArrowLeft size={18} /> Back to home
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "40px 20px" }}>
        <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 12 }}>My Analyses</h1>
        <p style={{ fontSize: 15, color: "#666", marginBottom: 32 }}>View and manage all your saved mortgage analyses</p>

        {error && (
          <div style={{ padding: "12px 16px", background: "#FEE2E2", border: "1px solid #FECACA", borderRadius: 12, marginBottom: 24, color: "#991B1B", fontSize: 14 }}>
            {error}
          </div>
        )}

        {analyses.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px", background: "white", borderRadius: 16, border: "1px solid #E5E7EB" }}>
            <div style={{ width: 64, height: 64, borderRadius: 16, background: "#EEF2FF", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", color: "#6366F1" }}>
              <TrendingDown size={28} />
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>No analyses yet</h3>
            <p style={{ fontSize: 14, color: "#666", marginBottom: 24 }}>You haven't saved any mortgage analyses yet. Create one and save it to see it here.</p>
            <button onClick={() => router.push("/")} style={{ padding: "10px 24px", background: "linear-gradient(135deg, #6366F1, #4F46E5)", color: "white", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
              Create your first analysis
            </button>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 16 }}>
            {analyses.map((analysis) => (
              <div key={analysis.id} onClick={() => router.push(`/analyses/${analysis.id}`)} style={{ background: "white", borderRadius: 16, border: "1px solid #E5E7EB", padding: 24, transition: "all 0.2s", cursor: "pointer" }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#6366F1"; e.currentTarget.style.boxShadow = "0 0 0 3px #EEF2FF"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#E5E7EB"; e.currentTarget.style.boxShadow = "none"; }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>{analysis.title}</h3>
                    <p style={{ fontSize: 13, color: "#666" }}>
                      <Calendar size={14} style={{ display: "inline", marginRight: 6, verticalAlign: "middle" }} />
                      {new Date(analysis.created_at).toLocaleDateString("en-UK", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(analysis.id); }}
                    disabled={deletingId === analysis.id}
                    style={{
                      padding: "8px 12px",
                      background: "#FEE2E2",
                      color: "#DC2626",
                      border: "none",
                      borderRadius: 8,
                      fontSize: 13,
                      fontWeight: 500,
                      cursor: deletingId === analysis.id ? "not-allowed" : "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      opacity: deletingId === analysis.id ? 0.7 : 1,
                    }}
                  >
                    {deletingId === analysis.id ? <Loader size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Trash2 size={14} />}
                    Delete
                  </button>
                </div>

                {/* Analysis details grid */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
                  <div>
                    <p style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>Outstanding Balance</p>
                    <p style={{ fontSize: 16, fontWeight: 600 }}>{fmt(analysis.outstanding_balance)}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>Monthly Payment</p>
                    <p style={{ fontSize: 16, fontWeight: 600 }}>{fmt(analysis.monthly_payment)}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>Interest Rate</p>
                    <p style={{ fontSize: 16, fontWeight: 600 }}>{analysis.interest_rate.toFixed(2)}%</p>
                  </div>
                  <div>
                    <p style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>Remaining Term</p>
                    <p style={{ fontSize: 16, fontWeight: 600 }}>{analysis.remaining_years.toFixed(1)} yrs</p>
                  </div>
                </div>

                {/* Property address if available */}
                {analysis.property_address && (
                  <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 12 }}>
                    {analysis.property_address}
                  </p>
                )}

                {/* Type badges */}
                <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between" }}>
                  {analysis.bank && (
                    <span style={{ padding: "4px 12px", background: "#EEF2FF", color: "#6366F1", borderRadius: 6, fontSize: 12, fontWeight: 500 }}>
                      {analysis.bank}
                    </span>
                  )}
                  {analysis.mortgage_type && (
                    <span style={{ padding: "4px 12px", background: "#ECFDF5", color: "#10B981", borderRadius: 6, fontSize: 12, fontWeight: 500 }}>
                      {analysis.mortgage_type}
                    </span>
                  )}
                  {analysis.rate_type && (
                    <span style={{ padding: "4px 12px", background: "#FEF3C7", color: "#D97706", borderRadius: 6, fontSize: 12, fontWeight: 500 }}>
                      {analysis.rate_type}
                    </span>
                  )}
                  <span style={{ fontSize: 12, color: "#6366F1", fontWeight: 500, marginLeft: "auto" }}>View full report →</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const S = {
  page: {
    minHeight: "100vh",
    background: "#FAFBFC",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
};
