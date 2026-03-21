"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Mail, Lock, Loader, ArrowRight, Banknote } from "lucide-react";

export default function SignIn() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      setError(result.error);
      setLoading(false);
    } else if (result?.ok) {
      router.push("/");
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    await signIn("google", { redirect: true, callbackUrl: "/" });
  };

  return (
    <div style={S.page}>
      <div style={S.container}>
        {/* Header */}
        <div style={{ marginBottom: 40 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: "linear-gradient(135deg, #6366F1, #4F46E5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Banknote size={20} color="white" />
            </div>
            <span style={{ fontWeight: 700, fontSize: 20 }}>MortgageIQ</span>
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Sign In</h1>
          <p style={{ fontSize: 14, color: "#666" }}>
            Don't have an account?{" "}
            <a href="/auth/signup" style={{ color: "#6366F1", fontWeight: 600, textDecoration: "none" }}>
              Sign up
            </a>
          </p>
        </div>

        {/* Error message */}
        {error && (
          <div style={{ padding: "12px 16px", background: "#FEE2E2", border: "1px solid #FECACA", borderRadius: 10, marginBottom: 20, color: "#991B1B", fontSize: 13 }}>
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ marginBottom: 24 }}>
          <div style={{ marginBottom: 16 }}>
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

          <div style={{ marginBottom: 24 }}>
            <label style={S.label}>Password</label>
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

          <button type="submit" disabled={loading} style={{ ...S.primaryBtn, opacity: loading ? 0.7 : 1, cursor: loading ? "not-allowed" : "pointer" }}>
            {loading ? <Loader size={18} style={{ animation: "spin 1s linear infinite" }} /> : <ArrowRight size={18} />}
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        {/* Divider */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <div style={{ flex: 1, height: 1, background: "#E5E7EB" }} />
          <span style={{ fontSize: 12, color: "#999" }}>OR</span>
          <div style={{ flex: 1, height: 1, background: "#E5E7EB" }} />
        </div>

        {/* Google sign in */}
        <button type="button" onClick={handleGoogleSignIn} disabled={loading} style={{ ...S.googleBtn, opacity: loading ? 0.7 : 1, cursor: loading ? "not-allowed" : "pointer" }}>
          <svg width="20" height="20" viewBox="0 0 24 24">
            <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Sign in with Google
        </button>
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
  googleBtn: {
    width: "100%",
    padding: "12px 16px",
    background: "white",
    color: "#111",
    border: "1px solid #D1D5DB",
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 500,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    cursor: "pointer",
  },
};
