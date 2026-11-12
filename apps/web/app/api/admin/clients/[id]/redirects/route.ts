import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server';
import { parseRedirects } from '@/lib/static-sites/redirects';
import type { Json } from '@dfy/db';

type RouteContext = { params: Promise<{ id: string }> };

const schema = z.object({ text: z.string().max(50000) });

async function assertAdmin(): Promise<boolean> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return !!user?.email && user.email === process.env.ADMIN_EMAIL;
}

// Save a client's 301 redirect map (parsed from the admin textarea).
export async function POST(req: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  if (!(await assertAdmin())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const { id } = await params;

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

  const redirects = parseRedirects(parsed.data.text);
  const admin = createServiceRoleClient();
  const { error } = await admin
    .from('clients')
    .update({ redirects: redirects as unknown as Json })
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: 'update_failed', detail: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, count: redirects.length });
}
