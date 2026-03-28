import { auth } from "@/app/api/auth/[...nextauth]/route";
import { createClient } from "@supabase/supabase-js";

const ADMIN_EMAIL = "ahmed.sarwar@hotmail.co.uk";

function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );
}

// GET — public: fetch a single post by slug (published only, unless admin)
export async function GET(request, { params }) {
  try {
    const { slug } = await params;
    const sb = supabase();

    let query = sb
      .from("blog_posts")
      .select("*")
      .eq("slug", slug)
      .single();

    const { data, error } = await query;

    if (error || !data) {
      return Response.json({ error: "Post not found" }, { status: 404 });
    }

    // If not published, only admin can see it
    if (data.status !== "published") {
      const session = await auth();
      if (!session?.user?.email || session.user.email !== ADMIN_EMAIL) {
        return Response.json({ error: "Post not found" }, { status: 404 });
      }
    }

    return Response.json(data);
  } catch (error) {
    console.error("Blog GET slug error:", error);
    return Response.json({ error: "Failed to fetch post" }, { status: 500 });
  }
}

// PUT — admin: update a blog post
export async function PUT(request, { params }) {
  try {
    const session = await auth();
    if (!session?.user?.email || session.user.email !== ADMIN_EMAIL) {
      return Response.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { slug } = await params;
    const body = await request.json();
    const { title, slug: newSlug, excerpt, content, featured_image, status } = body;

    const sb = supabase();

    const updates = { updated_at: new Date().toISOString() };
    if (title !== undefined) updates.title = title;
    if (newSlug !== undefined) updates.slug = newSlug;
    if (excerpt !== undefined) updates.excerpt = excerpt;
    if (content !== undefined) updates.content = content;
    if (featured_image !== undefined) updates.featured_image = featured_image;
    if (status !== undefined) updates.status = status;

    const { data, error } = await sb
      .from("blog_posts")
      .update(updates)
      .eq("slug", slug)
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return Response.json({ error: "A post with that slug already exists" }, { status: 409 });
      }
      throw error;
    }

    return Response.json(data);
  } catch (error) {
    console.error("Blog PUT error:", error);
    return Response.json({ error: "Failed to update post" }, { status: 500 });
  }
}

// DELETE — admin: delete a blog post
export async function DELETE(request, { params }) {
  try {
    const session = await auth();
    if (!session?.user?.email || session.user.email !== ADMIN_EMAIL) {
      return Response.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { slug } = await params;
    const sb = supabase();

    const { error } = await sb
      .from("blog_posts")
      .delete()
      .eq("slug", slug);

    if (error) throw error;

    return Response.json({ message: "Post deleted" });
  } catch (error) {
    console.error("Blog DELETE error:", error);
    return Response.json({ error: "Failed to delete post" }, { status: 500 });
  }
}
