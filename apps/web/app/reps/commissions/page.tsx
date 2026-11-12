import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getAuthenticatedRep } from '@/lib/sales-rep/auth';
import { createServiceRoleClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Commissions' };

function dollars(cents: number): string {
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-amber-accent/10 text-amber-accent border-amber-accent/30',
  paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  void: 'bg-ink-900/5 text-ink-700/60 border-ink-900/10',
};

export default async function CommissionsPage() {
  const ctx = await getAuthenticatedRep();
  if (!ctx) redirect('/reps/login');

  const admin = createServiceRoleClient();
  const [ledgerRes, payoutsRes] = await Promise.all([
    admin
      .from('commission_ledger')
      .select('id, accrued_at, paid_at, vests_at, status, gross_cents, commission_cents, commission_pct, client_id, payout_id')
      .eq('sales_rep_id', ctx.rep.id)
      .order('accrued_at', { ascending: false }),
    admin
      .from('payouts')
      .select('*')
      .eq('sales_rep_id', ctx.rep.id)
      .order('paid_at', { ascending: false }),
  ]);

  const ledger = ledgerRes.data ?? [];
  const payouts = payoutsRes.data ?? [];
  const nowMs = Date.now();

  // Fetch business names for the displayed client_ids.
  const clientIds = Array.from(new Set(ledger.map((r) => r.client_id)));
  const clientNames = new Map<string, string>();
  if (clientIds.length > 0) {
    const { data } = await admin
      .from('clients')
      .select('id, business_name')
      .in('id', clientIds);
    for (const c of data ?? []) clientNames.set(c.id, c.business_name);
  }

  const pendingVested = ledger
    .filter((r) => r.status === 'pending' && new Date(r.vests_at).getTime() <= nowMs);
  const pendingUnvested = ledger
    .filter((r) => r.status === 'pending' && new Date(r.vests_at).getTime() > nowMs);
  const pendingVestedTotal = pendingVested.reduce((sum, r) => sum + r.commission_cents, 0);
  const pendingUnvestedTotal = pendingUnvested.reduce((sum, r) => sum + r.commission_cents, 0);
  const paidTotal = ledger
    .filter((r) => r.status === 'paid')
    .reduce((sum, r) => sum + r.commission_cents, 0);

  // YTD paid — sum of payouts.total_cents within the current calendar year.
  // Surfaced for the rep's own tax records (1099 self-tracking).
  const yearStart = new Date();
  yearStart.setMonth(0, 1);
  yearStart.setHours(0, 0, 0, 0);
  const ytdCents = payouts
    .filter((p) => new Date(p.paid_at) >= yearStart)
    .reduce((sum, p) => sum + p.total_cents, 0);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-light tracking-tight">
            Commissions
          </h1>
          <p className="text-sm text-ink-700 mt-1">
            One row per paid invoice. Payouts run on the 1st &amp; 15th of every month;
            anything vested by then rolls into that cycle&apos;s paycheck.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="bg-white border border-ink-900/10 rounded-2xl p-4">
            <div className="text-xs uppercase tracking-wider text-ink-700/60 font-semibold">Vested · ready to pay</div>
            <div className="text-2xl font-display mt-1">{dollars(pendingVestedTotal)}</div>
          </div>
          <div className="bg-white border border-ink-900/10 rounded-2xl p-4">
            <div className="text-xs uppercase tracking-wider text-ink-700/60 font-semibold">Vesting</div>
            <div className="text-2xl font-display mt-1">{dollars(pendingUnvestedTotal)}</div>
            <div className="text-xs text-ink-700/60 mt-1">Locks in once customer survives 14 days</div>
          </div>
          <div className="bg-white border border-ink-900/10 rounded-2xl p-4">
            <div className="text-xs uppercase tracking-wider text-ink-700/60 font-semibold">Paid</div>
            <div className="text-2xl font-display mt-1">{dollars(paidTotal)}</div>
            <div className="text-xs text-ink-700/60 mt-1">
              {dollars(ytdCents)} in {new Date().getFullYear()}
            </div>
          </div>
        </div>
      </header>

      <section>
        <h2 className="font-display text-xl tracking-tight mb-3">Ledger</h2>
        <div className="bg-white rounded-2xl border border-ink-900/10 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-cream-100/60 border-b border-ink-900/10">
              <tr>
                {['Date', 'Customer', 'Invoice gross', 'Rate', 'Commission', 'Status'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 font-semibold text-ink-700 text-xs uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-900/5">
              {ledger.map((r) => {
                const vestMs = new Date(r.vests_at).getTime();
                const isUnvested = r.status === 'pending' && vestMs > nowMs;
                const daysOut = Math.max(0, Math.ceil((vestMs - nowMs) / (24 * 60 * 60 * 1000)));
                return (
                  <tr key={r.id} className={isUnvested ? 'opacity-70' : ''}>
                    <td className="px-4 py-3 text-ink-700 text-xs">
                      {new Date(r.accrued_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {clientNames.get(r.client_id) ?? r.client_id.slice(0, 8)}
                    </td>
                    <td className="px-4 py-3 text-ink-700">{dollars(r.gross_cents)}</td>
                    <td className="px-4 py-3 text-ink-700">{r.commission_pct}%</td>
                    <td className="px-4 py-3 font-medium">{dollars(r.commission_cents)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_BADGE[r.status] ?? ''}`}>
                        {isUnvested ? `vesting · ${daysOut}d` : r.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {ledger.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-ink-700/60">
                  No commissions yet — they accrue as your customers&apos; invoices get paid.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="font-display text-xl tracking-tight mb-3">Payouts</h2>
        <div className="bg-white rounded-2xl border border-ink-900/10 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-cream-100/60 border-b border-ink-900/10">
              <tr>
                {['Paid', 'Method', 'Reference', 'Amount', 'Notes'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 font-semibold text-ink-700 text-xs uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-900/5">
              {payouts.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3 text-ink-700 text-xs">
                    {new Date(p.paid_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-ink-700">{p.method}</td>
                  <td className="px-4 py-3 text-ink-700 font-mono text-xs">{p.reference ?? '—'}</td>
                  <td className="px-4 py-3 font-medium">{dollars(p.total_cents)}</td>
                  <td className="px-4 py-3 text-ink-700 text-xs">{p.notes ?? '—'}</td>
                </tr>
              ))}
              {payouts.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-ink-700/60">No payouts yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
