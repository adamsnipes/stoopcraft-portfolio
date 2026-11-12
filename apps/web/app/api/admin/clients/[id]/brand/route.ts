import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server';
import { CHEAP_BRAND } from '@/lib/marketing-brand';

type RouteContext = { params: Promise<{ id: string }> };

// Set which brand a client is sold under. It decides the preview claim banner,
// the /pay page and its domain, Stripe Checkout branding and price, the welcome
// page and the activation emails. Locked once claimed: the customer has
// already paid under one brand.
const inputSchema = z.object({
  brand: z.enum(['stoopcraft', CHEAP_BRAND.id]),
});

async function assertAdmin(): Promise<string | null> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return null;
  return user.email === process.env.ADMIN_EMAIL ? user.email : null;
}

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

  const admin = createServiceRoleClient();
  const { data, error } = await admin
    .from('clients')
    .update({ brand: parsed.data.brand })
    .eq('id', id)
    .neq('status', 'claimed')
    .select('id');

  if (error) {
    return NextResponse.json({ error: 'update_failed', detail: error.message }, { status: 500 });
  }
  if (!data?.length) {
    return NextResponse.json({ error: 'locked_or_not_found' }, { status: 409 });
  }

  return NextResponse.json({ ok: true, brand: parsed.data.brand });
}
