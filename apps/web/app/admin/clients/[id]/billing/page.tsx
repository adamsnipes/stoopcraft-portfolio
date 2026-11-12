import { notFound } from 'next/navigation';
import { getClient } from '../client-data';
import { SubscriptionRecoveryPanel } from '../SubscriptionRecoveryPanel';
import { PaymentLinkPanel } from '../PaymentLinkPanel';
import { MarkPaidCashPanel } from '../MarkPaidCashPanel';
import { ClaimBannerPanel } from '../ClaimBannerPanel';
import { SalesBrandPanel } from '../SalesBrandPanel';
import { cheapBrandOrigin, isCheapBrandClient } from '@/lib/marketing-brand';
import { Panel, formatDate } from '../../../ui';

type Params = Promise<{ id: string }>;

/**
 * Billing tab — subscription facts plus every way money gets collected.
 * The payment-link / mark-paid-cash / claim-banner panels used to sit in the
 * middle of the detail page's panel stack, nowhere near this data.
 */
export default async function BillingPage({ params }: { params: Params }) {
  const { id } = await params;
  const client = await getClient(id);
  if (!client) notFound();

  const facts: { label: string; value: string; mono?: boolean }[] = [
    { label: 'Plan', value: client.plan ?? '—' },
    { label: 'Status', value: client.status },
    { label: 'Stripe customer', value: client.stripe_customer_id ?? '—', mono: true },
    { label: 'Subscription', value: client.stripe_subscription_id ?? '—', mono: true },
    ...(client.cancelled_at
      ? [{ label: 'Cancelled at', value: formatDate(client.cancelled_at) }]
      : []),
    ...(client.expires_at
      ? [{ label: 'Access until', value: formatDate(client.expires_at) }]
      : []),
  ];

  return (
    <div>
      <Panel title="Subscription">
        <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
          {facts.map((f) => (
            <div key={f.label}>
              <dt className="text-xs text-ink-700/55">{f.label}</dt>
              <dd className={`mt-0.5 font-medium ${f.mono ? 'break-all font-mono text-xs' : ''}`}>
                {f.value}
              </dd>
            </div>
          ))}
        </dl>

        {client.stripe_customer_id && (
          <div className="mt-4 border-t border-ink-900/[0.06] pt-4">
            <a
              href={`https://dashboard.stripe.com/customers/${client.stripe_customer_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-amber-accent hover:underline"
            >
              View in Stripe Dashboard ↗
            </a>
          </div>
        )}
      </Panel>

      <SubscriptionRecoveryPanel clientId={id} />

      <SalesBrandPanel
        clientId={id}
        currentBrand={client.brand ?? 'stoopcraft'}
        status={client.status}
        cheapPayUrl={`${cheapBrandOrigin()}/pay/${id}`}
      />

      {/* StoopCraft prices and SMS links; never offered to a SCW client. */}
      {!isCheapBrandClient(client.brand) && (
        <PaymentLinkPanel clientId={id} defaultPhone={client.phone ?? null} />
      )}

      {/* Cash / off-Stripe payment — only relevant before claim. */}
      {client.status !== 'claimed' && <MarkPaidCashPanel clientId={id} />}

      {/* Claim banner drives unclaimed previews straight to checkout. */}
      <ClaimBannerPanel
        clientId={id}
        currentHidden={client.hide_claim_banner ?? false}
        status={client.status}
      />
    </div>
  );
}
