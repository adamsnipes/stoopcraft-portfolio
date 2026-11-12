import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { assertAdmin } from '@/lib/gsc/admin-auth';

type RouteContext = { params: Promise<{ id: string }> };

// Links a client to its Search Console property. The value must be the exact
// string sites.list returns — "sc-domain:example.com" and "https://example.com/"
// are distinct properties and only the exact form works as an API path segment,
// so this is picked from a dropdown in admin rather than typed.
const inputSchema = z.object({
  gsc_property: z
    .string()
    .max(300)
    .refine((v) => v === '' || v.startsWith('sc-domain:') || /^https?:\/\//.test(v), {
      message: 'must be "sc-domain:example.com" or "https://example.com/"',
    }),
});

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

  const parsed = inputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'validation_failed', details: parsed.error.issues }, { status: 400 });
  }

  const trimmed = parsed.data.gsc_property.trim();
  const value = trimmed === '' ? null : trimmed;

  const admin = createServiceRoleClient();
  const { error } = await admin.from('clients').update({ gsc_property: value }).eq('id', id);

  if (error) {
    return NextResponse.json({ error: 'update_failed', detail: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, gsc_property: value });
}
