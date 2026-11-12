// Bi-monthly rep-payout reminder. Runs on the 1st and 15th of every month.
// Identifies every rep with vested-but-unpaid commission and emails the
// admin a breakdown + a link to /admin/payouts. The actual money + the
// "Mark as paid" click still happen manually — this cron only nudges.
//
// Vercel cron schedule: "0 9 1,15 * *"  (9am UTC, 1st and 15th).

import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { sendAdminAlert } from '@/lib/email';

function isAuthorized(req: NextRequest): boolean {
  return req.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`;
}

function dollars(cents: number): string {
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const admin = createServiceRoleClient();
  const platformDomain = process.env.PLATFORM_DOMAIN ?? 'stoopcraft.com';
  const nowIso = new Date().toISOString();

  // All pending-and-vested ledger rows, joined with rep metadata.
  const { data: rows } = await admin
    .from('commission_ledger')
    .select('sales_rep_id, commission_cents')
    .eq('status', 'pending')
    .lte('vests_at', nowIso);

  if (!rows || rows.length === 0) {
    return NextResponse.json({ ok: true, reps: 0, total_cents: 0, sent: false });
  }

  // Aggregate by rep.
  const byRep = new Map<string, number>();
  for (const r of rows) {
    byRep.set(r.sales_rep_id, (byRep.get(r.sales_rep_id) ?? 0) + r.commission_cents);
  }
  const repIds = Array.from(byRep.keys());
  const { data: reps } = await admin
    .from('sales_reps')
    .select('id, name, email, code')
    .in('id', repIds);

  const totalCents = Array.from(byRep.values()).reduce((s, v) => s + v, 0);

  const lines = (reps ?? [])
    .map((r) => {
      const cents = byRep.get(r.id) ?? 0;
      const label = r.name ?? r.email ?? r.code;
      const href = `https://${platformDomain}/admin/payouts?rep=${r.id}`;
      return `<li><strong>${label}</strong> (${r.code}) — ${dollars(cents)} · <a href="${href}">Process →</a></li>`;
    })
    .sort()
    .join('');

  const subject = `💰 Rep payouts due — ${dollars(totalCents)} across ${repIds.length} rep${repIds.length === 1 ? '' : 's'}`;
  const html = `
    <p>It&apos;s a payout day (1st or 15th). The following reps have vested commission ready to be paid:</p>
    <ul>${lines}</ul>
    <p>Total owed: <strong>${dollars(totalCents)}</strong></p>
    <p><a href="https://${platformDomain}/admin/payouts">Open payouts dashboard →</a></p>
    <p style="color:#888;font-size:12px">Vesting rule: first-month commissions wait 14 days; renewals vest immediately. Cancellations inside the 14-day window void unvested rows automatically.</p>
  `;

  await sendAdminAlert({ subject, html });

  return NextResponse.json({
    ok: true,
    reps: repIds.length,
    total_cents: totalCents,
    sent: true,
  });
}
