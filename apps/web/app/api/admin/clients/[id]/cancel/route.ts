import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server';
import { getStripe } from '@/lib/stripe';
import { revalidateClientSite } from '@/lib/revalidation';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  void req;
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const admin = createServiceRoleClient();

  const { data: client } = await admin
    .from('clients')
    .select('id, slug, custom_domain, stripe_subscription_id')
    .eq('id', id)
    .single();

  if (!client) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (!client.stripe_subscription_id) {
    return NextResponse.json({ error: 'no_subscription' }, { status: 400 });
  }

  const stripe = getStripe();
  const subscription = await stripe.subscriptions.update(client.stripe_subscription_id, {
    cancel_at_period_end: true,
  });

  // In Stripe API dahlia, period end is available via cancel_at (set when cancel_at_period_end=true)
  // or we compute 30 days out as a safe fallback
  const periodEndMs = subscription.cancel_at != null
    ? subscription.cancel_at * 1000
    : Date.now() + 30 * 24 * 60 * 60 * 1000;
  const expiresAt = new Date(periodEndMs).toISOString();
  const hardDeleteAt = new Date(periodEndMs + 60 * 24 * 60 * 60 * 1000).toISOString();

  await admin.from('clients').update({
    cancelled_at: new Date().toISOString(),
    expires_at: expiresAt,
    hard_delete_at: hardDeleteAt,
  }).eq('id', id);

  await admin.from('events').insert({
    client_id: id,
    type: 'admin_cancel',
    metadata: { admin: user.email, expires_at: expiresAt },
  });

  revalidateClientSite(client.slug, client.custom_domain);

  return NextResponse.json({ success: true, expires_at: expiresAt });
}
