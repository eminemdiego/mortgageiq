"use client";

import { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import { Menu, X, Banknote, User, LogOut, ChevronDown } from "lucide-react";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/#analyse", label: "Analyse Mortgage" },
  { href: "/portfolio", label: "Portfolio Manager" },
  { href: "/blog", label: "Blog" },
];

export default function Navbar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  const isActive = (href) => {
    if (href === "/") return pathname === "/";
    if (href === "/#analyse") return false;
    return pathname.startsWith(href);
  };

  return (
    <>
      <nav style={S.nav}>
        <div style={S.inner}>
          {/* Logo */}
          <a href="/" style={S.logo}>
            <div style={S.logoIcon}>
              <Banknote size={18} color="white" />
            </div>
            <span style={S.logoText}>Mortgage AI Calc</span>
          </a>

          {/* Desktop links */}
          <div style={S.desktopLinks}>
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                style={{
                  ...S.link,
                  color: isActive(link.href) ? "#6366F1" : "#4B5563",
                  fontWeight: isActive(link.href) ? 600 : 500,
                }}
              >
                {link.label}
              </a>
            ))}

            {/* Account */}
            {session ? (
              <div style={{ position: "relative" }}>
                <button
                  onClick={() => setAccountOpen(!accountOpen)}
                  style={S.accountBtn}
                >
                  <div style={S.avatar}>
                    {(session.user?.name?.[0] || session.user?.email?.[0] || "U").toUpperCase()}
                  </div>
                  <ChevronDown size={14} color="#6B7280" />
                </button>
                {accountOpen && (
                  <>
                    <div style={S.overlay} onClick={() => setAccountOpen(false)} />
                    <div style={S.dropdown}>
                      <div style={S.dropdownHeader}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: "#111", margin: 0 }}>
                          {session.user?.name || "User"}
                        </p>
                        <p style={{ fontSize: 12, color: "#9CA3AF", margin: 0 }}>
                          {session.user?.email}
                        </p>
                      </div>
                      <a href="/analyses" style={S.dropdownItem}>My Analyses</a>
                      <a href="/portfolio" style={S.dropdownItem}>My Portfolio</a>
                      <button
                        onClick={() => signOut({ callbackUrl: "/" })}
                        style={{ ...S.dropdownItem, color: "#DC2626", border: "none", background: "none", width: "100%", cursor: "pointer", borderTop: "1px solid #F3F4F6", textAlign: "left" }}
                      >
                        <LogOut size={14} />
                        Sign Out
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <a href="/auth/signin" style={S.signInBtn}>
                <User size={15} />
                Sign In
              </a>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            style={S.hamburger}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div style={S.mobileMenu}>
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                style={{
                  ...S.mobileLink,
                  color: isActive(link.href) ? "#6366F1" : "#374151",
                  fontWeight: isActive(link.href) ? 600 : 500,
                }}
              >
                {link.label}
              </a>
            ))}
            <div style={{ height: 1, background: "#E5E7EB", margin: "4px 0" }} />
            {session ? (
              <>
                <div style={{ padding: "10px 16px", fontSize: 13, color: "#9CA3AF" }}>
                  {session.user?.email}
                </div>
                <a href="/analyses" onClick={() => setMobileOpen(false)} style={S.mobileLink}>
                  My Analyses
                </a>
                <button
                  onClick={() => { setMobileOpen(false); signOut({ callbackUrl: "/" }); }}
                  style={{ ...S.mobileLink, color: "#DC2626", border: "none", background: "none", width: "100%", cursor: "pointer", textAlign: "left" }}
                >
                  Sign Out
                </button>
              </>
            ) : (
              <a href="/auth/signin" onClick={() => setMobileOpen(false)} style={{ ...S.mobileLink, color: "#6366F1", fontWeight: 600 }}>
                Sign In
              </a>
            )}
          </div>
        )}
      </nav>
      {/* Spacer so content isn't hidden behind the fixed nav */}
      <div style={{ height: 60 }} />
    </>
  );
}

const S = {
  nav: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    height: 60,
    background: "rgba(255,255,255,0.95)",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    borderBottom: "1px solid #E5E7EB",
    zIndex: 1000,
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
  inner: {
    maxWidth: 1200,
    margin: "0 auto",
    height: 60,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 20px",
  },
  logo: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    textDecoration: "none",
    color: "#111",
  },
  logoIcon: {
    width: 34,
    height: 34,
    borderRadius: 9,
    background: "linear-gradient(135deg, #6366F1, #4F46E5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: {
    fontWeight: 700,
    fontSize: 17,
    letterSpacing: "-0.3px",
  },
  desktopLinks: {
    display: "flex",
    alignItems: "center",
    gap: 28,
  },
  link: {
    fontSize: 14,
    textDecoration: "none",
    transition: "color 0.15s",
  },
  signInBtn: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "7px 16px",
    background: "linear-gradient(135deg, #6366F1, #4F46E5)",
    color: "white",
    border: "none",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    textDecoration: "none",
    cursor: "pointer",
  },
  accountBtn: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: 0,
    background: "none",
    border: "none",
    cursor: "pointer",
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: "50%",
    background: "linear-gradient(135deg, #6366F1, #4F46E5)",
    color: "white",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 13,
    fontWeight: 700,
  },
  overlay: {
    position: "fixed",
    inset: 0,
    zIndex: 998,
  },
  dropdown: {
    position: "absolute",
    top: "calc(100% + 8px)",
    right: 0,
    width: 220,
    background: "white",
    borderRadius: 12,
    border: "1px solid #E5E7EB",
    boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
    zIndex: 999,
    overflow: "hidden",
  },
  dropdownHeader: {
    padding: "12px 16px",
    borderBottom: "1px solid #F3F4F6",
  },
  dropdownItem: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 16px",
    fontSize: 13,
    color: "#374151",
    textDecoration: "none",
    fontFamily: "inherit",
    fontSize: 13,
  },
  hamburger: {
    display: "none",
    background: "none",
    border: "none",
    cursor: "pointer",
    color: "#374151",
    padding: 4,
  },
  mobileMenu: {
    position: "absolute",
    top: 60,
    left: 0,
    right: 0,
    background: "white",
    borderBottom: "1px solid #E5E7EB",
    boxShadow: "0 8px 30px rgba(0,0,0,0.1)",
    padding: "8px 0",
  },
  mobileLink: {
    display: "block",
    padding: "12px 20px",
    fontSize: 15,
    color: "#374151",
    textDecoration: "none",
    fontFamily: "inherit",
  },
};
