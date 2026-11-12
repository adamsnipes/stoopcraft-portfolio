import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getAuthenticatedRep } from '@/lib/sales-rep/auth';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { planMonthlyCents } from '@/lib/sales-rep/commission';
import { CustomersTable, type CustomerRow } from './CustomersTable';

export const metadata: Metadata = { title: 'Customers' };

export default async function RepCustomersPage() {
  const ctx = await getAuthenticatedRep();
  if (!ctx) redirect('/reps/login');

  const admin = createServiceRoleClient();
  const { data: customers } = await admin
    .from('clients')
    .select('id, business_name, slug, custom_domain, status, plan, claimed_at, cancelled_at, created_at')
    .eq('sales_rep_id', ctx.rep.id)
    .order('created_at', { ascending: false });

  // Lost customers — rows where this rep used to be attributed but the
  // attribution moved to someone else. Shown as tombstones so reps know
  // why a previously-visible prospect disappeared.
  const { data: lostEvents } = await admin
    .from('events')
    .select('client_id, metadata, created_at')
    .eq('type', 'rep_attribution_changed')
    .filter('metadata->>from_sales_rep_id', 'eq', ctx.rep.id)
    .order('created_at', { ascending: false });

  // De-dupe by client_id (most recent change wins) and drop any client that
  // ended up back with this rep — re-takeover loops shouldn't show as lost.
  const currentIds = new Set((customers ?? []).map((c) => c.id));
  const lostByClient = new Map<string, string>();
  for (const e of lostEvents ?? []) {
    if (!e.client_id || currentIds.has(e.client_id)) continue;
    if (!lostByClient.has(e.client_id)) lostByClient.set(e.client_id, e.created_at);
  }

  const { data: lostClients } = lostByClient.size > 0
    ? await admin
        .from('clients')
        .select('id, business_name, slug, custom_domain, status, plan, claimed_at, cancelled_at, created_at')
        .in('id', Array.from(lostByClient.keys()))
    : { data: [] };

  const cancelledIds = (customers ?? [])
    .filter((c) => c.cancelled_at)
    .map((c) => c.id);
  const reasons = new Map<string, string>();
  if (cancelledIds.length > 0) {
    const { data: events } = await admin
      .from('events')
      .select('client_id, metadata, created_at')
      .eq('type', 'customer_cancel')
      .in('client_id', cancelledIds)
      .order('created_at', { ascending: false });
    for (const e of events ?? []) {
      if (e.client_id && !reasons.has(e.client_id)) {
        const meta = (e.metadata ?? {}) as { reason?: string | null };
        if (meta.reason) reasons.set(e.client_id, meta.reason);
      }
    }
  }

  const platformDomain = process.env.PLATFORM_DOMAIN ?? 'localhost:3000';
  const proto = platformDomain.startsWith('localhost') ? 'http' : 'https';

  const ownRows: CustomerRow[] = (customers ?? []).map((c) => {
    const monthly = planMonthlyCents(c.plan);
    const myCut = Math.floor((monthly * ctx.rep.commission_pct) / 100);
    return {
      id: c.id,
      business_name: c.business_name,
      status: c.status,
      plan: c.plan,
      cancelled_at: c.cancelled_at,
      signed_up_at: c.claimed_at ?? c.created_at,
      site_href: c.custom_domain
        ? `https://${c.custom_domain}`
        : `${proto}://${c.slug}.${platformDomain}`,
      site_label: c.custom_domain ?? `${c.slug}.${platformDomain}`,
      monthly_cents: monthly,
      my_cut_cents: myCut,
      cancel_reason: reasons.get(c.id) ?? null,
      lost_at: null,
    };
  });

  const lostRows: CustomerRow[] = (lostClients ?? []).map((c) => ({
    id: c.id,
    business_name: c.business_name,
    status: c.status,
    plan: c.plan,
    cancelled_at: c.cancelled_at,
    signed_up_at: c.claimed_at ?? c.created_at,
    site_href: c.custom_domain
      ? `https://${c.custom_domain}`
      : `${proto}://${c.slug}.${platformDomain}`,
    site_label: c.custom_domain ?? `${c.slug}.${platformDomain}`,
    monthly_cents: 0,
    my_cut_cents: 0,
    cancel_reason: null,
    lost_at: lostByClient.get(c.id) ?? null,
  }));

  const rows = [...ownRows, ...lostRows];

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-3xl font-light tracking-tight">
          Customers
        </h1>
        <p className="text-sm text-ink-700 mt-1">
          {rows.length} attributed to you. &ldquo;Get link&rdquo; mints a fresh
          Stripe Checkout URL for unclaimed sites — copy and SMS to your
          prospect.
        </p>
      </header>

      <CustomersTable customers={rows} />
    </div>
  );
}
