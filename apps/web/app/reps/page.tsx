import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import QRCode from 'qrcode';
import { getAuthenticatedRep } from '@/lib/sales-rep/auth';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { planMonthlyCents } from '@/lib/sales-rep/commission';
import { densify30Days, getFunnelStats } from '@/lib/sales-rep/clicks';
import { LinkTools } from './_components/LinkTools';
import { ChannelTable, FunnelStat, Sparkline } from './_components/FunnelPanel';
import { PayoutSetupBanner } from './_components/PayoutSetupBanner';

const DISCORD_INVITE_URL = process.env.SALES_REP_DISCORD_INVITE_URL ?? null;

export const metadata: Metadata = {
  title: 'Overview',
  // Authenticated rep dashboard — never indexable.
  robots: { index: false, follow: false },
};

function dollars(cents: number): string {
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

export default async function RepsOverview() {
  const ctx = await getAuthenticatedRep();
  if (!ctx) redirect('/reps/login');

  const admin = createServiceRoleClient();

  const [customersRes, ledgerRes, funnel] = await Promise.all([
    admin
      .from('clients')
      .select('id, status, plan, cancelled_at, business_name')
      .eq('sales_rep_id', ctx.rep.id),
    admin
      .from('commission_ledger')
      .select('commission_cents, status, accrued_at')
      .eq('sales_rep_id', ctx.rep.id),
    getFunnelStats(admin, ctx.rep.id),
  ]);

  const customers = customersRes.data ?? [];
  const ledger = ledgerRes.data ?? [];

  const activeCustomers = customers.filter(
    (c) => c.status === 'claimed' && c.cancelled_at == null,
  );
  const cancelledCustomers = customers.filter((c) => c.cancelled_at != null);

  const mrrAttributedCents = activeCustomers.reduce(
    (sum, c) => sum + planMonthlyCents(c.plan),
    0,
  );
  const myMonthlyCommissionCents = Math.floor(
    (mrrAttributedCents * ctx.rep.commission_pct) / 100,
  );

  const pendingCommissionCents = ledger
    .filter((r) => r.status === 'pending')
    .reduce((sum, r) => sum + r.commission_cents, 0);
  const lifetimeCommissionCents = ledger.reduce(
    (sum, r) => sum + r.commission_cents,
    0,
  );

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const cancellationsLast30 = cancelledCustomers.filter(
    (c) => c.cancelled_at && new Date(c.cancelled_at) >= cutoff,
  );

  const platformDomain = process.env.PLATFORM_DOMAIN ?? 'localhost:3000';
  const proto = platformDomain.startsWith('localhost') ? 'http' : 'https';
  const refLink = `${proto}://${platformDomain}/r/${ctx.rep.code}`;

  // QR rendered server-side so the client bundle stays small. PNG data URL
  // doubles as the <img src> and the Download href.
  const qrPngDataUrl = await QRCode.toDataURL(refLink, {
    width: 280,
    margin: 1,
    color: { dark: '#111111', light: '#FFFFFF' },
  });

  const sparkline = densify30Days(funnel.clicks.daily);
  const headerLabel = ctx.rep.kind === 'affiliate' ? 'Affiliate' : 'Sales rep';

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-3xl font-light tracking-tight">Overview</h1>
        <p className="text-sm text-ink-700 mt-1">
          {headerLabel} · {ctx.rep.name ?? ctx.email} · {ctx.rep.commission_pct}% commission
        </p>
      </header>

      {!ctx.rep.payout_method && <PayoutSetupBanner />}

      {/* Earnings — what they're owed and what they've earned to date. */}
      <section className="space-y-3">
        <h2 className="text-xs uppercase tracking-wider text-ink-700/60 font-semibold">
          Earnings
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat label="Active customers" value={String(activeCustomers.length)} />
          <Stat label="MRR attributed" value={dollars(mrrAttributedCents)} />
          <Stat
            label="Your monthly cut"
            value={dollars(myMonthlyCommissionCents)}
            hint={`${ctx.rep.commission_pct}% of MRR`}
          />
          <Stat
            label="Cancelled (30d)"
            value={String(cancellationsLast30.length)}
            tone={cancellationsLast30.length > 0 ? 'warn' : 'neutral'}
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Stat
            label="Commission pending payout"
            value={dollars(pendingCommissionCents)}
            large
          />
          <Stat
            label="Lifetime commission earned"
            value={dollars(lifetimeCommissionCents)}
            large
          />
        </div>
      </section>

      {/* Funnel — clicks → conversions → paying. The headline number for an
          affiliate; reps see it too since they also get cookie-driven traffic. */}
      <section className="space-y-3">
        <h2 className="text-xs uppercase tracking-wider text-ink-700/60 font-semibold">
          Funnel
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <FunnelStat
            label="Clicks (all time)"
            value={funnel.clicks.total.toLocaleString()}
            hint={`${funnel.clicks.today} today · ${funnel.clicks.mtd} this month`}
          />
          <FunnelStat
            label="Total conversions"
            value={String(funnel.conversions_total)}
            hint={`${funnel.conversions_paying} currently paying`}
          />
          <FunnelStat
            label="Conversion rate"
            value={funnel.clicks.total > 0 ? pct(funnel.conversion_rate) : '—'}
            hint="Conversions ÷ clicks"
          />
          <Sparkline series={sparkline} />
        </div>
      </section>

      {/* Tools — link toolkit (UTM builder, QR, copy buttons). */}
      <section className="space-y-3">
        <h2 className="text-xs uppercase tracking-wider text-ink-700/60 font-semibold">
          Share tools
        </h2>
        <LinkTools baseLink={refLink} qrPngDataUrl={qrPngDataUrl} />
      </section>

      {/* Channel breakdown — only meaningful once they've tagged a few links. */}
      <ChannelTable channels={funnel.channels} />

      <section className="bg-white border border-ink-900/10 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-xl tracking-tight">Recent cancellations</h2>
          <Link href="/reps/customers" className="text-sm text-amber-accent hover:underline">
            See all customers
          </Link>
        </div>
        {cancellationsLast30.length === 0 ? (
          <p className="text-sm text-ink-700/60">No cancellations in the last 30 days. 🎉</p>
        ) : (
          <ul className="divide-y divide-ink-900/5">
            {cancellationsLast30.map((c) => (
              <li key={c.id} className="py-2 flex justify-between text-sm">
                <span className="font-medium">{c.business_name}</span>
                <span className="text-ink-700/60">
                  {c.cancelled_at ? new Date(c.cancelled_at).toLocaleDateString() : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="bg-[#5865F2]/5 border border-[#5865F2]/20 rounded-2xl p-5 flex items-center gap-4">
        <div className="text-[#5865F2] shrink-0">
          <DiscordGlyph />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-display text-lg tracking-tight">Questions? Join the community</h2>
          <p className="text-sm text-ink-700/80 mt-0.5">
            Pitch templates, screenshots, niche ideas, and direct access to the team in the
            Stoopcraft Discord.
          </p>
        </div>
        {DISCORD_INVITE_URL ? (
          <a
            href={DISCORD_INVITE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 inline-flex items-center gap-2 bg-[#5865F2] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:brightness-95"
          >
            Join Discord
          </a>
        ) : (
          <span className="shrink-0 text-xs text-ink-700/60">Invite coming soon</span>
        )}
      </section>
    </div>
  );
}

function DiscordGlyph() {
  return (
    <svg width="28" height="22" viewBox="0 0 71 55" fill="currentColor" aria-hidden="true">
      <path d="M60.1 4.9A58.6 58.6 0 0 0 45.7.5a.2.2 0 0 0-.2.1c-.6 1.1-1.3 2.6-1.8 3.7a54 54 0 0 0-16.4 0c-.5-1.2-1.2-2.6-1.9-3.7a.2.2 0 0 0-.2-.1A58.4 58.4 0 0 0 10.7 4.9a.2.2 0 0 0-.1.1A60 60 0 0 0 .1 45.6a.2.2 0 0 0 .1.2 59 59 0 0 0 17.7 9 .2.2 0 0 0 .2-.1 42.3 42.3 0 0 0 3.6-5.9.2.2 0 0 0-.1-.2 39 39 0 0 1-5.5-2.6.2.2 0 0 1 0-.3l1.1-.9a.2.2 0 0 1 .2 0 42 42 0 0 0 35.7 0 .2.2 0 0 1 .2 0l1.1.9a.2.2 0 0 1 0 .3 36.7 36.7 0 0 1-5.5 2.6.2.2 0 0 0-.1.2 47.5 47.5 0 0 0 3.6 5.9.2.2 0 0 0 .2.1 59 59 0 0 0 17.7-9 .2.2 0 0 0 .1-.2A60 60 0 0 0 60.2 5a.2.2 0 0 0-.1-.1ZM23.7 37.3c-3.5 0-6.4-3.2-6.4-7.1 0-4 2.8-7.2 6.4-7.2 3.6 0 6.5 3.2 6.4 7.2 0 4-2.8 7.1-6.4 7.1Zm23.7 0c-3.5 0-6.4-3.2-6.4-7.1 0-4 2.8-7.2 6.4-7.2 3.6 0 6.5 3.2 6.4 7.2 0 4-2.8 7.1-6.4 7.1Z" />
    </svg>
  );
}

function Stat({
  label,
  value,
  hint,
  large,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  hint?: string;
  large?: boolean;
  tone?: 'neutral' | 'warn';
}) {
  return (
    <div
      className={`bg-white border rounded-2xl p-4 ${
        tone === 'warn' ? 'border-red-200' : 'border-ink-900/10'
      }`}
    >
      <div className="text-xs uppercase tracking-wider text-ink-700/60 font-semibold">{label}</div>
      <div className={`${large ? 'text-3xl' : 'text-2xl'} font-display tracking-tight mt-1`}>
        {value}
      </div>
      {hint && <div className="text-xs text-ink-700/60 mt-1">{hint}</div>}
    </div>
  );
}
