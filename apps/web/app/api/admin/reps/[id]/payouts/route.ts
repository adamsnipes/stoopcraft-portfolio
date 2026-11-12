// Manual payout — sums every pending ledger row for the rep, inserts one
// payouts row, then flips the ledger rows to status='paid' and links them
// to the new payout. Two-step write isn't transactional via PostgREST, so
// we sequence carefully: insert payout first, then update ledger pointing
// at the new payout_id. If the second step fails, the payout row is an
// orphan in admin's view — fixable by hand and easy to spot in the UI.

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server';

type RouteContext = { params: Promise<{ id: string }> };

const inputSchema = z.object({
  reference: z.string().trim().max(120).nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
});

async function getAdminUserId(): Promise<string | null> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== process.env.ADMIN_EMAIL) return null;
  return user.id;
}

export async function POST(req: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const adminUserId = await getAdminUserId();
  if (!adminUserId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id: repId } = await params;
  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const parsed = inputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'validation_failed' }, { status: 400 });
  }

  const admin = createServiceRoleClient();
  // Only include rows that have actually vested. Unvested rows stay in
  // status='pending' but don't get rolled into a payout — they wait out
  // the 14-day clock or get voided by a cancellation.
  const nowIso = new Date().toISOString();
  const { data: pending } = await admin
    .from('commission_ledger')
    .select('id, commission_cents, currency')
    .eq('sales_rep_id', repId)
    .eq('status', 'pending')
    .lte('vests_at', nowIso);

  if (!pending || pending.length === 0) {
    return NextResponse.json({ error: 'nothing_to_pay' }, { status: 400 });
  }

  const totalCents = pending.reduce((s, r) => s + r.commission_cents, 0);
  const currency = pending[0]!.currency;
  const ledgerIds = pending.map((r) => r.id);

  const { data: payout, error: payoutErr } = await admin
    .from('payouts')
    .insert({
      sales_rep_id: repId,
      total_cents: totalCents,
      currency,
      method: 'manual',
      reference: parsed.data.reference ?? null,
      notes: parsed.data.notes ?? null,
      created_by: adminUserId,
    })
    .select('id')
    .single();
  if (payoutErr || !payout) {
    return NextResponse.json({ error: 'payout_insert_failed' }, { status: 500 });
  }

  const { error: updateErr } = await admin
    .from('commission_ledger')
    .update({
      status: 'paid',
      paid_at: new Date().toISOString(),
      payout_id: payout.id,
    })
    .in('id', ledgerIds);

  if (updateErr) {
    return NextResponse.json(
      { error: 'ledger_update_failed', payout_id: payout.id },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true, payout_id: payout.id, total_cents: totalCents });
}
