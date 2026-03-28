"use client";

import { useState } from "react";
import { Mail, Loader, ArrowLeft, Banknote, CheckCircle } from "lucide-react";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Something went wrong");
        setLoading(false);
        return;
      }

      setSent(true);
    } catch (err) {
      setError("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={S.page}>
      <div style={S.container}>
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: "linear-gradient(135deg, #6366F1, #4F46E5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Banknote size={20} color="white" />
            </div>
            <span style={{ fontWeight: 700, fontSize: 20 }}>Mortgage AI Calc</span>
          </div>

          {sent ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <CheckCircle size={28} color="#16A34A" />
                <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Check your email</h1>
              </div>
              <p style={{ fontSize: 14, color: "#666", lineHeight: 1.6 }}>
                If an account exists with <strong>{email}</strong>, we've sent a password reset link. It expires in 1 hour.
              </p>
              <p style={{ fontSize: 13, color: "#999", marginTop: 12 }}>
                Didn't receive it? Check your spam folder, or{" "}
                <button
                  onClick={() => { setSent(false); setEmail(""); }}
                  style={{ color: "#6366F1", fontWeight: 600, background: "none", border: "none", cursor: "pointer", fontSize: 13, padding: 0 }}
                >
                  try again
                </button>
              </p>
            </>
          ) : (
            <>
              <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Forgot your password?</h1>
              <p style={{ fontSize: 14, color: "#666" }}>
                Enter your email address and we'll send you a link to reset your password.
              </p>
            </>
          )}
        </div>

        {/* Error */}
        {error && (
          <div style={{ padding: "12px 16px", background: "#FEE2E2", border: "1px solid #FECACA", borderRadius: 10, marginBottom: 20, color: "#991B1B", fontSize: 13 }}>
            {error}
          </div>
        )}

        {/* Form — hidden after sent */}
        {!sent && (
          <form onSubmit={handleSubmit} style={{ marginBottom: 24 }}>
            <div style={{ marginBottom: 24 }}>
              <label style={S.label}>Email address</label>
              <div style={{ position: "relative" }}>
                <Mail size={18} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#9CA3AF" }} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  style={{ ...S.input, paddingLeft: 40 }}
                />
              </div>
            </div>

            <button type="submit" disabled={loading} style={{ ...S.primaryBtn, opacity: loading ? 0.7 : 1, cursor: loading ? "not-allowed" : "pointer" }}>
              {loading ? <Loader size={18} style={{ animation: "spin 1s linear infinite" }} /> : <Mail size={18} />}
              {loading ? "Sending..." : "Send Reset Link"}
            </button>
          </form>
        )}

        {/* Back to sign in */}
        <a href="/auth/signin" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, color: "#6366F1", fontWeight: 600, textDecoration: "none" }}>
          <ArrowLeft size={16} />
          Back to sign in
        </a>
      </div>
    </div>
  );
}

const S = {
  page: {
    minHeight: "100vh",
    background: "#FAFBFC",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "20px",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
  container: {
    width: "100%",
    maxWidth: 420,
    background: "white",
    borderRadius: 16,
    border: "1px solid #E5E7EB",
    padding: 32,
  },
  label: {
    display: "block",
    fontSize: 13,
    fontWeight: 600,
    color: "#374151",
    marginBottom: 8,
  },
  input: {
    width: "100%",
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid #D1D5DB",
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box",
  },
  primaryBtn: {
    width: "100%",
    padding: "12px 16px",
    background: "linear-gradient(135deg, #6366F1, #4F46E5)",
    color: "white",
    border: "none",
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 600,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    cursor: "pointer",
  },
};
