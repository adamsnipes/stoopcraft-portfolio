import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server';
import { createCheckoutSession, type Plan } from '@/lib/stripe';

const onboardingSchema = z.object({
  plan: z.enum(['starter', 'pro']),
  agreed_to_terms: z.literal(true),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const parsed = onboardingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'validation_failed', details: parsed.error.issues }, { status: 400 });
  }

  const data = parsed.data;

  // client_id derived from session — NEVER from request body
  const admin = createServiceRoleClient();
  const { data: client } = await admin
    .from('clients')
    .select('id, slug')
    .eq('owner_user_id', user.id)
    .single();

  if (!client) return NextResponse.json({ error: 'client_not_found' }, { status: 404 });

  const origin = req.headers.get('origin') ?? `https://${process.env.PLATFORM_DOMAIN}`;

  const checkoutUrl = await createCheckoutSession({
    clientId: client.id,
    plan: data.plan as Plan,
    email: user.email!,
    successUrl: `${origin}/portal?onboarding=complete`,
    cancelUrl: `${origin}/onboarding`,
  });

  await admin.from('events').insert({
    client_id: client.id,
    user_id: user.id,
    type: 'onboarding_started',
    metadata: { plan: data.plan },
  });

  return NextResponse.json({ checkout_url: checkoutUrl });
}
