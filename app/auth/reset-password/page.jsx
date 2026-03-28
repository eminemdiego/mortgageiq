"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Lock, Loader, ArrowRight, Banknote, CheckCircle, AlertTriangle } from "lucide-react";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Something went wrong");
        setLoading(false);
        return;
      }

      setSuccess(true);
    } catch (err) {
      setError("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div style={S.page}>
        <div style={S.container}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: "linear-gradient(135deg, #6366F1, #4F46E5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Banknote size={20} color="white" />
            </div>
            <span style={{ fontWeight: 700, fontSize: 20 }}>Mortgage AI Calc</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <AlertTriangle size={24} color="#DC2626" />
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Invalid reset link</h1>
          </div>
          <p style={{ fontSize: 14, color: "#666", marginBottom: 24 }}>
            This password reset link is missing or invalid. Please request a new one.
          </p>
          <a href="/auth/forgot-password" style={{ ...S.primaryBtn, textDecoration: "none", display: "inline-flex" }}>
            Request New Link
          </a>
        </div>
      </div>
    );
  }

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

          {success ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <CheckCircle size={28} color="#16A34A" />
                <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Password updated</h1>
              </div>
              <p style={{ fontSize: 14, color: "#666", marginBottom: 24 }}>
                Your password has been reset successfully. You can now sign in with your new password.
              </p>
              <a href="/auth/signin" style={{ ...S.primaryBtn, textDecoration: "none" }}>
                <ArrowRight size={18} />
                Sign In
              </a>
            </>
          ) : (
            <>
              <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Set new password</h1>
              <p style={{ fontSize: 14, color: "#666" }}>
                Enter your new password below.
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

        {/* Form — hidden after success */}
        {!success && (
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 16 }}>
              <label style={S.label}>New password</label>
              <div style={{ position: "relative" }}>
                <Lock size={18} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#9CA3AF" }} />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  style={{ ...S.input, paddingLeft: 40 }}
                />
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={S.label}>Confirm new password</label>
              <div style={{ position: "relative" }}>
                <Lock size={18} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#9CA3AF" }} />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  style={{ ...S.input, paddingLeft: 40 }}
                />
              </div>
            </div>

            <button type="submit" disabled={loading} style={{ ...S.primaryBtn, opacity: loading ? 0.7 : 1, cursor: loading ? "not-allowed" : "pointer" }}>
              {loading ? <Loader size={18} style={{ animation: "spin 1s linear infinite" }} /> : <ArrowRight size={18} />}
              {loading ? "Updating..." : "Reset Password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function ResetPassword() {
  return (
    <Suspense fallback={
      <div style={S.page}>
        <div style={S.container}>
          <Loader size={24} style={{ animation: "spin 1s linear infinite" }} />
        </div>
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
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
