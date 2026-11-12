import Link from 'next/link';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { NewStaticSiteForm } from './NewStaticSiteForm';
import { StaticBundleUploader } from './StaticBundleUploader';
import { Card, EmptyState, PageHeader, SectionHeading, StatusDot, btn } from '../ui';

export const dynamic = 'force-dynamic';

export default async function StaticSitesPage() {
  const admin = createServiceRoleClient();
  const { data: sites } = await admin
    .from('clients')
    .select('id, slug, business_name, status, custom_domain, claim_token')
    .eq('render_mode', 'static')
    .order('created_at', { ascending: false });

  return (
    <div>
      <PageHeader
        title="HTML Sites"
        description={
          <>
            Upload a hand-authored HTML site (single <code>.html</code> or a <code>.zip</code> with
            an <code>assets/</code> folder). It becomes a normal client — plug in a domain, take
            payment, and activate it from its client page just like a generated site.
          </>
        }
      />

      <Card className="mb-8">
        <SectionHeading>New site</SectionHeading>
        <NewStaticSiteForm />
      </Card>

      <SectionHeading count={sites?.length ?? 0}>Existing</SectionHeading>
      <div className="space-y-2.5">
        {!sites?.length && (
          <Card padded={false}>
            <EmptyState title="No HTML sites yet." hint="Create one above to get started." />
          </Card>
        )}
        {sites?.map((s) => (
          <Card key={s.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="truncate font-medium">{s.business_name}</div>
              <div className="mt-0.5 flex items-center gap-2">
                <span className="truncate font-mono text-xs text-ink-700/60">
                  {s.custom_domain ?? s.slug}
                </span>
                <span className="text-ink-900/15">·</span>
                <StatusDot status={s.status} />
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Link
                href={`/h/${s.slug}/${s.claim_token ? `?t=${s.claim_token}` : ''}`}
                target="_blank"
                className={btn.secondarySm}
              >
                Preview
              </Link>
              <Link href={`/admin/clients/${s.id}`} className={btn.secondarySm}>
                Manage
              </Link>
              <StaticBundleUploader clientId={s.id} />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
