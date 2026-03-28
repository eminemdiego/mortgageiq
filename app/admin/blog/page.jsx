"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Plus, Edit3, Trash2, Eye, EyeOff, Loader, ArrowLeft, Save, X, FileText,
} from "lucide-react";

const ADMIN_EMAIL = "ahmed.sarwar@hotmail.co.uk";

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function fmtDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });
}

export default function AdminBlog() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("list"); // list | editor
  const [editing, setEditing] = useState(null); // null = new post, slug = editing
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Form state
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [content, setContent] = useState("");
  const [featuredImage, setFeaturedImage] = useState("");
  const [postStatus, setPostStatus] = useState("draft");
  const [slugManual, setSlugManual] = useState(false);

  // Auth guard
  useEffect(() => {
    if (authStatus === "loading") return;
    if (!session?.user?.email || session.user.email !== ADMIN_EMAIL) {
      router.push("/");
    }
  }, [session, authStatus, router]);

  // Fetch posts
  useEffect(() => {
    if (session?.user?.email === ADMIN_EMAIL) {
      fetchPosts();
    }
  }, [session]);

  async function fetchPosts() {
    setLoading(true);
    try {
      const r = await fetch("/api/blog?all=true");
      const data = await r.json();
      setPosts(Array.isArray(data) ? data : []);
    } catch {
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }

  function openEditor(post) {
    if (post) {
      setEditing(post.slug);
      setTitle(post.title);
      setSlug(post.slug);
      setExcerpt(post.excerpt || "");
      setContent(post.content || "");
      setFeaturedImage(post.featured_image || "");
      setPostStatus(post.status || "draft");
      setSlugManual(true);
    } else {
      setEditing(null);
      setTitle("");
      setSlug("");
      setExcerpt("");
      setContent("");
      setFeaturedImage("");
      setPostStatus("draft");
      setSlugManual(false);
    }
    setError("");
    setSuccess("");
    setView("editor");
  }

  function closeEditor() {
    setView("list");
    setError("");
    setSuccess("");
  }

  async function handleSave() {
    setError("");
    setSuccess("");

    if (!title.trim() || !slug.trim() || !content.trim()) {
      setError("Title, slug, and content are required.");
      return;
    }

    setSaving(true);
    try {
      const body = { title, slug, excerpt, content, featured_image: featuredImage || null, status: postStatus };
      const url = editing ? `/api/blog/${editing}` : "/api/blog";
      const method = editing ? "PUT" : "POST";

      const r = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await r.json();

      if (!r.ok) {
        setError(data.error || "Failed to save");
        setSaving(false);
        return;
      }

      setSuccess(editing ? "Post updated!" : "Post created!");
      if (!editing) {
        setEditing(data.slug);
        setSlugManual(true);
      }
      fetchPosts();
    } catch {
      setError("Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(postSlug) {
    if (!confirm("Delete this post permanently?")) return;

    try {
      const r = await fetch(`/api/blog/${postSlug}`, { method: "DELETE" });
      if (r.ok) {
        fetchPosts();
        if (editing === postSlug) closeEditor();
      }
    } catch {
      // silent
    }
  }

  async function handleToggleStatus(post) {
    const newStatus = post.status === "published" ? "draft" : "published";
    try {
      await fetch(`/api/blog/${post.slug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      fetchPosts();
    } catch {
      // silent
    }
  }

  // Auto-generate slug from title
  useEffect(() => {
    if (!slugManual && title) {
      setSlug(slugify(title));
    }
  }, [title, slugManual]);

  if (authStatus === "loading" || (authStatus === "authenticated" && session?.user?.email !== ADMIN_EMAIL)) {
    return (
      <div style={{ ...S.page, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Loader size={28} color="#6366F1" style={{ animation: "spin 1s linear infinite" }} />
      </div>
    );
  }

  // ── EDITOR VIEW ──
  if (view === "editor") {
    return (
      <div style={S.page}>
        <div style={S.editorContainer}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
            <button onClick={closeEditor} style={S.backBtn}>
              <ArrowLeft size={16} /> Back to posts
            </button>
            <div style={{ display: "flex", gap: 10 }}>
              <select
                value={postStatus}
                onChange={(e) => setPostStatus(e.target.value)}
                style={S.statusSelect}
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
              <button onClick={handleSave} disabled={saving} style={S.saveBtn}>
                {saving ? <Loader size={16} style={{ animation: "spin 1s linear infinite" }} /> : <Save size={16} />}
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>

          {error && <div style={S.errorMsg}>{error}</div>}
          {success && <div style={S.successMsg}>{success}</div>}

          {/* Title */}
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Post title..."
            style={S.titleInput}
          />

          {/* Slug */}
          <div style={{ marginBottom: 20 }}>
            <label style={S.label}>Slug</label>
            <input
              type="text"
              value={slug}
              onChange={(e) => { setSlug(e.target.value); setSlugManual(true); }}
              placeholder="post-url-slug"
              style={S.input}
            />
            <p style={{ fontSize: 12, color: "#9CA3AF", marginTop: 4 }}>/blog/{slug || "..."}</p>
          </div>

          {/* Excerpt */}
          <div style={{ marginBottom: 20 }}>
            <label style={S.label}>Excerpt</label>
            <textarea
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              placeholder="Short summary for the blog listing..."
              rows={2}
              style={{ ...S.input, resize: "vertical" }}
            />
          </div>

          {/* Featured image URL */}
          <div style={{ marginBottom: 20 }}>
            <label style={S.label}>Featured Image URL</label>
            <input
              type="text"
              value={featuredImage}
              onChange={(e) => setFeaturedImage(e.target.value)}
              placeholder="https://..."
              style={S.input}
            />
            {featuredImage && (
              <img src={featuredImage} alt="Preview" style={{ maxWidth: 300, maxHeight: 160, borderRadius: 8, marginTop: 8, objectFit: "cover" }} />
            )}
          </div>

          {/* Content */}
          <div style={{ marginBottom: 20 }}>
            <label style={S.label}>Content (Markdown)</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={"Write your post in Markdown...\n\n## Heading\n\nParagraph text with **bold** and *italic*.\n\n- List item\n- Another item"}
              rows={20}
              style={{ ...S.input, fontFamily: "monospace", fontSize: 13, lineHeight: 1.7, resize: "vertical" }}
            />
          </div>
        </div>
      </div>
    );
  }

  // ── LIST VIEW ──
  return (
    <div style={S.page}>
      <div style={S.listContainer}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: "#111827", marginBottom: 4 }}>Blog Posts</h1>
            <p style={{ fontSize: 14, color: "#9CA3AF" }}>
              {posts.length} post{posts.length !== 1 ? "s" : ""}
            </p>
          </div>
          <button onClick={() => openEditor(null)} style={S.saveBtn}>
            <Plus size={16} /> New Post
          </button>
        </div>

        {loading && (
          <div style={{ textAlign: "center", padding: 60 }}>
            <Loader size={28} color="#6366F1" style={{ animation: "spin 1s linear infinite" }} />
          </div>
        )}

        {!loading && posts.length === 0 && (
          <div style={{ textAlign: "center", padding: 60 }}>
            <FileText size={40} color="#D1D5DB" />
            <p style={{ fontSize: 15, color: "#9CA3AF", marginTop: 12 }}>No blog posts yet. Create your first one!</p>
          </div>
        )}

        {/* Posts table */}
        {!loading && posts.length > 0 && (
          <div style={{ background: "white", borderRadius: 14, border: "1px solid #E5E7EB", overflow: "hidden" }}>
            {posts.map((post, i) => (
              <div
                key={post.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "16px 20px",
                  borderBottom: i < posts.length - 1 ? "1px solid #F3F4F6" : "none",
                  gap: 16,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 15, fontWeight: 600, color: "#111827" }}>{post.title}</span>
                    <span style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: "2px 8px",
                      borderRadius: 6,
                      background: post.status === "published" ? "#DCFCE7" : "#FEF3C7",
                      color: post.status === "published" ? "#166534" : "#92400E",
                      textTransform: "uppercase",
                    }}>
                      {post.status}
                    </span>
                  </div>
                  <span style={{ fontSize: 12, color: "#9CA3AF" }}>
                    /blog/{post.slug} &middot; {fmtDate(post.created_at)}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => handleToggleStatus(post)} style={S.iconBtn} title={post.status === "published" ? "Unpublish" : "Publish"}>
                    {post.status === "published" ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                  <button onClick={() => openEditor(post)} style={S.iconBtn} title="Edit">
                    <Edit3 size={15} />
                  </button>
                  <button onClick={() => handleDelete(post.slug)} style={{ ...S.iconBtn, color: "#DC2626" }} title="Delete">
                    <Trash2 size={15} />
                  </button>
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
  listContainer: {
    maxWidth: 800,
    margin: "0 auto",
    padding: "40px 20px 80px",
  },
  editorContainer: {
    maxWidth: 760,
    margin: "0 auto",
    padding: "40px 20px 80px",
  },
  backBtn: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 14,
    color: "#6366F1",
    fontWeight: 600,
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: 0,
    fontFamily: "inherit",
  },
  saveBtn: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "9px 18px",
    background: "linear-gradient(135deg, #6366F1, #4F46E5)",
    color: "white",
    border: "none",
    borderRadius: 9,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  statusSelect: {
    padding: "8px 12px",
    borderRadius: 9,
    border: "1px solid #D1D5DB",
    fontSize: 13,
    fontFamily: "inherit",
    cursor: "pointer",
    background: "white",
  },
  titleInput: {
    width: "100%",
    padding: "12px 0",
    border: "none",
    borderBottom: "2px solid #E5E7EB",
    fontSize: 28,
    fontWeight: 700,
    outline: "none",
    marginBottom: 24,
    fontFamily: "inherit",
    color: "#111827",
    boxSizing: "border-box",
  },
  label: {
    display: "block",
    fontSize: 13,
    fontWeight: 600,
    color: "#374151",
    marginBottom: 6,
  },
  input: {
    width: "100%",
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid #D1D5DB",
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box",
    fontFamily: "inherit",
  },
  errorMsg: {
    padding: "12px 16px",
    background: "#FEE2E2",
    border: "1px solid #FECACA",
    borderRadius: 10,
    marginBottom: 20,
    color: "#991B1B",
    fontSize: 13,
  },
  successMsg: {
    padding: "12px 16px",
    background: "#DCFCE7",
    border: "1px solid #BBF7D0",
    borderRadius: 10,
    marginBottom: 20,
    color: "#166534",
    fontSize: 13,
  },
  iconBtn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 34,
    height: 34,
    borderRadius: 8,
    border: "1px solid #E5E7EB",
    background: "white",
    cursor: "pointer",
    color: "#6B7280",
    fontFamily: "inherit",
  },
};
