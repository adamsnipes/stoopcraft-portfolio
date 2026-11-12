import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getAuthenticatedClient } from '@/lib/tenant';

export const metadata: Metadata = { title: "Billing" };
import { createPortalSession } from '@/lib/stripe';

export default async function BillingPage() {
  const ctx = await getAuthenticatedClient();
  if (!ctx) return null;

  const { client } = ctx;
  const platformDomain = process.env.PLATFORM_DOMAIN ?? 'stoopcraft.com';
  const protocol = platformDomain.startsWith('localhost') ? 'http' : 'https';
  const returnUrl = `${protocol}://${platformDomain}/portal`;

  if (client.stripe_customer_id) {
    const portalUrl = await createPortalSession({
      stripeCustomerId: client.stripe_customer_id,
      returnUrl,
    });
    redirect(portalUrl);
  }

  // No Stripe customer yet (pre-payment)
  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Billing</h1>
      <p className="text-gray-600">
        You don&apos;t have an active subscription yet.{' '}
        <a href="/onboarding" className="underline">Start your subscription</a>
      </p>
    </div>
  );
}
