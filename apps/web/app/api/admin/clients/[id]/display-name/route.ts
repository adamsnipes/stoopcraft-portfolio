import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server';

type RouteContext = { params: Promise<{ id: string }> };

// Set (or clear) customer-facing blog branding. business_display_name is the
// name shown on the masthead (distinct from business_name, which stays
// canonical for emails/templates); blog_title is the blog index heading
// (default "The Blog"). Each field is optional so the panel can save either;
// an empty string clears that field (falls back to its default).
const inputSchema = z
  .object({
    business_display_name: z.string().max(120).optional(),
    blog_title: z.string().max(120).optional(),
  })
  .refine((v) => v.business_display_name !== undefined || v.blog_title !== undefined, {
    message: 'no_fields',
  });

async function assertAdmin(): Promise<string | null> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return null;
  return user.email === process.env.ADMIN_EMAIL ? user.email : null;
}

export async function POST(req: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const adminEmail = await assertAdmin();
  if (!adminEmail) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const parsed = inputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'validation_failed', details: parsed.error.issues }, { status: 400 });
  }

  // Only touch the fields the panel actually sent; '' clears to NULL (default).
  const update: { business_display_name?: string | null; blog_title?: string | null } = {};
  if (parsed.data.business_display_name !== undefined) {
    const t = parsed.data.business_display_name.trim();
    update.business_display_name = t === '' ? null : t;
  }
  if (parsed.data.blog_title !== undefined) {
    const t = parsed.data.blog_title.trim();
    update.blog_title = t === '' ? null : t;
  }

  const admin = createServiceRoleClient();
  const { error } = await admin
    .from('clients')
    .update(update)
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: 'update_failed', detail: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, ...update });
}
