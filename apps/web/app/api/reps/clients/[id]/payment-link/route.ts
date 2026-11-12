// Mint a fresh Stripe Checkout link for an existing rep-attributed client.
// Used from /reps/customers when the rep needs to send a "click here to pay"
// link to a prospect after the site was generated earlier. Scoped by
// sales_rep_id so a rep can only generate links for their own customers.

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedRep } from '@/lib/sales-rep/auth';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { createCheckoutSession } from '@/lib/stripe';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const ctx = await getAuthenticatedRep();
  if (!ctx || ctx.rep.status !== 'active') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const { id } = await params;

  const admin = createServiceRoleClient();
  const { data: client } = await admin
    .from('clients')
    .select('id, slug, status, sales_rep_id')
    .eq('id', id)
    .eq('sales_rep_id', ctx.rep.id)
    .maybeSingle();
  if (!client) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (client.status === 'claimed') {
    return NextResponse.json({ error: 'already_claimed' }, { status: 409 });
  }

  const platformDomain = process.env.PLATFORM_DOMAIN ?? 'localhost:3000';
  const proto = platformDomain.startsWith('localhost') ? 'http' : 'https';

  try {
    const url = await createCheckoutSession({
      clientId: client.id,
      plan: 'starter',
      successUrl: `${proto}://${platformDomain}/welcome?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${proto}://${client.slug}.${platformDomain}`,
    });
    return NextResponse.json({ url });
  } catch (err) {
    return NextResponse.json(
      { error: 'stripe_failed', detail: err instanceof Error ? err.message : 'unknown' },
      { status: 500 },
    );
  }
}
