import type { Metadata } from 'next';
import { getAuthenticatedClient } from '@/lib/tenant';
import { createServiceRoleClient } from '@/lib/supabase/server';
import Link from 'next/link';

export const metadata: Metadata = { title: "Dashboard" };

const PLAN_INFO: Record<string, { name: string; cadence: string; isSubscription: boolean }> = {
  starter: { name: 'Starter', cadence: 'Monthly subscription', isSubscription: true },
  pro: { name: 'Pro', cadence: 'Monthly subscription', isSubscription: true },
  maintenance: { name: 'Maintenance', cadence: 'Monthly subscription', isSubscription: true },
  setup: { name: 'One-time setup', cadence: 'Paid in full · No recurring fee', isSubscription: false },
  setup_plus_maintenance: { name: 'Setup + Maintenance', cadence: 'Setup fee paid · Monthly subscription', isSubscription: true },
};

function planSummary(plan: string | null, hasSubscription: boolean) {
  if (!plan) return { name: '—', cadence: 'No active plan', isSubscription: false };
  return (
    PLAN_INFO[plan] ?? {
      name: plan.charAt(0).toUpperCase() + plan.slice(1),
      cadence: hasSubscription ? 'Monthly subscription' : 'One-time payment',
      isSubscription: hasSubscription,
    }
  );
}

