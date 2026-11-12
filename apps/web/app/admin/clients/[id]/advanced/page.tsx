import { notFound } from 'next/navigation';
import { getClient } from '../client-data';
import { redirectsToText } from '@/lib/static-sites/redirects';
import { RedirectsPanel } from '../RedirectsPanel';
import { CopyClaimLink } from '../CopyClaimLink';
import { SendWelcomeButton } from '../SendWelcomeButton';
import { PauseClientButton } from '../../../PauseClientButton';
import { Panel, btn } from '../../../ui';

type Params = Promise<{ id: string }>;

/**
 * Advanced tab — the operational levers that get pulled once per client
 * (go-live, revalidate, welcome email, claim link) plus static-site redirects.
 * Reset claim and hard delete stay on Danger Zone rather than being duplicated.
 */
export default async function ClientAdvancedPage({ params }: { params: Params }) {
  const { id } = await params;
  const client = await getClient(id);
  if (!client) notFound();

  const platformDomain = process.env.PLATFORM_DOMAIN ?? 'localhost:3000';
  const protocol = platformDomain.startsWith('localhost') ? 'http' : 'https';
  const claimLink = client.claim_token
    ? `${protocol}://${platformDomain}/claim/${client.claim_token}`
    : null;

  const isStatic = client.render_mode === 'static';

  return (
    <div>
      {/* 301 redirects — uploaded HTML sites only. */}
      {isStatic && (
        <RedirectsPanel clientId={id} currentText={redirectsToText(client.redirects)} />
      )}

      <Panel
        title="Quick actions"
        description="Status changes take effect after revalidation (~60s), or immediately with force-revalidate."
      >
        <div className="flex flex-wrap gap-2">
          <form action={`/api/admin/clients/${id}`} method="POST">
            <input type="hidden" name="_method" value="PATCH" />
            <input type="hidden" name="status" value="live" />
            <button type="submit" className={btn.secondary}>
              Set live
            </button>
          </form>

          <PauseClientButton
            clientId={id}
            status={client.status}
            claimedAt={client.claimed_at}
            variant="quiet"
          />

          <form action="/api/admin/revalidate" method="POST">
            <input type="hidden" name="client_id" value={id} />
            <button type="submit" className={btn.secondary}>
              Force revalidate
            </button>
          </form>

          <SendWelcomeButton
            clientId={id}
            disabled={client.status !== 'claimed'}
            disabledReason={
              client.status !== 'claimed'
                ? 'Customer must be claimed (paid) before welcome email'
                : undefined
            }
          />
        </div>
      </Panel>

      {claimLink && !client.owner_user_id && (
        <Panel
          title="Claim link"
          description="Send this to the customer to claim and pay for the site."
        >
          <CopyClaimLink url={claimLink} />
        </Panel>
      )}
    </div>
  );
}
