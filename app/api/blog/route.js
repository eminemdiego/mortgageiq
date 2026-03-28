import { auth } from "@/app/api/auth/[...nextauth]/route";
import { createClient } from "@supabase/supabase-js";

const ADMIN_EMAIL = "ahmed.sarwar@hotmail.co.uk";

function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );
}

// GET — public: fetch published posts (or all posts for admin)
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const all = searchParams.get("all") === "true";

    const sb = supabase();
    let query = sb
      .from("blog_posts")
      .select("id, title, slug, excerpt, featured_image, status, created_at, updated_at")
      .order("created_at", { ascending: false });

    if (all) {
      // Admin wants all posts — verify they're admin
      const session = await auth();
      if (!session?.user?.email || session.user.email !== ADMIN_EMAIL) {
        return Response.json({ error: "Unauthorized" }, { status: 403 });
      }
    } else {
      query = query.eq("status", "published");
    }

    const { data, error } = await query;
    if (error) throw error;

    return Response.json(data || []);
  } catch (error) {
    console.error("Blog GET error:", error);
    return Response.json({ error: "Failed to fetch posts" }, { status: 500 });
  }
}

// POST — admin: create a new blog post
export async function POST(request) {
  try {
    const session = await auth();
    if (!session?.user?.email || session.user.email !== ADMIN_EMAIL) {
      return Response.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const { title, slug, excerpt, content, featured_image, status } = body;

    if (!title || !slug || !content) {
      return Response.json({ error: "Title, slug, and content are required" }, { status: 400 });
    }

    const sb = supabase();
    const { data, error } = await sb
      .from("blog_posts")
      .insert({
        title,
        slug,
        excerpt: excerpt || "",
        content,
        featured_image: featured_image || null,
        status: status || "draft",
        author_id: session.user.id,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return Response.json({ error: "A post with that slug already exists" }, { status: 409 });
      }
      throw error;
    }

    return Response.json(data, { status: 201 });
  } catch (error) {
    console.error("Blog POST error:", error);
    return Response.json({ error: "Failed to create post" }, { status: 500 });
  }
}
