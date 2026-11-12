import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getClient, tabsForClient } from './client-data';
import { clientSubdomainHost } from '@/lib/marketing-brand';
import { ClientTabs } from './ClientTabs';
import { Badge, StatusDot, btn, formatDate } from '../../ui';

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const client = await getClient(id);
  return { title: client?.business_name ?? 'Client' };
}

/**
 * Shared chrome for every client screen.
 *
 * Before this existed the detail page was one ~12-panel scroll and each
 * sub-route re-rendered its own "<business name> — <section>" heading and back
 * link. The header and tab strip now live here once, and each page below is
 * just its own panels.
 */
export default async function ClientLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Params;
}) {
  const { id } = await params;
  const client = await getClient(id);
  if (!client) notFound();

  const isStatic = client.render_mode === 'static';
  const siteUrl = client.custom_domain
    ? `https://${client.custom_domain}`
    : `https://${clientSubdomainHost(client)}`;

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <Link
            href="/admin"
            className="text-sm text-ink-700/60 transition-colors hover:text-ink-900"
          >
            ← All clients
          </Link>
          <h1 className="mt-1.5 font-display text-2xl font-semibold tracking-tight">
            {client.business_name}
          </h1>
          <p className="mt-1 text-sm text-ink-700/70">
            {isStatic ? (
              'Uploaded HTML site'
            ) : (
              <>
                {[client.city, client.state].filter(Boolean).join(', ')}
                {client.niche ? ` · ${client.niche}` : ''}
              </>
            )}
          </p>
        </div>

        <a
          href={siteUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`${btn.primary} shrink-0`}
        >
          View site
          <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path
              d="M5 11l6-6M11 5H6m5 0v5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </a>
      </div>

      {/* At-a-glance facts. Previously four large cards that pushed the actual
          controls below the fold; the same data reads fine as one line. */}
      <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <StatusDot status={client.status} />
        <span className="text-ink-900/12">|</span>
        {client.plan ? (
          <Badge className="capitalize">{client.plan.replace(/_/g, ' ')}</Badge>
        ) : (
          <span className="text-ink-700/50">No plan</span>
        )}
        <span className="text-ink-900/12">|</span>
        <span className="font-mono text-xs text-ink-700/70">
          {client.custom_domain ?? clientSubdomainHost(client)}
        </span>
        <span className="text-ink-900/12">|</span>
        <span className="text-ink-700/60">
          {client.claimed_at ? `Claimed ${formatDate(client.claimed_at)}` : 'Not claimed'}
        </span>
      </div>

      <ClientTabs tabs={tabsForClient(client)} baseHref={`/admin/clients/${id}`} />

      {children}
    </div>
  );
}
