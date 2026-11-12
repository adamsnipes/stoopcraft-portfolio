import type { Database } from '@dfy/db';
import type { createServiceRoleClient } from '@/lib/supabase/server';
import { revalidateClientSite } from '@/lib/revalidation';

type Admin = ReturnType<typeof createServiceRoleClient>;
type ClientUpdate = Database['public']['Tables']['clients']['Update'];

export type ClaimResult = {
  ownerUserId: string | null;
  isUpsell: boolean;
  client: { slug: string; custom_domain: string | null } | null;
};

/**
 * Apply a "paid customer" claim. Idempotent w.r.t. existing claims:
 * an already-claimed row keeps its original claimed_at / owner_user_id,
 * and only the supplied plan + Stripe IDs are written (the upsell case).
 * Caller owns event logging and source-specific dedupe (e.g. stripe_event_id).
 *
 * onUserCreateError='log' suits webhook callers (a missing user shouldn't
 * reject a paid checkout); 'throw' suits admin flows where the operator
 * needs to know the auth user wasn't created.
 */
export async function claimClient(
  admin: Admin,
  opts: {
    clientId: string;
    plan: string;
    email: string | null;
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
    onUserCreateError?: 'log' | 'throw';
  }
): Promise<ClaimResult> {
  const { data: existing } = await admin
    .from('clients')
    .select('status, owner_user_id, claimed_at, slug, custom_domain')
    .eq('id', opts.clientId)
    .single();

  // generateLink is create-or-find by email regardless of total user count
  // — Supabase's listUsers SDK has no email filter and only returns one
  // paginated page, so we always go through generateLink.
  let ownerUserId = existing?.owner_user_id ?? null;
  if (!ownerUserId && opts.email) {
    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: opts.email,
    });
    if (linkErr) {
      if (opts.onUserCreateError === 'throw') {
        throw new Error(`generateLink failed: ${linkErr.message}`);
      }
      console.error('claimClient generateLink failed', linkErr.message);
    }
    ownerUserId = linkData?.user?.id ?? null;
  }

  const isUpsell = existing?.status === 'claimed';
  const update: ClientUpdate = {
    plan: opts.plan,
    ...(opts.stripeCustomerId ? { stripe_customer_id: opts.stripeCustomerId } : {}),
    ...(opts.stripeSubscriptionId ? { stripe_subscription_id: opts.stripeSubscriptionId } : {}),
    // A subscription means they're paying again, so any recorded cancellation
    // is void. Left in place it keeps the site offline, and the hard-delete
    // cron removes a paying customer at the old date.
    ...(opts.stripeSubscriptionId
      ? { cancelled_at: null, expires_at: null, hard_delete_at: null }
      : {}),
  };
  if (!isUpsell) {
    update.status = 'claimed';
    update.claimed_at = existing?.claimed_at ?? new Date().toISOString();
  }
  // Outside the upsell check: a 'claimed' row with no owner can't serve at all.
  if (ownerUserId) update.owner_user_id = ownerUserId;

  await admin.from('clients').update(update).eq('id', opts.clientId);

  if (existing?.slug) {
    revalidateClientSite(existing.slug, existing.custom_domain ?? null);
  }

  return {
    ownerUserId,
    isUpsell,
    client: existing
      ? { slug: existing.slug, custom_domain: existing.custom_domain ?? null }
      : null,
  };
}
