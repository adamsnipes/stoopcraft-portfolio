import type { Metadata } from 'next';
import Link from 'next/link';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { PayoutPanel } from './PayoutPanel';

export const metadata: Metadata = { title: 'Payouts' };

type SearchParams = Promise<{ rep?: string }>;

function dollars(cents: number): string {
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default async function AdminPayoutsPage({ searchParams }: { searchParams: SearchParams }) {
  const { rep: selectedRepId } = await searchParams;
  const admin = createServiceRoleClient();

  const { data: reps } = await admin
    .from('sales_reps')
    .select('id, name, email, code, status, kind, payout_method, payout_destination')
    .order('name', { ascending: true });

  // YTD totals per rep — drives the threshold flag (1099-NEC trigger at $600
  // for US reps) on the list view and the per-rep tax stat.
  const yearStart = new Date();
  yearStart.setMonth(0, 1);
  yearStart.setHours(0, 0, 0, 0);
  const { data: ytdRows } = await admin
    .from('payouts')
    .select('sales_rep_id, total_cents')
    .gte('paid_at', yearStart.toISOString());
  const ytdByRep = new Map<string, number>();
  for (const row of ytdRows ?? []) {
    ytdByRep.set(row.sales_rep_id, (ytdByRep.get(row.sales_rep_id) ?? 0) + row.total_cents);
  }

  if (!selectedRepId) {
    return (
      <div>
        <header className="mb-6">
          <h1 className="font-display text-3xl font-light tracking-tight">Payouts</h1>
          <p className="text-sm text-ink-700 mt-1">
            Pick a rep to see pending commission and issue a payout. YTD columns
            help track 1099 thresholds ($600 for US reps).
          </p>
        </header>
        <div className="bg-white rounded-2xl border border-ink-900/10 divide-y divide-ink-900/5">
          {(reps ?? []).map((r) => {
            const ytd = ytdByRep.get(r.id) ?? 0;
            const threshold = ytd >= 60000; // $600
            return (
              <Link
                key={r.id}
                href={`/admin/payouts?rep=${r.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-cream-50 gap-4"
              >
                <div className="min-w-0">
                  <div className="font-medium truncate">{r.name ?? r.email}</div>
                  <div className="text-xs text-ink-700/60 font-mono">
                    {r.code} · {r.kind} · {r.status}
                    {!r.payout_method && ' · ⚠️ no payout method'}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs text-ink-700/60 uppercase tracking-wider">YTD paid</div>
                  <div className={`text-sm font-display ${threshold ? 'text-amber-accent font-semibold' : ''}`}>
                    {dollars(ytd)}
                    {threshold && <span title="Above $600 — 1099 required"> ⚠️</span>}
                  </div>
                </div>
              </Link>
            );
          })}
          {(reps ?? []).length === 0 && (
            <div className="px-4 py-12 text-center text-ink-700/60">No reps yet.</div>
          )}
        </div>
      </div>
    );
  }

  const rep = (reps ?? []).find((r) => r.id === selectedRepId);
  if (!rep) {
    return <div className="text-ink-700/60">Rep not found. <Link href="/admin/payouts" className="underline">Back</Link></div>;
  }
  const ytdCents = ytdByRep.get(rep.id) ?? 0;

  const [pendingRes, payoutsRes] = await Promise.all([
    admin
      .from('commission_ledger')
      .select('id, accrued_at, client_id, gross_cents, commission_cents, commission_pct, stripe_invoice_id, vests_at')
      .eq('sales_rep_id', selectedRepId)
      .eq('status', 'pending')
      .order('accrued_at', { ascending: true }),
    admin
      .from('payouts')
      .select('*')
      .eq('sales_rep_id', selectedRepId)
      .order('paid_at', { ascending: false }),
  ]);

  const pending = pendingRes.data ?? [];
  const payouts = payoutsRes.data ?? [];
  const nowMs = Date.now();
  const vested = pending.filter((r) => new Date(r.vests_at).getTime() <= nowMs);
  const unvested = pending.filter((r) => new Date(r.vests_at).getTime() > nowMs);
  const vestedTotal = vested.reduce((s, r) => s + r.commission_cents, 0);
  const unvestedTotal = unvested.reduce((s, r) => s + r.commission_cents, 0);
  // Next-to-vest row drives the headline countdown.
  const nextVesting = unvested
    .slice()
    .sort((a, b) => new Date(a.vests_at).getTime() - new Date(b.vests_at).getTime())[0];

  const clientIds = Array.from(new Set(pending.map((r) => r.client_id)));
  const clientNames = new Map<string, string>();
  if (clientIds.length > 0) {
    const { data } = await admin
      .from('clients')
      .select('id, business_name')
      .in('id', clientIds);
    for (const c of data ?? []) clientNames.set(c.id, c.business_name);
  }

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <Link href="/admin/payouts" className="text-xs text-ink-700/60 hover:underline">
            ← All reps
          </Link>
          <h1 className="font-display text-3xl font-light tracking-tight">
            {rep.name ?? rep.email}
          </h1>
          <p className="text-sm text-ink-700/60 font-mono mt-1">
            {rep.code} · {rep.kind}
          </p>
        </div>
        <div className="flex gap-3">
          <div className="bg-white border border-ink-900/10 rounded-2xl p-4 min-w-[180px]">
            <div className="text-xs uppercase tracking-wider text-ink-700/60 font-semibold">Ready to pay</div>
            <div className="text-2xl font-display mt-1">{dollars(vestedTotal)}</div>
          </div>
          <div className="bg-white border border-ink-900/10 rounded-2xl p-4 min-w-[180px]">
            <div className="text-xs uppercase tracking-wider text-ink-700/60 font-semibold">Unvested</div>
            <div className="text-2xl font-display mt-1">{dollars(unvestedTotal)}</div>
            {nextVesting && (
              <div className="text-xs text-ink-700/60 mt-1">
                Next vest in{' '}
                {Math.max(
                  0,
                  Math.ceil(
                    (new Date(nextVesting.vests_at).getTime() - nowMs) /
                      (24 * 60 * 60 * 1000),
                  ),
                )}{' '}
                days
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Payout destination — where to send the money + YTD tax tracking. */}
      <section className="bg-white border border-ink-900/10 rounded-2xl p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="font-display text-xl tracking-tight">Send payouts to</h2>
            {rep.payout_method && rep.payout_destination ? (
              <div className="mt-2 space-y-1">
                <div className="text-sm">
                  <span className="text-ink-700/60">Method:</span>{' '}
                  <span className="font-medium uppercase">{rep.payout_method}</span>
                </div>
                <div className="text-sm">
                  <span className="text-ink-700/60">
                    {rep.payout_method === 'venmo' ? 'Handle' : 'Email'}:
                  </span>{' '}
                  <code className="font-mono bg-cream-50 border border-ink-900/10 rounded px-2 py-0.5">
                    {rep.payout_method === 'venmo' ? '@' : ''}{rep.payout_destination}
                  </code>
                </div>
              </div>
            ) : (
              <p className="text-sm text-amber-accent mt-2">
                ⚠️ Rep hasn&apos;t set a payout method. Ping them in Discord to fill it
                in at /reps/settings before you can issue a payout.
              </p>
            )}
          </div>
          <div className="text-right">
            <div className="text-xs uppercase tracking-wider text-ink-700/60 font-semibold">
              YTD paid out
            </div>
            <div className="text-2xl font-display tracking-tight mt-1">
              {dollars(ytdCents)}
            </div>
            {ytdCents >= 60000 && (
              <div className="text-xs text-amber-accent mt-1 font-medium">
                ⚠️ Above $600 — collect W-9 for 1099
              </div>
            )}
          </div>
        </div>
      </section>

      <section>
        <h2 className="font-display text-xl tracking-tight mb-3">Pending ledger rows</h2>
        <p className="text-sm text-ink-700/70 mb-3">
          First-invoice commissions wait 14 days before vesting (bait-and-cancel filter).
          Renewals vest on payment. Only vested rows get rolled into a payout.
        </p>
        <div className="bg-white rounded-2xl border border-ink-900/10 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-cream-100/60 border-b border-ink-900/10">
              <tr>
                {['Date', 'Customer', 'Gross', 'Rate', 'Commission', 'Vests', 'Invoice'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 font-semibold text-ink-700 text-xs uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-900/5">
              {pending.map((r) => {
                const vestMs = new Date(r.vests_at).getTime();
                const isVested = vestMs <= nowMs;
                const daysOut = Math.max(0, Math.ceil((vestMs - nowMs) / (24 * 60 * 60 * 1000)));
                return (
                  <tr key={r.id} className={isVested ? '' : 'opacity-60'}>
                    <td className="px-4 py-3 text-xs text-ink-700">
                      {new Date(r.accrued_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 font-medium">{clientNames.get(r.client_id) ?? r.client_id.slice(0, 8)}</td>
                    <td className="px-4 py-3 text-ink-700">{dollars(r.gross_cents)}</td>
                    <td className="px-4 py-3 text-ink-700">{r.commission_pct}%</td>
                    <td className="px-4 py-3 font-medium">{dollars(r.commission_cents)}</td>
                    <td className="px-4 py-3 text-xs">
                      {isVested ? (
                        <span className="text-emerald-700">Vested</span>
                      ) : (
                        <span className="text-ink-700">In {daysOut}d</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-ink-700/60">{r.stripe_invoice_id}</td>
                  </tr>
                );
              })}
              {pending.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-ink-700/60">No pending rows.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {vested.length > 0 && rep.payout_method && rep.payout_destination && (
        <PayoutPanel
          repId={selectedRepId}
          totalCents={vestedTotal}
          method={rep.payout_method}
          destination={rep.payout_destination}
        />
      )}
      {vested.length > 0 && (!rep.payout_method || !rep.payout_destination) && (
        <section className="bg-amber-accent/10 border border-amber-accent/30 rounded-2xl p-5">
          <div className="font-display text-lg tracking-tight">
            {dollars(vestedTotal)} vested but can&apos;t pay yet
          </div>
          <p className="text-sm text-ink-700 mt-1">
            Rep needs to set their payout method first. Ping them to fill it
            in at /reps/settings; once they do, this panel will let you mark
            paid.
          </p>
        </section>
      )}

      <section>
        <h2 className="font-display text-xl tracking-tight mb-3">Past payouts</h2>
        <div className="bg-white rounded-2xl border border-ink-900/10 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-cream-100/60 border-b border-ink-900/10">
              <tr>
                {['Date', 'Method', 'Reference', 'Amount', 'Notes'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 font-semibold text-ink-700 text-xs uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-900/5">
              {payouts.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3 text-xs text-ink-700">{new Date(p.paid_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-ink-700">{p.method}</td>
                  <td className="px-4 py-3 font-mono text-xs text-ink-700/60">{p.reference ?? '—'}</td>
                  <td className="px-4 py-3 font-medium">{dollars(p.total_cents)}</td>
                  <td className="px-4 py-3 text-xs text-ink-700">{p.notes ?? '—'}</td>
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
