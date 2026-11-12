import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type Stripe from 'stripe';
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server';
import { getStripe } from '@/lib/stripe';
import { claimClient } from '@/lib/claim';
import { subscriptionLinkBlocker, type SubscriptionLinkBlocker } from '@/lib/cancellation';
import { getStaticObject } from '@/lib/r2/static-site';

// ============================================================================
// Stripe can't revive a canceled subscription, so reactivating a client by hand
// usually means a NEW subscription with a new id and no client_id metadata. No
// webhook can tie that back to a client, and their site stays offline with the
// hard-delete date still running. The admin Billing tab uses this route to find
// the subscription in Stripe (GET) and link it to the client (POST).
// ============================================================================

type RouteContext = { params: Promise<{ id: string }> };

export type SubscriptionSummary = {
  id: string;
  customerId: string;
  status: string;
  price: string;
  startedAt: string;
  cancelAt: string | null;
  /** The subscription this client is linked to now. */
  current: boolean;
  blocker: SubscriptionLinkBlocker | null;
};

export type SubscriptionCheck = {
  client: {
    status: string;
    customerId: string | null;
    hasOwner: boolean;
    cancelledAt: string | null;
    expiresAt: string | null;
    hardDeleteAt: string | null;
  };
  /** Whether the uploaded bundle is still in storage. Null for template sites. */
  siteFilesPresent: boolean | null;
  subscriptions: SubscriptionSummary[];
};

const CLIENT_COLUMNS =
  'id, slug, status, plan, render_mode, owner_user_id, cancelled_at, expires_at, hard_delete_at, stripe_customer_id, stripe_subscription_id';

const lookupSchema = z.string().regex(/^(cus|sub)_[A-Za-z0-9]+$/);
const inputSchema = z.object({ subscription_id: z.string().regex(/^sub_[A-Za-z0-9]+$/) });

async function assertAdmin(): Promise<string | null> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return null;
  return user.email === process.env.ADMIN_EMAIL ? user.email : null;
}

function isMissingInStripe(err: unknown): boolean {
  return (err as { code?: string }).code === 'resource_missing';
}

function priceLabel(item: Stripe.SubscriptionItem): string {
  const { unit_amount, currency, recurring } = item.price;
  const amount = (((unit_amount ?? 0) * (item.quantity ?? 1)) / 100).toLocaleString('en-US', {
    style: 'currency',
    currency,
  });
  if (!recurring) return amount;
  const every = recurring.interval_count > 1
    ? `${recurring.interval_count} ${recurring.interval}s`
    : recurring.interval;
  return `${amount}/${every}`;
}

function customerIdOf(sub: Stripe.Subscription): string {
  return typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
}

