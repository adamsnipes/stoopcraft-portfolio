import { notFound } from 'next/navigation';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { FaviconUploader } from './FaviconUploader';
import { LogoUploader } from './LogoUploader';
import { DomainManager } from './DomainManager';
import { NotificationEmailPanel } from './NotificationEmailPanel';
import { StaticBundleUploader } from '../../static-sites/StaticBundleUploader';
import { getClient } from './client-data';
import { clientSubdomainHost } from '@/lib/marketing-brand';
import { Panel, btn } from '../../ui';

type VerificationRecord = {
  type: string;
  domain: string;
  value: string;
  reason: string;
};

type Params = Promise<{ id: string }>;

/**
 * Setup tab — the day-to-day surface: the site files, the domain, and where
 * leads get emailed. Everything this page used to stack below those now lives
 * behind its own tab; see ./client-data.ts for the tab list.
 */
export default async function ClientSetupPage({ params }: { params: Params }) {
  const { id } = await params;
  const client = await getClient(id);
  if (!client) notFound();

  const supabase = createServiceRoleClient();

  // Most recent domain provisioning event drives the status badge.
  // We don't track verification state on the client row itself — events are
  // the source of truth and survive domain changes for audit.
  const { data: lastDomainEvent } = await supabase
    .from('events')
    .select('type, metadata')
    .eq('client_id', id)
    .in('type', ['domain_provisioned', 'domain_removed'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const domainStatus: 'unset' | 'pending' | 'live' = !client.custom_domain
    ? 'unset'
    : lastDomainEvent?.type === 'domain_provisioned' &&
        (lastDomainEvent.metadata as { verified?: boolean } | null)?.verified === true
      ? 'live'
      : 'pending';

  const lastVerification =
    lastDomainEvent?.type === 'domain_provisioned'
      ? ((lastDomainEvent.metadata as { verification?: VerificationRecord[] } | null)
          ?.verification ?? null)
      : null;

  const siteUrl = client.custom_domain
    ? `https://${client.custom_domain}`
    : `https://${clientSubdomainHost(client)}`;

  // Static clients render an uploaded HTML bundle — the favicon and logo tools
  // only apply to template-rendered sites.
  const isStatic = client.render_mode === 'static';

  return (
    <div>
      {isStatic && (
        <Panel
          title="HTML site files"
          description={
            <>
              Replace the uploaded site — a single <code>.html</code> or a <code>.zip</code>{' '}
              (index.html + assets). Goes live immediately.
            </>
          }
        >
          <div className="flex items-center gap-2">
            <StaticBundleUploader clientId={id} />
            <a href={siteUrl} target="_blank" rel="noopener noreferrer" className={btn.secondarySm}>
              Preview
            </a>
          </div>
        </Panel>
      )}

      {!isStatic && (
        <>
          <Panel title="Favicon">
            <FaviconUploader clientId={id} currentUrl={client.favicon_url ?? null} />
          </Panel>
          <Panel title="Logo">
            <LogoUploader clientId={id} currentUrl={client.logo_url ?? null} />
          </Panel>
        </>
      )}

      <Panel title="Domain">
        <DomainManager
          clientId={id}
          initialDomain={client.custom_domain ?? null}
          initialOwner={client.domain_owner === 'client' ? 'client' : 'platform'}
          status={domainStatus}
          lastVerification={lastVerification}
          projectCname={process.env.VERCEL_PROJECT_CNAME ?? null}
          projectARecord={process.env.VERCEL_PROJECT_A_RECORD ?? null}
        />
      </Panel>

      {/* Lead notification email — set before payment so forms deliver leads
          during evaluation. Renders its own card. */}
      <NotificationEmailPanel clientId={id} currentEmail={client.notification_email ?? null} />
    </div>
  );
}