export default async function PortalDashboard() {
  const ctx = await getAuthenticatedClient();
  if (!ctx) return null;

  const admin = createServiceRoleClient();
  const { client } = ctx;

  // Only the customer's own change requests (source='portal') — never their
  // website leads (source='contact'/'lead_hero'). We email leads to the owner
  // and don't manage them here; the portal is not a lead inbox.
  const { count: openRequests } = await admin
    .from('requests')
    .select('id', { count: 'exact', head: true })
    .eq('client_id', client.id)
    .eq('source', 'portal')
    .eq('status', 'open');

  const { data: recentRequests } = await admin
    .from('requests')
    .select('id, body, status, created_at')
    .eq('client_id', client.id)
    .eq('source', 'portal')
    .order('created_at', { ascending: false })
    .limit(10);

  const platformDomain = process.env.PLATFORM_DOMAIN ?? 'localhost:3000';
  const siteUrl = client.custom_domain
    ? `https://${client.custom_domain}`
    : `https://${client.slug}.${platformDomain}`;

  const isLive = client.status === 'claimed' && !client.cancelled_at;
  const plan = planSummary(client.plan, !!client.stripe_subscription_id);

  const statusBadge = client.cancelled_at
    ? { label: 'Cancelled', cls: 'bg-red-50 text-red-700 border-red-200' }
    : isLive
    ? { label: 'Live', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
    : client.status === 'live'
    ? { label: 'Setting up', cls: 'bg-amber-accent/10 text-amber-accent border-amber-accent/30' }
    : { label: client.status, cls: 'bg-ink-900/5 text-ink-700 border-ink-900/10' };

  return (
    <div className="space-y-8">
      {/* Header */}
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-light tracking-tight">{client.business_name}</h1>
          <a
            href={siteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-ink-700/80 hover:text-ink-900 transition-colors mt-1 inline-flex items-center gap-1.5"
          >
            {siteUrl}
            <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path d="M2 10L10 2M10 2H5M10 2v5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        </div>
        <span className={`text-xs font-semibold px-3 py-1 rounded-full border whitespace-nowrap capitalize ${statusBadge.cls}`}>
          {statusBadge.label}
        </span>
      </header>

      {/* Cancelled banner */}
      {client.cancelled_at && (
        <div className="rounded-2xl bg-amber-50 border border-amber-200 px-5 py-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-amber-800">Subscription cancelled</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Your site stays live until{' '}
              {client.expires_at
                ? new Date(client.expires_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                : 'end of billing period'}
              . Data preserved for 60 days.
            </p>
          </div>
          <Link href="/portal/billing" className="text-xs font-semibold text-amber-800 underline underline-offset-2 whitespace-nowrap">
            Reactivate
          </Link>
        </div>
      )}

      {/* Setting up banner */}
      {client.status === 'live' && !client.cancelled_at && (
        <div className="rounded-2xl bg-blue-50 border border-blue-200 px-5 py-4">
          <p className="text-sm font-semibold text-blue-800">We&apos;re setting up your site</p>
          <p className="text-xs text-blue-700 mt-0.5">
            You&apos;ll receive an email once your site is live. Usually within 24 hours.
          </p>
        </div>
      )}

      {/* Plan & billing + Open requests */}
      <div className="grid md:grid-cols-3 gap-4">
        {/* Plan & billing — spans 2 cols */}
        <div className="md:col-span-2 bg-white rounded-2xl border border-ink-900/10 p-6 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-700/60">Plan &amp; billing</p>
              <h2 className="font-display text-xl font-medium mt-1.5">{plan.name}</h2>
              <p className="text-sm text-ink-700/80 mt-0.5">{plan.cadence}</p>
            </div>
            {client.cancelled_at ? (
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-full bg-red-50 text-red-700 border border-red-200">
                Cancelled
              </span>
            ) : plan.isSubscription ? (
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                Active
              </span>
            ) : client.plan === 'setup' ? (
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-full bg-ink-900/5 text-ink-700 border border-ink-900/10">
                Paid
              </span>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm border-t border-ink-900/5 pt-4">
            {client.claimed_at && (
              <div>
                <div className="text-[10px] uppercase tracking-widest text-ink-700/60 font-semibold mb-0.5">Customer since</div>
                <div className="text-ink-900">
                  {new Date(client.claimed_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </div>
              </div>
            )}
            {client.cancelled_at && client.expires_at && (
              <div>
                <div className="text-[10px] uppercase tracking-widest text-ink-700/60 font-semibold mb-0.5">Access until</div>
                <div className="text-ink-900">
                  {new Date(client.expires_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </div>
              </div>
            )}
            <div>
              <div className="text-[10px] uppercase tracking-widest text-ink-700/60 font-semibold mb-0.5">Billing</div>
              <div className="text-ink-900">{client.stripe_customer_id ? 'Billed via Stripe' : '—'}</div>
            </div>
          </div>

          {client.stripe_customer_id && (
            <div className="mt-5 pt-4 border-t border-ink-900/5">
              <Link
                href="/portal/billing"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-900 hover:text-amber-accent transition-colors"
              >
                {plan.isSubscription ? 'Manage subscription' : 'View billing'}
                <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M5 11l6-6M11 5H6m5 0v5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            </div>
          )}
        </div>

        {/* Open requests */}
        <div className="bg-white rounded-2xl border border-ink-900/10 p-6 shadow-[0_1px_2px_rgba(0,0,0,0.02)] flex flex-col">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-700/60">Open requests</p>
          <div className="font-display text-4xl font-light mt-1.5">{openRequests ?? 0}</div>
          <p className="text-sm text-ink-700/80 mt-0.5">Pending changes</p>
          <div className="mt-auto pt-4">
            <Link
              href="/portal/request"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-900 hover:text-amber-accent transition-colors"
            >
              Request a change
              <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M5 11l6-6M11 5H6m5 0v5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-700/60 mb-3">Quick actions</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            // Static (hand-managed) sites don't self-serve a preview surface —
            // swap that card for a clear "cancel anytime" action instead.
            client.render_mode === 'static'
              ? {
                  href: '/portal/cancel',
                  label: 'Cancel subscription',
                  desc: 'Cancel anytime — effective at period end',
                  icon: (
                    <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none">
                      <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5" />
                      <path d="M5 5l10 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  ),
                }
              : {
                  href: '/portal/preview',
                  label: 'Preview your site',
                  desc: 'See how your site looks to customers',
                  icon: (
                    <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none">
                      <path d="M2 10s3-6 8-6 8 6 8 6-3 6-8 6-8-6-8-6z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                      <circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5" />
                    </svg>
                  ),
                },
            {
              href: '/portal/request',
              label: 'Request a change',
              desc: 'Update text, photos, hours, services',
              icon: (
                <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none">
                  <path d="M4 13.5V16h2.5l7-7L11 6.5l-7 7zM15.7 4.3a1 1 0 010 1.4l-1.4 1.4-2.4-2.4 1.4-1.4a1 1 0 011.4 0l1 1z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
                </svg>
              ),
            },
            {
              href: '/portal/billing',
              label: 'Billing & invoices',
              desc: 'Manage payment method & invoices',
              icon: (
                <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none">
                  <rect x="2" y="5" width="16" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M2 9h16" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M5 13h3M13 13h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              ),
            },
          ].map(({ href, label, desc, icon }) => (
            <Link
              key={href}
              href={href}
              className="group bg-white rounded-2xl border border-ink-900/10 p-5 hover:border-ink-900/20 hover:shadow-[0_2px_8px_rgba(0,0,0,0.04)] transition-all shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
            >
              <div className="w-9 h-9 rounded-xl bg-cream-100 group-hover:bg-amber-accent/10 group-hover:text-amber-accent flex items-center justify-center text-ink-700 transition-colors mb-3">
                {icon}
              </div>
              <div className="font-semibold text-sm text-ink-900">{label}</div>
              <div className="text-xs text-ink-700/70 mt-1 leading-snug">{desc}</div>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent change requests */}
      {(recentRequests ?? []).length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-700/60 mb-3">Recent change requests</p>
          <div className="space-y-2">
            {(recentRequests ?? []).map((req) => {
              const isPending = req.status === 'open' || req.status === 'in_progress';
              const badge = {
                open: { label: 'Open', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
                in_progress: { label: 'In progress', cls: 'bg-amber-accent/10 text-amber-accent border-amber-accent/30' },
                done: { label: 'Done', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
                declined: { label: 'Declined', cls: 'bg-ink-900/5 text-ink-700 border-ink-900/10' },
              }[req.status] ?? { label: req.status, cls: 'bg-ink-900/5 text-ink-700 border-ink-900/10' };

              return (
                <div
                  key={req.id}
                  className={`rounded-2xl border px-5 py-4 flex items-start justify-between gap-4 shadow-[0_1px_2px_rgba(0,0,0,0.02)] ${
                    isPending ? 'bg-white border-ink-900/10' : 'bg-cream-100/40 border-ink-900/10'
                  }`}
                >
                  <p className={`text-sm leading-snug line-clamp-2 ${isPending ? 'text-ink-900' : 'text-ink-700/60'}`}>{req.body}</p>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${badge.cls}`}>
                      {badge.label}
                    </span>
                    <span className="text-xs text-ink-700/60">
                      {new Date(req.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