export async function GET(req: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  if (!(await assertAdmin())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const admin = createServiceRoleClient();
  const { data: client } = await admin.from('clients').select(CLIENT_COLUMNS).eq('id', id).single();
  if (!client) return NextResponse.json({ error: 'client_not_found' }, { status: 404 });

  // Pasted id, for a subscription under a customer this client isn't linked to.
  const rawLookup = req.nextUrl.searchParams.get('stripe')?.trim() || null;
  const lookup = rawLookup ? lookupSchema.safeParse(rawLookup) : null;
  if (lookup && !lookup.success) {
    return NextResponse.json({ error: 'invalid_stripe_id' }, { status: 400 });
  }

  const stripe = getStripe();
  let subscriptions: Stripe.Subscription[] = [];
  try {
    if (lookup?.data?.startsWith('sub_')) {
      subscriptions = [await stripe.subscriptions.retrieve(lookup.data)];
    } else {
      const customer = lookup?.data ?? client.stripe_customer_id;
      if (customer) {
        const listed = await stripe.subscriptions.list({ customer, status: 'all', limit: 20 });
        subscriptions = listed.data;
      }
    }
  } catch (err) {
    if (isMissingInStripe(err)) {
      return NextResponse.json({ error: 'not_found_in_stripe' }, { status: 404 });
    }
    const detail = err instanceof Error ? err.message : 'unknown';
    return NextResponse.json({ error: 'stripe_failed', detail }, { status: 502 });
  }

  const check: SubscriptionCheck = {
    client: {
      status: client.status,
      customerId: client.stripe_customer_id,
      hasOwner: !!client.owner_user_id,
      cancelledAt: client.cancelled_at,
      expiresAt: client.expires_at,
      hardDeleteAt: client.hard_delete_at,
    },
    siteFilesPresent:
      client.render_mode === 'static' ? (await getStaticObject(client.slug, '')) !== null : null,
    subscriptions: subscriptions.map((sub) => ({
      id: sub.id,
      customerId: customerIdOf(sub),
      status: sub.status,
      price: sub.items.data.map(priceLabel).join(' + '),
      startedAt: new Date(sub.start_date * 1000).toISOString(),
      cancelAt: sub.cancel_at ? new Date(sub.cancel_at * 1000).toISOString() : null,
      current: sub.id === client.stripe_subscription_id,
      blocker: subscriptionLinkBlocker(sub, id),
    })),
  };

  return NextResponse.json(check);
}

export async function POST(req: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const adminEmail = await assertAdmin();
  if (!adminEmail) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const parsed = inputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'validation_failed', details: parsed.error.issues }, { status: 400 });
  }

  const admin = createServiceRoleClient();
  const { data: client } = await admin.from('clients').select(CLIENT_COLUMNS).eq('id', id).single();
  if (!client) return NextResponse.json({ error: 'client_not_found' }, { status: 404 });

  // Re-read from Stripe rather than trusting what the check showed the browser.
  const stripe = getStripe();
  let sub: Stripe.Subscription;
  try {
    sub = await stripe.subscriptions.retrieve(parsed.data.subscription_id, { expand: ['customer'] });
  } catch (err) {
    if (isMissingInStripe(err)) {
      return NextResponse.json({ error: 'not_found_in_stripe' }, { status: 404 });
    }
    const detail = err instanceof Error ? err.message : 'unknown';
    return NextResponse.json({ error: 'stripe_failed', detail }, { status: 502 });
  }

  const blocker = subscriptionLinkBlocker(sub, id);
  if (blocker) return NextResponse.json({ error: blocker }, { status: 409 });

  // Refuse a subscription or customer another client already holds. invoice.paid
  // finds its client by customer id, so sharing one would misroute commissions.
  // Ids are regex-checked or came from Stripe, so they're safe in the filter.
  const customerId = customerIdOf(sub);
  const conflicts = [`stripe_subscription_id.eq.${sub.id}`];
  if (customerId !== client.stripe_customer_id) conflicts.push(`stripe_customer_id.eq.${customerId}`);
  const { data: others } = await admin
    .from('clients')
    .select('id')
    .or(conflicts.join(','))
    .neq('id', id)
    .limit(1);
  if (others && others.length > 0) {
    return NextResponse.json({ error: 'other_client' }, { status: 409 });
  }

  const plan = sub.metadata['plan'] || client.plan;
  if (!plan) return NextResponse.json({ error: 'plan_unknown' }, { status: 409 });

  // Stamp the subscription so its future webhook events reach this client. A
  // subscription made by hand in Stripe has neither key, so without this its
  // eventual cancellation would never reach us.
  if (sub.metadata['client_id'] !== id || sub.metadata['plan'] !== plan) {
    try {
      await stripe.subscriptions.update(sub.id, { metadata: { client_id: id, plan } });
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'unknown';
      return NextResponse.json({ error: 'stripe_failed', detail }, { status: 502 });
    }
  }

  const customer = typeof sub.customer === 'object' && !sub.customer.deleted ? sub.customer : null;
  try {
    await claimClient(admin, {
      clientId: id,
      plan,
      email: customer?.email ?? null,
      stripeCustomerId: customerId,
      stripeSubscriptionId: sub.id,
      onUserCreateError: 'throw',
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'unknown';
    return NextResponse.json({ error: 'user_create_failed', detail }, { status: 500 });
  }

  // claimClient doesn't surface a failed write, and a false "reactivated" here
  // would leave a paying client offline with the delete date still running.
  const { data: after } = await admin.from('clients').select(CLIENT_COLUMNS).eq('id', id).single();
  if (!after || after.stripe_subscription_id !== sub.id || after.cancelled_at || after.hard_delete_at) {
    return NextResponse.json({ error: 'update_failed' }, { status: 500 });
  }
  if (!after.owner_user_id) {
    return NextResponse.json({ error: 'no_owner' }, { status: 409 });
  }

  await admin.from('events').insert({
    client_id: id,
    type: 'admin_subscription_reactivated',
    metadata: {
      admin: adminEmail,
      subscription_id: sub.id,
      stripe_customer: customerId,
      previous_subscription_id: client.stripe_subscription_id,
      previous_status: client.status,
      previous_cancelled_at: client.cancelled_at,
      previous_hard_delete_at: client.hard_delete_at,
    },
  });

  return NextResponse.json({ success: true });
}
