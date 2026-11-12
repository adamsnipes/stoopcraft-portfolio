import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { getAuthenticatedRep } from '@/lib/sales-rep/auth';
import { PayoutSettingsForm } from './PayoutSettingsForm';

export const metadata: Metadata = { title: 'Settings' };

function dollars(cents: number): string {
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default async function RepSettingsPage() {
  const ctx = await getAuthenticatedRep();
  if (!ctx) redirect('/reps/login');

  const admin = createServiceRoleClient();

  // Year-to-date paid — shown for the rep's own tax records. We surface the
  // same number on the admin side; both pull from payouts.paid_at.
  const yearStart = new Date();
  yearStart.setMonth(0, 1);
  yearStart.setHours(0, 0, 0, 0);
  const { data: ytdRows } = await admin
    .from('payouts')
    .select('total_cents')
    .eq('sales_rep_id', ctx.rep.id)
    .gte('paid_at', yearStart.toISOString());
  const ytdCents = (ytdRows ?? []).reduce((s, r) => s + r.total_cents, 0);
  const lifetimeRes = await admin
    .from('payouts')
    .select('total_cents')
    .eq('sales_rep_id', ctx.rep.id);
  const lifetimeCents = (lifetimeRes.data ?? []).reduce((s, r) => s + r.total_cents, 0);

  return (
    <div className="space-y-8 max-w-2xl">
      <header>
        <h1 className="font-display text-3xl font-light tracking-tight">Settings</h1>
        <p className="text-sm text-ink-700 mt-1">
          Tell us where to send your payouts. We can&apos;t pay you out until
          this is set.
        </p>
      </header>

      <section className="bg-white border border-ink-900/10 rounded-2xl p-5">
        <h2 className="font-display text-xl tracking-tight mb-3">Payout method</h2>
        <PayoutSettingsForm
          initialMethod={ctx.rep.payout_method as 'paypal' | 'venmo' | null}
          initialDestination={ctx.rep.payout_destination ?? ''}
        />
      </section>

      <section className="bg-white border border-ink-900/10 rounded-2xl p-5 space-y-3">
        <h2 className="font-display text-xl tracking-tight">Tax records</h2>
        <p className="text-sm text-ink-700/70">
          Total payouts received from Stoopcraft. Useful for your annual
          self-employment filing. If you cross $600 in a calendar year (US
          reps), we&apos;ll reach out to collect a W-9 and issue a 1099-NEC
          the following January.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Stat label={`Paid in ${new Date().getFullYear()}`} value={dollars(ytdCents)} />
          <Stat label="Lifetime payouts" value={dollars(lifetimeCents)} />
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-cream-50 border border-ink-900/10 rounded-xl p-3">
      <div className="text-xs uppercase tracking-wider text-ink-700/60 font-semibold">{label}</div>
      <div className="text-xl font-display tracking-tight mt-1">{value}</div>
    </div>
  );
}
