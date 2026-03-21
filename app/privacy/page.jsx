"use client";

import Link from "next/link";
import { Shield, Lock, Server, Mail, Database, Eye, ArrowLeft } from "lucide-react";

export default function PrivacyPolicy() {
  return (
    <div style={{ minHeight: "100vh", background: "#F9FAFB", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
      {/* Header */}
      <div style={{ background: "white", borderBottom: "1px solid #E5E7EB", padding: "16px 24px" }}>
        <div style={{ maxWidth: 760, margin: "0 auto", display: "flex", alignItems: "center", gap: 16 }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 6, color: "#6366F1", textDecoration: "none", fontSize: 14, fontWeight: 500 }}>
            <ArrowLeft size={16} /> Back to MortgageIQ
          </Link>
        </div>
      </div>

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "48px 24px" }}>
        <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 8 }}>Privacy Policy</h1>
        <p style={{ color: "#6B7280", marginBottom: 40, fontSize: 15 }}>Last updated: March 2026</p>

        {/* Plain-English Summary */}
        <div style={{ background: "#EEF2FF", border: "1px solid #C7D2FE", borderRadius: 16, padding: 24, marginBottom: 40 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "#312E81", marginBottom: 12 }}>Plain-English Summary</h2>
          <ul style={{ margin: 0, paddingLeft: 20, color: "#4338CA", fontSize: 14, lineHeight: 2 }}>
            <li>Your PDF and mortgage figures are sent to our secure server to be processed by AI — they are <strong>not stored</strong> afterwards.</li>
            <li>We use Anthropic's Claude AI to read your mortgage statement. Anthropic's data-processing terms apply.</li>
            <li>If you choose to email your report, your figures pass through Resend (our email provider) to reach you.</li>
            <li>If you create an account and click "Save Analysis", your mortgage figures are stored in our database so you can revisit them.</li>
            <li>We do not sell, share, or use your data for advertising.</li>
            <li>We use no tracking cookies, analytics scripts, or session recording tools.</li>
          </ul>
        </div>

        <Section icon={<Lock size={20} />} title="1. What data we collect and why">
          <p>When you upload a mortgage statement PDF, the file is transmitted over HTTPS to our server. Our server forwards the document to <strong>Anthropic</strong> (the company behind the Claude AI) to extract your mortgage details. Anthropic processes the document in line with its <a href="https://www.anthropic.com/legal/privacy" target="_blank" rel="noopener noreferrer" style={{ color: "#6366F1" }}>privacy policy</a> and API terms — which prohibit training on API inputs by default.</p>
          <p style={{ marginTop: 12 }}>After extraction, the raw PDF is not stored on any server. The extracted data (balance, rate, term, lender, etc.) lives in your browser session only — unless you explicitly choose to save or email it.</p>
        </Section>

        <Section icon={<Server size={20} />} title="2. Third-party services we use">
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #E5E7EB" }}>
                <th style={{ textAlign: "left", padding: "8px 12px", color: "#6B7280", fontWeight: 600 }}>Service</th>
                <th style={{ textAlign: "left", padding: "8px 12px", color: "#6B7280", fontWeight: 600 }}>Purpose</th>
                <th style={{ textAlign: "left", padding: "8px 12px", color: "#6B7280", fontWeight: 600 }}>Data sent</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Vercel", "Website hosting & serverless functions", "All traffic passes through Vercel's infrastructure"],
                ["Anthropic (Claude)", "AI extraction of mortgage details from your PDF", "Your PDF content and extracted mortgage figures"],
                ["Resend", "Sending your email report (only if you request it)", "Your email address and mortgage summary figures"],
                ["Supabase", "Storing saved analyses (only if you are logged in and click Save)", "Balance, rate, term, lender, mortgage type"],
              ].map(([svc, purpose, data], i) => (
                <tr key={i} style={{ borderBottom: "1px solid #F3F4F6" }}>
                  <td style={{ padding: "10px 12px", fontWeight: 600 }}>{svc}</td>
                  <td style={{ padding: "10px 12px", color: "#444" }}>{purpose}</td>
                  <td style={{ padding: "10px 12px", color: "#666" }}>{data}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section icon={<Database size={20} />} title="3. Data storage">
          <p><strong>No account / no save:</strong> Nothing is persisted. All data lives only in your browser tab and is gone when you close it.</p>
          <p style={{ marginTop: 12 }}><strong>Saved analyses (logged-in users):</strong> If you click "Save Analysis", the following fields are stored in our Supabase database, linked to your user account: outstanding balance, monthly payment, interest rate, remaining term, lender name, and mortgage type. No property address, no account numbers, no personal identifiers beyond your user ID.</p>
          <p style={{ marginTop: 12 }}>You can delete any saved analysis at any time from the Analyses page.</p>
        </Section>

        <Section icon={<Eye size={20} />} title="4. Cookies &amp; tracking">
          <p>We use <strong>no advertising cookies</strong>, <strong>no analytics trackers</strong> (no Google Analytics, Hotjar, Meta Pixel, or similar), and <strong>no session recording</strong>.</p>
          <p style={{ marginTop: 12 }}>The only cookies set are authentication session cookies (if you create an account), which are HTTP-only, Secure, and SameSite=Strict.</p>
        </Section>

        <Section icon={<Shield size={20} />} title="5. Security measures">
          <ul style={{ paddingLeft: 20, lineHeight: 2, fontSize: 14 }}>
            <li>All connections use <strong>HTTPS / TLS</strong> — data is encrypted in transit.</li>
            <li><strong>Strict-Transport-Security (HSTS)</strong> header prevents downgrade attacks.</li>
            <li><strong>Content-Security-Policy</strong> header limits what scripts can run on the page.</li>
            <li><strong>X-Frame-Options: DENY</strong> prevents clickjacking.</li>
            <li>Uploaded files are validated for size (max 10 MB) and magic bytes (must be a real PDF) before processing.</li>
            <li>Filenames are sanitised before use.</li>
            <li>API keys are stored as server-side environment variables — never exposed to the browser.</li>
          </ul>
        </Section>

        <Section icon={<Mail size={20} />} title="6. Contact">
          <p>Questions about this policy? Email us at <a href="mailto:support@mortgageiq.com" style={{ color: "#6366F1" }}>support@mortgageiq.com</a>.</p>
          <p style={{ marginTop: 12 }}>This policy may be updated from time to time. The "Last updated" date at the top will always reflect the most recent version.</p>
        </Section>
      </div>
    </div>
  );
}

function Section({ icon, title, children }) {
  return (
    <div style={{ marginBottom: 36 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <div style={{ color: "#6366F1" }}>{icon}</div>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{title}</h2>
      </div>
      <div style={{ fontSize: 14, color: "#374151", lineHeight: 1.75 }}>{children}</div>
    </div>
  );
}
