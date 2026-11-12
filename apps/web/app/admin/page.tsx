import type { Metadata } from 'next';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { clientShortLinkOrigin, clientSubdomainHost } from '@/lib/marketing-brand';
import Link from 'next/link';
import { ClientRowActions } from './ClientRowActions';
import { ClientsFilters } from './ClientsFilters';
import { PayoutsDueBanner } from './PayoutsDueBanner';
import {
  Badge,
  Card,
  EmptyState,
  PageHeader,
  SortableTh,
  Stat,
  StatusDot,
  btn,
  formatDate,
  tdClass,
  thClass,
} from './ui';

export const metadata: Metadata = { title: 'Clients' };

const PAGE_SIZE = 50;

/** Query-param key → database column. Guards against arbitrary `?sort=` input. */
const SORT_COLUMNS = {
  business: 'business_name',
  status: 'status',
  plan: 'plan',
  created: 'created_at',
} as const;

type SortKey = keyof typeof SORT_COLUMNS;

/** Newest-first is the useful default for dates; A→Z for everything else. */
const DEFAULT_DIR: Record<SortKey, 'asc' | 'desc'> = {
  business: 'asc',
  status: 'asc',
  plan: 'asc',
  created: 'desc',
};

const PARAM_KEYS = ['q', 'status', 'plan', 'sort', 'dir', 'page'] as const;
type Params = Partial<Record<(typeof PARAM_KEYS)[number], string>>;

type SearchParams = Promise<Params>;

/** Rebuild the current URL with some params replaced. Empty values are dropped. */
function href(current: Params, overrides: Params): string {
  const merged = { ...current, ...overrides };
  const sp = new URLSearchParams();
  for (const key of PARAM_KEYS) {
    const value = merged[key];
    if (value) sp.set(key, value);
  }
  const qs = sp.toString();
  return qs ? `/admin?${qs}` : '/admin';
}

