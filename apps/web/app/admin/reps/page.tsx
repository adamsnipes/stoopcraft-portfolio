import type { Metadata } from 'next';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { RepsAdminTable } from './RepsAdminTable';

export const metadata: Metadata = { title: 'Sales reps' };

export default async function AdminRepsPage() {
  const admin = createServiceRoleClient();
  const { data: reps } = await admin
    .from('sales_reps')
    .select('*')
    .order('created_at', { ascending: false });

  const repIds = (reps ?? []).map((r) => r.id);

  // Per-rep aggregates (customer count, pending commission). Run as two
  // service-role queries instead of a join — the lists are short.
  const repAgg = new Map<string, { customers: number; pending_cents: number }>();
  if (repIds.length > 0) {
    const [{ data: customers }, { data: ledger }] = await Promise.all([
      admin
        .from('clients')
        .select('sales_rep_id, status, cancelled_at')
        .in('sales_rep_id', repIds),
      admin
        .from('commission_ledger')
        .select('sales_rep_id, commission_cents, status')
        .in('sales_rep_id', repIds),
    ]);
    for (const c of customers ?? []) {
      if (!c.sales_rep_id) continue;
      const isActive = c.status === 'claimed' && c.cancelled_at == null;
      if (!isActive) continue;
      const cur = repAgg.get(c.sales_rep_id) ?? { customers: 0, pending_cents: 0 };
      cur.customers += 1;
      repAgg.set(c.sales_rep_id, cur);
    }
    for (const l of ledger ?? []) {
      if (l.status !== 'pending') continue;
      const cur = repAgg.get(l.sales_rep_id) ?? { customers: 0, pending_cents: 0 };
      cur.pending_cents += l.commission_cents;
      repAgg.set(l.sales_rep_id, cur);
    }
  }

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-3xl font-light tracking-tight">Sales reps</h1>
        <p className="text-sm text-ink-700 mt-1">
          Reps self-register by signing in at /reps/login. Approve to unlock
          their dashboard.
        </p>
      </header>

      <RepsAdminTable
        reps={reps ?? []}
        aggregates={Object.fromEntries(repAgg.entries())}
      />
    </div>
  );
}
