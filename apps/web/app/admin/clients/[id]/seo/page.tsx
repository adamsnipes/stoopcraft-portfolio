import { notFound } from 'next/navigation';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { clientSubdomainHost } from '@/lib/marketing-brand';
import { SeoReportPanel } from './SeoReportPanel';

type Params = Promise<{ id: string }>;

export const dynamic = 'force-dynamic';

export default async function SeoPage({ params }: { params: Params }) {
  const { id } = await params;
  const supabase = createServiceRoleClient();

  const { data: client } = await supabase
    .from('clients')
    .select('id, business_name, slug, custom_domain, gsc_property, brand')
    .eq('id', id)
    .single();
  if (!client) notFound();

  // Most recent send of any kind (test or real) — shown next to the link so the
  // operator doesn't double-report a client during a manual pass.
  const { data: lastSend } = await supabase
    .from('events')
    .select('created_at')
    .eq('client_id', id)
    .eq('type', 'seo_report_sent')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <div>
      <h2 className="font-display text-lg font-medium">Google search report</h2>
      <p className="mb-5 mt-1 text-sm text-ink-700/70">
        Pulls Search Console data for this client, renders the client-facing email, and sends it when you say so.
        Nothing goes out on a schedule.
      </p>

      <SeoReportPanel
        clientId={client.id}
        clientDomain={client.custom_domain ?? clientSubdomainHost(client)}
        initialProperty={client.gsc_property}
        lastSentAt={lastSend?.created_at ?? null}
      />
    </div>
  );
}
