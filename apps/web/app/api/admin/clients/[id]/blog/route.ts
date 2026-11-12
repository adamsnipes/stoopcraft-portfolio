import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerClient } from '@/lib/supabase/server';
import { createPost, ensureUniqueSlug } from '@/lib/blog/posts';
import { slugify } from '@/lib/blog/sanitize';

type RouteContext = { params: Promise<{ id: string }> };

const schema = z.object({ title: z.string().min(1).max(200) });

async function assertAdmin(): Promise<boolean> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return !!user?.email && user.email === process.env.ADMIN_EMAIL;
}

// Create a new draft post for a client. Returns the post so the UI can open
// the editor. Scoped to the client in the path.
export async function POST(req: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  if (!(await assertAdmin())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const { id: clientId } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'validation_failed' }, { status: 400 });
  }

  const title = parsed.data.title.trim();
  const slug = await ensureUniqueSlug(clientId, slugify(title));
  const post = await createPost(clientId, { title, slug, status: 'draft', body_html: '' });
  if (!post) {
    return NextResponse.json({ error: 'create_failed' }, { status: 500 });
  }
  return NextResponse.json({ post });
}
