"use client";

import { useEffect, useState } from "react";
import { FileText, Calendar, Loader, ArrowRight } from "lucide-react";

function fmtDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric", month: "long", year: "numeric",
  });
}

export default function BlogListing() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/blog")
      .then((r) => r.json())
      .then((data) => setPosts(Array.isArray(data) ? data : []))
      .catch(() => setPosts([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={S.page}>
      <div style={S.container}>
        {/* Hero */}
        <div style={S.hero}>
          <h1 style={S.heroTitle}>Blog</h1>
          <p style={S.heroSub}>
            Tips, guides, and insights on mortgages, overpayments, and property investment.
          </p>
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: "center", padding: 60 }}>
            <Loader size={28} color="#6366F1" style={{ animation: "spin 1s linear infinite" }} />
          </div>
        )}

        {/* Empty state */}
        {!loading && posts.length === 0 && (
          <div style={S.empty}>
            <FileText size={40} color="#D1D5DB" />
            <p style={{ fontSize: 16, color: "#9CA3AF", marginTop: 12 }}>No posts yet — check back soon!</p>
          </div>
        )}

        {/* Posts grid */}
        {!loading && posts.length > 0 && (
          <div style={S.grid}>
            {posts.map((post) => (
              <a key={post.id} href={`/blog/${post.slug}`} style={S.card}>
                {post.featured_image && (
                  <div style={{ ...S.cardImage, backgroundImage: `url(${post.featured_image})` }} />
                )}
                <div style={S.cardBody}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                    <Calendar size={13} color="#9CA3AF" />
                    <span style={{ fontSize: 12, color: "#9CA3AF" }}>{fmtDate(post.created_at)}</span>
                  </div>
                  <h2 style={S.cardTitle}>{post.title}</h2>
                  {post.excerpt && (
                    <p style={S.cardExcerpt}>{post.excerpt}</p>
                  )}
                  <span style={S.readMore}>
                    Read more <ArrowRight size={14} />
                  </span>
                </div>
              </a>
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
  container: {
    maxWidth: 900,
    margin: "0 auto",
    padding: "40px 20px 80px",
  },
  hero: {
    textAlign: "center",
    marginBottom: 48,
  },
  heroTitle: {
    fontSize: 36,
    fontWeight: 800,
    color: "#111827",
    marginBottom: 8,
  },
  heroSub: {
    fontSize: 16,
    color: "#6B7280",
    maxWidth: 500,
    margin: "0 auto",
  },
  empty: {
    textAlign: "center",
    padding: 80,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
    gap: 24,
  },
  card: {
    background: "white",
    borderRadius: 14,
    border: "1px solid #E5E7EB",
    overflow: "hidden",
    textDecoration: "none",
    color: "inherit",
    transition: "box-shadow 0.2s, transform 0.2s",
    display: "flex",
    flexDirection: "column",
  },
  cardImage: {
    height: 180,
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundColor: "#F3F4F6",
  },
  cardBody: {
    padding: "20px 22px 22px",
    flex: 1,
    display: "flex",
    flexDirection: "column",
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: "#111827",
    marginBottom: 8,
    lineHeight: 1.35,
  },
  cardExcerpt: {
    fontSize: 14,
    color: "#6B7280",
    lineHeight: 1.6,
    marginBottom: 16,
    flex: 1,
  },
  readMore: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    fontSize: 13,
    fontWeight: 600,
    color: "#6366F1",
  },
};