export default async function AdminDashboard({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const { status, plan, q, sort, dir } = params;
  const supabase = createServiceRoleClient();

  const sortKey: SortKey = sort && sort in SORT_COLUMNS ? (sort as SortKey) : 'created';
  const activeDir: 'asc' | 'desc' = dir === 'asc' || dir === 'desc' ? dir : DEFAULT_DIR[sortKey];
  const page = Math.max(1, Number.parseInt(params.page ?? '1', 10) || 1);
  const rangeFrom = (page - 1) * PAGE_SIZE;

  let query = supabase
    .from('clients')
    .select(
      'id, slug, short_code, status, plan, business_name, city, state, created_at, claimed_at, brand',
      { count: 'exact' },
    )
    .order(SORT_COLUMNS[sortKey], { ascending: activeDir === 'asc', nullsFirst: false })
    .range(rangeFrom, rangeFrom + PAGE_SIZE - 1);

  if (status) query = query.eq('status', status);
  if (plan) query = query.eq('plan', plan);
  if (q) query = query.ilike('business_name', `%${q}%`);

  // Portfolio-wide counts. These deliberately ignore the active filters and the
  // page window: deriving them from the fetched rows (as this page used to)
  // meant filtering to "paused" reported "0 live · 0 claimed", and any client
  // past the row limit simply vanished from the totals.
  const countAll = (s?: string) => {
    const c = supabase.from('clients').select('id', { count: 'exact', head: true });
    return s ? c.eq('status', s) : c;
  };

  // Vested commission across all reps — drives the "pay the reps" banner.
  // We don't query the next-payout date because the cadence is informal
  // (bi-weekly, admin-driven); the banner just nags when there's money owed.
  const nowIso = new Date().toISOString();

  const [listResult, totalResult, liveResult, claimedResult, vestedResult] = await Promise.all([
    query,
    countAll(),
    countAll('live'),
    countAll('claimed'),
    supabase
      .from('commission_ledger')
      .select('sales_rep_id, commission_cents')
      .eq('status', 'pending')
      .lte('vests_at', nowIso),
  ]);

  const platformDomain = process.env.PLATFORM_DOMAIN ?? 'localhost:3000';
  const protocol = platformDomain.startsWith('localhost') ? 'http' : 'https';
  // Brand clients' links live on the brand domain (clientShortLinkOrigin /
  // clientSubdomainHost), so the link a prospect gets never names the platform.

  // Precompute the preview URL/label once so the desktop table and the mobile
  // card list render from the same derived data instead of duplicating it.
  const rows = (listResult.data ?? []).map((c) => ({
    ...c,
    previewHref: c.short_code
      ? `${clientShortLinkOrigin(c.brand)}/s/${c.short_code}`
      : `${protocol}://${clientSubdomainHost(c)}`,
    previewLabel: c.short_code
      ? `${clientShortLinkOrigin(c.brand).replace(/^https?:\/\//, '')}/s/${c.short_code}`
      : clientSubdomainHost(c),
    location: [c.city, c.state].filter(Boolean).join(', '),
  }));

  const matched = listResult.count ?? rows.length;
  const lastPage = Math.max(1, Math.ceil(matched / PAGE_SIZE));
  const filterCount = [status, plan, q].filter(Boolean).length;

  const vestedRows = vestedResult.data ?? [];
  const vestedTotalCents = vestedRows.reduce((s, r) => s + r.commission_cents, 0);
  const vestedRepCount = new Set(vestedRows.map((r) => r.sales_rep_id)).size;

  const sortProps = (key: SortKey, label: string) => ({
    label,
    active: sortKey === key,
    dir: sortKey === key ? activeDir : DEFAULT_DIR[key],
    // Clicking the active column flips direction; a new column starts at its
    // natural default. Either way we jump back to page 1.
    href: href(params, {
      sort: key,
      dir: sortKey === key ? (activeDir === 'asc' ? 'desc' : 'asc') : DEFAULT_DIR[key],
      page: undefined,
    }),
  });

  return (
    <div>
      <PageHeader
        title="Clients"
        stats={
          <>
            <Stat value={totalResult.count ?? 0} label="total" />
            <Stat value={liveResult.count ?? 0} label="live" />
            <Stat value={claimedResult.count ?? 0} label="claimed" />
          </>
        }
        actions={
          <Link href="/admin/static-sites" className={btn.primary}>
            New site
          </Link>
        }
      />

      {vestedTotalCents > 0 && (
        <PayoutsDueBanner totalCents={vestedTotalCents} repCount={vestedRepCount} />
      )}

      <ClientsFilters values={{ q, status, plan, sort, dir }} activeCount={filterCount} />

      {/* Desktop table (md and up); mobile gets the card list below. */}
      <Card padded={false} className="hidden overflow-hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-ink-900/10 bg-cream-100/50">
              <tr>
                <SortableTh {...sortProps('business', 'Business')} />
                <th scope="col" className={thClass}>
                  Site
                </th>
                <SortableTh {...sortProps('status', 'Status')} />
                <SortableTh {...sortProps('plan', 'Plan')} />
                <SortableTh {...sortProps('created', 'Created')} />
                <th scope="col" className="w-10 px-2">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-900/[0.06]">
              {rows.map((c) => (
                <tr key={c.id} className="group transition-colors hover:bg-cream-100/50">
                  <td className={tdClass}>
                    <Link
                      href={`/admin/clients/${c.id}`}
                      className="font-medium transition-colors hover:text-amber-accent"
                    >
                      {c.business_name}
                    </Link>
                    {c.location && (
                      <span className="ml-2 text-xs text-ink-700/50">{c.location}</span>
                    )}
                  </td>
                  <td className={tdClass}>
                    <a
                      href={c.previewHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-xs text-ink-700/70 transition-colors hover:text-amber-accent"
                    >
                      {c.previewLabel}
                      <span aria-hidden className="ml-1 opacity-0 transition-opacity group-hover:opacity-60">
                        ↗
                      </span>
                    </a>
                  </td>
                  <td className={tdClass}>
                    <StatusDot status={c.status} />
                  </td>
                  <td className={tdClass}>
                    {c.plan ? (
                      <Badge className="capitalize">{c.plan.replace(/_/g, ' ')}</Badge>
                    ) : (
                      <span className="text-ink-700/30">—</span>
                    )}
                  </td>
                  <td className={`${tdClass} whitespace-nowrap text-xs text-ink-700/60`}>
                    {formatDate(c.created_at)}
                  </td>
                  <td className="px-2 py-2.5 text-right">
                    <ClientRowActions
                      clientId={c.id}
                      businessName={c.business_name}
                      status={c.status}
                      claimedAt={c.claimed_at}
                      previewHref={c.previewHref}
                    />
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6}>
                    <EmptyState
                      title="No clients match these filters."
                      hint={filterCount > 0 ? 'Try clearing one of them.' : undefined}
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {matched > 0 && (
          <Pagination page={page} lastPage={lastPage} matched={matched} rangeFrom={rangeFrom} shown={rows.length} params={params} />
        )}
      </Card>

      {/* Mobile card list (below md) — same derived rows, stacked. */}
      <div className="space-y-2.5 md:hidden">
        {rows.map((c) => (
          <Card key={c.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link
                  href={`/admin/clients/${c.id}`}
                  className="font-medium break-words transition-colors hover:text-amber-accent"
                >
                  {c.business_name}
                </Link>
                {c.location && <div className="text-xs text-ink-700/50">{c.location}</div>}
              </div>
              <ClientRowActions
                clientId={c.id}
                businessName={c.business_name}
                status={c.status}
                claimedAt={c.claimed_at}
                previewHref={c.previewHref}
              />
            </div>

            <a
              href={c.previewHref}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 block break-all font-mono text-xs text-ink-700/70"
            >
              {c.previewLabel}
            </a>

            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-ink-900/[0.06] pt-3 text-xs text-ink-700/60">
              <StatusDot status={c.status} />
              {c.plan && <Badge className="capitalize">{c.plan.replace(/_/g, ' ')}</Badge>}
              <span className="ml-auto whitespace-nowrap">{formatDate(c.created_at)}</span>
            </div>
          </Card>
        ))}
        {rows.length === 0 && (
          <Card padded={false}>
            <EmptyState
              title="No clients match these filters."
              hint={filterCount > 0 ? 'Try clearing one of them.' : undefined}
            />
          </Card>
        )}
        {matched > 0 && (
          <Card padded={false}>
            <Pagination page={page} lastPage={lastPage} matched={matched} rangeFrom={rangeFrom} shown={rows.length} params={params} />
          </Card>
        )}
      </div>
    </div>
  );
}

/** Range readout + prev/next. The list was previously capped at 100 rows with
 *  no way to reach anything past that. */
function Pagination({
  page,
  lastPage,
  matched,
  rangeFrom,
  shown,
  params,
}: {
  page: number;
  lastPage: number;
  matched: number;
  rangeFrom: number;
  shown: number;
  params: Params;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-ink-900/[0.06] px-4 py-2.5 text-xs text-ink-700/60">
      <span className="tabular-nums">
        {shown === 0 ? 0 : rangeFrom + 1}–{rangeFrom + shown} of {matched}
      </span>
      {lastPage > 1 && (
        <div className="flex items-center gap-1">
          <PageLink href={href(params, { page: page > 2 ? String(page - 1) : undefined })} disabled={page <= 1}>
            Previous
          </PageLink>
          <span className="px-1 tabular-nums">
            {page} / {lastPage}
          </span>
          <PageLink href={href(params, { page: String(page + 1) })} disabled={page >= lastPage}>
            Next
          </PageLink>
        </div>
      )}
    </div>
  );
}

function PageLink({
  href: to,
  disabled,
  children,
}: {
  href: string;
  disabled: boolean;
  children: React.ReactNode;
}) {
  if (disabled) {
    return <span className="rounded-md px-2 py-1 text-ink-700/25">{children}</span>;
  }
  return (
    <Link
      href={to}
      className="rounded-md px-2 py-1 font-medium text-ink-700 transition-colors hover:bg-ink-900/5 hover:text-ink-900"
    >
      {children}
    </Link>
  );
}
