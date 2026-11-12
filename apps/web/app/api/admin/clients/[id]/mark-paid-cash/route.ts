import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server';
import { claimClient } from '@/lib/claim';

type RouteContext = { params: Promise<{ id: string }> };

const inputSchema = z.object({
  email: z.string().email(),
  amount_usd: z.number().int().positive().optional(),
  note: z.string().max(500).optional(),
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
  const { email, amount_usd, note } = parsed.data;

  const admin = createServiceRoleClient();

  // Refuse to re-claim. Cash flow has no upsell semantics — if the customer
  // is already claimed, the operator should use Stripe's portal or adjust
  // the row directly rather than overwriting payment provenance.
  const { data: existing } = await admin
    .from('clients')
    .select('status')
    .eq('id', id)
    .single();
  if (!existing) return NextResponse.json({ error: 'client_not_found' }, { status: 404 });
  if (existing.status === 'claimed') {
    return NextResponse.json({ error: 'already_claimed' }, { status: 409 });
  }

  let result;
  try {
    result = await claimClient(admin, {
      clientId: id,
      plan: 'setup',
      email,
      onUserCreateError: 'throw',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown';
    return NextResponse.json({ error: 'user_create_failed', detail: message }, { status: 500 });
  }

  await admin.from('events').insert({
    client_id: id,
    user_id: result.ownerUserId,
    type: 'manual_payment',
    metadata: {
      method: 'cash',
      plan: 'setup',
      amount_usd: amount_usd ?? 300,
      note: note ?? null,
      admin_email: adminEmail,
    },
  });

  return NextResponse.json({ ok: true });
}
