import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server';
import { revalidateClientSite } from '@/lib/revalidation';

type RouteContext = { params: Promise<{ id: string }> };

async function assertAdmin(req: NextRequest): Promise<string | null> {
  void req;
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return null;
  return user.email === process.env.ADMIN_EMAIL ? user.email : null;
}

const patchSchema = z.object({
  status: z.enum(['draft', 'live', 'claimed', 'cancelled', 'paused']).optional(),
  plan: z.enum(['starter', 'pro', 'pro_plus']).optional(),
  custom_domain: z.string().optional(),
  domain_owner: z.enum(['platform', 'client']).optional(),
});

export async function PATCH(req: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const adminEmail = await assertAdmin(req);
  if (!adminEmail) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id } = await params;

  let body: unknown;
  try {
    // Support both JSON body and form submissions with _method=PATCH
    const ct = req.headers.get('content-type') ?? '';
    if (ct.includes('application/x-www-form-urlencoded') || ct.includes('multipart/form-data')) {
      const form = await req.formData();
      body = Object.fromEntries(form.entries());
    } else {
      body = await req.json();
    }
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'validation_failed', details: parsed.error.issues }, { status: 400 });
  }

  const supabase = createServiceRoleClient();

  const { data: client, error } = await supabase
    .from('clients')
    .update(parsed.data)
    .eq('id', id)
    .select('id, slug, custom_domain')
    .single();

  if (error || !client) {
    return NextResponse.json({ error: 'update_failed', detail: error?.message }, { status: 500 });
  }

  await supabase.from('events').insert({
    client_id: id,
    type: 'admin_update',
    metadata: { updated_fields: Object.keys(parsed.data), admin: adminEmail },
  });

  revalidateClientSite(client.slug, client.custom_domain);

  return NextResponse.json({ success: true });
}

// Support POST with _method=PATCH from HTML forms
export async function POST(req: NextRequest, ctx: RouteContext): Promise<NextResponse> {
  return PATCH(req, ctx);
}
