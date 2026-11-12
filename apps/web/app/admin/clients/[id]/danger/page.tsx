import { notFound } from 'next/navigation';
import { getClient } from '../client-data';
import { PauseClientButton } from '../../../PauseClientButton';
import { ResetClaimButton } from '../ResetClaimButton';
import { formatDate } from '../../../ui';

type Params = Promise<{ id: string }>;

/** Escalating border colors: yellow = reversible, orange = billing, red = final. */
function DangerBlock({
  title,
  tone,
  description,
  children,
}: {
  title: string;
  tone: 'yellow' | 'amber' | 'orange' | 'red';
  description: React.ReactNode;
  children: React.ReactNode;
}) {
  const borders = {
    yellow: 'border-yellow-300',
    amber: 'border-amber-300',
    orange: 'border-orange-300',
    red: 'border-red-300',
  } as const;

  return (
    <div className={`rounded-xl border bg-white p-5 ${borders[tone]}`}>
      <h2 className="font-medium">{title}</h2>
      <p className="mb-3 mt-1 text-sm leading-relaxed text-ink-700/80">{description}</p>
      {children}
    </div>
  );
}

export default async function DangerZonePage({ params }: { params: Params }) {
  const { id } = await params;
  const client = await getClient(id);
  if (!client) notFound();

  const hasClaimData =
    client.status === 'claimed' ||
    client.owner_user_id != null ||
    client.claimed_at != null ||
    client.stripe_subscription_id != null;

  return (
    <div>
      <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
        Actions here are destructive. Only hard delete asks for confirmation.
      </div>

      <div className="max-w-lg space-y-3">
        {/* Pause / kill switch */}
        <DangerBlock
          title="Pause site"
          tone="yellow"
          description={
            <>
              Sets status=paused. Within ~60s the site serves a branded “temporarily unavailable”
              page (HTTP 503). Data preserved; reversible.
            </>
          }
        >
          <PauseClientButton
            clientId={id}
            status={client.status}
            claimedAt={client.claimed_at}
            variant="block"
          />
        </DangerBlock>

        {/* Reset claim — for testing the claim flow */}
        {hasClaimData && (
          <DangerBlock
            title="Reset claim"
            tone="amber"
            description="Clears owner, plan, Stripe IDs, claim/cancel timestamps. Sets status=live so the claim flow can be re-tested. Content and photos are preserved."
          >
            <ResetClaimButton clientId={id} />
          </DangerBlock>
        )}

        {/* Cancel subscription */}
        {client.stripe_subscription_id && (
          <DangerBlock
            title="Cancel subscription"
            tone="orange"
            description="Cancels via Stripe at period end. Sets cancelled_at + expires_at. Site stays live until expires_at."
          >
            <form action={`/api/admin/clients/${id}/cancel`} method="POST">
              <button
                type="submit"
                className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-600"
              >
                Cancel subscription
              </button>
            </form>
          </DangerBlock>
        )}

        {/* Hard delete */}
        <DangerBlock
          title="Hard delete"
          tone="red"
          description={
            <>
              Permanently deletes all DB rows + R2 photos. Irreversible. Only use after the 60-day
              retention window.
              {client.hard_delete_at && (
                <span className="mt-1 block font-medium">
                  Scheduled hard delete: {formatDate(client.hard_delete_at)}
                </span>
              )}
            </>
          }
        >
          <form action={`/api/admin/clients/${id}/hard-delete`} method="POST">
            <button
              type="submit"
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700"
            >
              Permanently delete
            </button>
          </form>
        </DangerBlock>
      </div>
    </div>
  );
}
