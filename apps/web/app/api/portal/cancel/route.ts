import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthenticatedClient } from '@/lib/tenant';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { getStripe } from '@/lib/stripe';

const schema = z.object({
  reason: z.string().max(200).optional(),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  // client_id derived from session — NEVER from request body
  const ctx = await getAuthenticatedClient();
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'validation_failed' }, { status: 400 });
  }

  const { client } = ctx;

  if (!client.stripe_subscription_id) {
    return NextResponse.json({ error: 'no_subscription' }, { status: 400 });
  }

  const stripe = getStripe();

  // Cancel at period end (not immediately — customer keeps access until expires)
  const subscription = await stripe.subscriptions.update(client.stripe_subscription_id, {
    cancel_at_period_end: true,
  });

  const periodEndMs = subscription.cancel_at != null
    ? subscription.cancel_at * 1000
    : Date.now() + 30 * 24 * 60 * 60 * 1000;
  const expiresAt = new Date(periodEndMs).toISOString();
  const hardDeleteAt = new Date(periodEndMs + 60 * 24 * 60 * 60 * 1000).toISOString();

  const admin = createServiceRoleClient();

  await admin.from('clients').update({
    cancelled_at: new Date().toISOString(),
    expires_at: expiresAt,
    hard_delete_at: hardDeleteAt,
  }).eq('id', client.id);

  await admin.from('events').insert({
    client_id: client.id,
    user_id: ctx.userId,
    type: 'customer_cancel',
    metadata: {
      reason: parsed.data.reason ?? null,
      expires_at: expiresAt,
    },
  });

  return NextResponse.json({ success: true, expires_at: expiresAt });
}
