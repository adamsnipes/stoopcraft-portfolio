import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server';
import { sendRepWelcomeEmail } from '@/lib/email';
import type { SalesRepUpdate } from '@dfy/db';

type RouteContext = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  status: z.enum(['pending', 'active', 'disabled']).optional(),
  commission_pct: z.number().int().min(0).max(100).optional(),
  code: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9][a-z0-9-]{2,31}$/)
    .optional(),
  name: z.string().trim().max(120).nullable().optional(),
  payout_method: z.enum(['manual', 'stripe_connect']).optional(),
  kind: z.enum(['rep', 'affiliate']).optional(),
});

async function assertAdmin(): Promise<boolean> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return !!user && user.email === process.env.ADMIN_EMAIL;
}

export async function PATCH(req: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  if (!(await assertAdmin())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const { id } = await params;

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'validation_failed', details: parsed.error.issues }, { status: 400 });
  }

  // Read the existing row up-front. We need approved_at (for stamping) +
  // status/email/kind/code/commission_pct (for the welcome-email hook below).
  const admin = createServiceRoleClient();
  const { data: existing } = await admin
    .from('sales_reps')
    .select('approved_at, status, email, kind, code, commission_pct')
    .eq('id', id)
    .single();

  const update: SalesRepUpdate = { ...parsed.data };
  // Stamp approved_at the first time a rep is moved to active, but keep the
  // original timestamp on subsequent transitions (active→disabled→active).
  if (parsed.data.status === 'active' && !existing?.approved_at) {
    update.approved_at = new Date().toISOString();
  }

  const { data, error } = await admin
    .from('sales_reps')
    .update(update)
    .eq('id', id)
    .select('*')
    .maybeSingle();

  if (error) {
    // Unique-violation on code rename = collision with another rep.
    if (error.code === '23505') {
      return NextResponse.json({ error: 'code_taken' }, { status: 409 });
    }
    return NextResponse.json({ error: 'update_failed' }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  // Fire the welcome-active email when a rep's status crosses from
  // 'pending' → 'active' for the first time. (Re-activating a previously
  // disabled rep doesn't re-send — they already got it the first time.)
  const becameActive =
    parsed.data.status === 'active' &&
    existing?.status === 'pending' &&
    !!data.email;
  if (becameActive) {
    sendRepWelcomeEmail({
      to: data.email!,
      kind: (data.kind as 'rep' | 'affiliate') ?? 'rep',
      status: 'active',
      code: data.code,
      commissionPct: data.commission_pct,
    }).catch((err) =>
      console.error('rep approval welcome email failed', {
        rep_id: id,
        error: err instanceof Error ? err.message : String(err),
      }),
    );
  }

  return NextResponse.json({ rep: data });
}
