"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, Calendar, Loader } from "lucide-react";

function fmtDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric", month: "long", year: "numeric",
  });
}

// Simple markdown-to-HTML renderer (handles headings, bold, italic, links, images, lists, code blocks, paragraphs)
function renderMarkdown(md) {
  if (!md) return "";
  let html = md
    // Code blocks
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre style="background:#F3F4F6;padding:16px;border-radius:10px;overflow-x:auto;font-size:13px;line-height:1.6;margin:20px 0"><code>$2</code></pre>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code style="background:#F3F4F6;padding:2px 6px;border-radius:4px;font-size:13px">$1</code>')
    // Images
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width:100%;border-radius:10px;margin:20px 0" />')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" style="color:#6366F1;font-weight:500" target="_blank" rel="noopener">$1</a>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    // Italic
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    // H3
    .replace(/^### (.+)$/gm, '<h3 style="font-size:18px;font-weight:700;color:#111827;margin:28px 0 12px">$1</h3>')
    // H2
    .replace(/^## (.+)$/gm, '<h2 style="font-size:22px;font-weight:700;color:#111827;margin:32px 0 14px">$1</h2>')
    // H1
    .replace(/^# (.+)$/gm, '<h1 style="font-size:28px;font-weight:800;color:#111827;margin:36px 0 16px">$1</h1>')
    // Unordered lists
    .replace(/^- (.+)$/gm, '<li style="margin:4px 0;padding-left:4px">$1</li>')
    // Ordered lists
    .replace(/^\d+\. (.+)$/gm, '<li style="margin:4px 0;padding-left:4px">$1</li>')
    // Horizontal rule
    .replace(/^---$/gm, '<hr style="border:none;border-top:1px solid #E5E7EB;margin:32px 0" />')
    // Blockquotes
    .replace(/^> (.+)$/gm, '<blockquote style="border-left:3px solid #6366F1;padding:8px 16px;margin:20px 0;color:#6B7280;font-style:italic">$1</blockquote>');

  // Wrap consecutive <li> in <ul>
  html = html.replace(/((?:<li[^>]*>.*?<\/li>\s*)+)/g, '<ul style="padding-left:24px;margin:16px 0">$1</ul>');

  // Wrap remaining plain lines in <p>
  html = html
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return "";
      if (trimmed.startsWith("<")) return line;
      return `<p style="margin:12px 0;line-height:1.75;color:#374151">${trimmed}</p>`;
    })
    .join("\n");

  return html;
}

export default function BlogPost() {
  const { slug } = useParams();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`/api/blog/${slug}`)
      .then((r) => {
        if (!r.ok) { setNotFound(true); return null; }
        return r.json();
      })
      .then((data) => { if (data) setPost(data); })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div style={{ ...S.page, display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
        <Loader size={28} color="#6366F1" style={{ animation: "spin 1s linear infinite" }} />
      </div>
    );
  }

  if (notFound || !post) {
    return (
      <div style={{ ...S.page, textAlign: "center", padding: "100px 20px" }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: "#111", marginBottom: 8 }}>Post not found</h1>
        <p style={{ color: "#6B7280", marginBottom: 24 }}>This blog post doesn't exist or has been removed.</p>
        <a href="/blog" style={S.backLink}><ArrowLeft size={16} /> Back to Blog</a>
      </div>
    );
  }

  return (
    <div style={S.page}>
      <article style={S.article}>
        <a href="/blog" style={S.backLink}><ArrowLeft size={16} /> Back to Blog</a>

        {post.featured_image && (
          <img src={post.featured_image} alt={post.title} style={S.featuredImg} />
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 16, marginTop: 28 }}>
          <Calendar size={14} color="#9CA3AF" />
          <span style={{ fontSize: 13, color: "#9CA3AF" }}>{fmtDate(post.created_at)}</span>
          {post.status === "draft" && (
            <span style={{ fontSize: 11, fontWeight: 600, color: "#D97706", background: "#FEF3C7", padding: "2px 8px", borderRadius: 6, marginLeft: 8 }}>DRAFT</span>
          )}
        </div>

        <h1 style={S.title}>{post.title}</h1>

        {post.excerpt && (
          <p style={S.excerpt}>{post.excerpt}</p>
        )}

        <div
          style={S.content}
          dangerouslySetInnerHTML={{ __html: renderMarkdown(post.content) }}
        />
      </article>
    </div>
  );
}

const S = {
  page: {
    minHeight: "100vh",
    background: "#FAFBFC",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
  article: {
    maxWidth: 720,
    margin: "0 auto",
    padding: "40px 20px 80px",
  },
  backLink: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    fontSize: 14,
    color: "#6366F1",
    fontWeight: 600,
    textDecoration: "none",
  },
  featuredImg: {
    width: "100%",
    maxHeight: 400,
    objectFit: "cover",
    borderRadius: 14,
    marginTop: 24,
  },
  title: {
    fontSize: 34,
    fontWeight: 800,
    color: "#111827",
    lineHeight: 1.25,
    marginBottom: 12,
  },
  excerpt: {
    fontSize: 17,
    color: "#6B7280",
    lineHeight: 1.6,
    marginBottom: 32,
    paddingBottom: 24,
    borderBottom: "1px solid #E5E7EB",
  },
  content: {
    fontSize: 16,
    lineHeight: 1.75,
    color: "#374151",
  },
};
