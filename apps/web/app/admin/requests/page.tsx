import type { Metadata } from 'next';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { RequestStatusForm } from './RequestStatusForm';
import Link from 'next/link';
import { Badge, Card, EmptyState, PageHeader, type Tone } from '../ui';

export const metadata: Metadata = { title: 'Requests' };

type SearchParams = Promise<{ status?: string }>;

const TABS = ['all', 'open', 'in_progress', 'done', 'declined'] as const;

const STATUS_TONE: Record<string, Tone> = {
  open: 'accent',
  in_progress: 'amber',
  done: 'green',
  declined: 'neutral',
};

export default async function RequestsInboxPage({ searchParams }: { searchParams: SearchParams }) {
  const { status } = await searchParams;
  const activeTab = status ?? 'open';
  const supabase = createServiceRoleClient();

  const baseQuery = supabase
    .from('requests')
    .select('*, clients(business_name, slug)')
    .order('created_at', { ascending: false })
    .limit(100);

  const { data: requests } = await (
    activeTab === 'all' ? baseQuery : baseQuery.eq('status', activeTab)
  );

  return (
    <div>
      <PageHeader
        title="Change Requests"
        description="Edit requests submitted by clients from their portal or site."
      />

      <div className="mb-5 flex flex-wrap gap-1.5">
        {TABS.map((s) => (
          <Link
            key={s}
            href={`/admin/requests?status=${s}`}
            aria-current={activeTab === s ? 'page' : undefined}
            className={`rounded-full px-3.5 py-1.5 text-sm capitalize transition-colors ${
              activeTab === s
                ? 'bg-ink-900 font-medium text-cream-50'
                : 'text-ink-700 ring-1 ring-inset ring-ink-900/10 hover:bg-ink-900/5 hover:text-ink-900'
            }`}
          >
            {s.replace('_', ' ')}
          </Link>
        ))}
      </div>

      <div className="space-y-2.5">
        {(requests ?? []).map((req) => {
          const client = req.clients as { business_name: string; slug: string } | null;
          return (
            <Card key={req.id} className="p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <div className="min-w-0 flex-1">
                  <div className="mb-1.5 flex flex-wrap items-center gap-2">
                    {client && (
                      <Link
                        href={`/admin/clients/${req.client_id}`}
                        className="font-medium transition-colors hover:text-amber-accent"
                      >
                        {client.business_name}
                      </Link>
                    )}
                    <span className="text-xs text-ink-700/50">
                      {new Date(req.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}{' '}
                      · {req.source}
                    </span>
                    {activeTab === 'all' && (
                      <Badge tone={STATUS_TONE[req.status] ?? 'neutral'} className="capitalize">
                        {req.status.replace('_', ' ')}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm leading-relaxed text-ink-700">{req.body}</p>
                  {req.resolution_notes && (
                    <p className="mt-2 text-xs text-ink-700/60">Note: {req.resolution_notes}</p>
                  )}
                </div>

                <RequestStatusForm requestId={req.id} currentStatus={req.status} />
              </div>
            </Card>
          );
        })}
        {(requests ?? []).length === 0 && (
          <Card padded={false}>
            <EmptyState
              title={`No ${activeTab === 'all' ? '' : `"${activeTab.replace('_', ' ')}" `}requests.`}
            />
          </Card>
        )}
      </div>
    </div>
  );
}
