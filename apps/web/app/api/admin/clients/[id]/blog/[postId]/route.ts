import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerClient } from '@/lib/supabase/server';
import { getPostForClient, updatePost, deletePost, ensureUniqueSlug, getClientSiteHost } from '@/lib/blog/posts';
import { sanitizePostHtml, slugify } from '@/lib/blog/sanitize';
import type { PostUpdate } from '@dfy/db';

type RouteContext = { params: Promise<{ id: string; postId: string }> };

const schema = z.object({
  title: z.string().min(1).max(200).optional(),
  slug: z.string().max(120).optional(),
  excerpt: z.string().max(500).optional(),
  cover_image_url: z.string().max(2000).optional(),
  body_html: z.string().max(200000).optional(),
  seo_title: z.string().max(200).optional(),
  seo_description: z.string().max(400).optional(),
  status: z.enum(['draft', 'in_review', 'published']).optional(),
});

async function assertAdmin(): Promise<boolean> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return !!user?.email && user.email === process.env.ADMIN_EMAIL;
}

// Update a post (incl. status transitions) or delete it. Scoped to the client
// in the path; body_html is sanitized before storage.
export async function PATCH(req: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  if (!(await assertAdmin())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const { id: clientId, postId } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'validation_failed', details: parsed.error.issues }, { status: 400 });
  }

  const existing = await getPostForClient(clientId, postId);
  if (!existing) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const d = parsed.data;
  const fields: Omit<PostUpdate, 'client_id' | 'id'> = {};
  if (d.title !== undefined) fields.title = d.title.trim() || existing.title;
  if (d.slug !== undefined) {
    const base = slugify(d.slug || d.title || existing.title);
    // Keep this post's own slug stable; only de-dupe against OTHER posts.
    fields.slug = await ensureUniqueSlug(clientId, base, postId);
  }
  if (d.excerpt !== undefined) fields.excerpt = d.excerpt.trim() || null;
  if (d.cover_image_url !== undefined) fields.cover_image_url = d.cover_image_url.trim() || null;
  if (d.body_html !== undefined) {
    // Pass the client's own host so links back to their site keep their
    // link equity instead of being nofollowed as if they were external.
    fields.body_html = sanitizePostHtml(d.body_html, await getClientSiteHost(clientId));
  }
  if (d.seo_title !== undefined) fields.seo_title = d.seo_title.trim() || null;
  if (d.seo_description !== undefined) fields.seo_description = d.seo_description.trim() || null;
  if (d.status !== undefined) {
    fields.status = d.status;
    // Stamp published_at on first publish; keep the original date afterwards.
    if (d.status === 'published' && !existing.published_at) {
      fields.published_at = new Date().toISOString();
    }
  }

  const post = await updatePost(clientId, postId, fields);
  if (!post) {
    return NextResponse.json({ error: 'update_failed' }, { status: 500 });
  }
  return NextResponse.json({ post });
}

export async function DELETE(_req: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  if (!(await assertAdmin())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const { id: clientId, postId } = await params;
  await deletePost(clientId, postId);
  return NextResponse.json({ ok: true });
}
