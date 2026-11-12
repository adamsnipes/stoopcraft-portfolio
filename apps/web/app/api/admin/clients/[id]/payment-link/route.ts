import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server';
import { createCheckoutSession, type Plan } from '@/lib/stripe';
import { isSmsConfigured, normalizeUsPhone, sendSms } from '@/lib/sms';

type RouteContext = { params: Promise<{ id: string }> };

const inputSchema = z.object({
  plan: z.enum(['starter', 'biweekly', 'setup', 'setup_plus_maintenance', 'maintenance', 'sms']),
  phone: z.string().optional(),
  send_sms: z.boolean().optional(),
  // 'stripe' (default) returns a raw Stripe Checkout URL. 'page' returns the
  // branded /pay/[id] checkout page — supports the 'starter' and 'biweekly'
  // plans, which is more professional to text.
  link_type: z.enum(['stripe', 'page']).optional(),
});

async function assertAdmin(): Promise<string | null> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return null;
  return user.email === process.env.ADMIN_EMAIL ? user.email : null;
}

export async function POST(req: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  if (!(await assertAdmin())) {
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
  const { plan, send_sms, link_type = 'stripe' } = parsed.data;

  const admin = createServiceRoleClient();
  const { data: client } = await admin
    .from('clients')
    .select('id, business_name, phone')
    .eq('id', id)
    .single();
  if (!client) return NextResponse.json({ error: 'client_not_found' }, { status: 404 });

  const origin = req.headers.get('origin') ?? `https://${process.env.PLATFORM_DOMAIN}`;
  const successUrl = `${origin}/welcome?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${origin}/admin/clients/${id}`;

  let checkoutUrl: string;
  if (link_type === 'page') {
    // Branded checkout page — no Stripe session created here (the page's own
    // button does that when the customer subscribes). 'starter' uses the bare
    // URL; other branded plans carry ?plan= so the page charges the right price.
    checkoutUrl =
      plan === 'starter'
        ? `${origin}/pay/${client.id}`
        : `${origin}/pay/${client.id}?plan=${plan}`;
  } else {
    try {
      checkoutUrl = await createCheckoutSession({
        clientId: client.id,
        plan: plan as Plan,
        successUrl,
        cancelUrl,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown';
      return NextResponse.json({ error: 'stripe_failed', detail: message }, { status: 500 });
    }
  }

  let sms: { ok: boolean; sid?: string; error?: string } | undefined;
  if (send_sms) {
    if (!isSmsConfigured()) {
      sms = { ok: false, error: 'twilio_not_configured' };
    } else {
      const targetRaw = parsed.data.phone ?? client.phone ?? '';
      const target = normalizeUsPhone(targetRaw);
      if (!target) {
        sms = { ok: false, error: 'invalid_phone' };
      } else {
        const result = await sendSms({
          to: target,
          body: `${client.business_name} — secure payment link from StoopCraft: ${checkoutUrl}`,
        });
        sms = result.ok ? { ok: true, sid: result.sid } : { ok: false, error: result.error };
      }
    }
  }

  await admin.from('events').insert({
    client_id: client.id,
    type: 'payment_link_generated',
    metadata: { plan, link_type, sms_sent: sms?.ok === true, sms_error: sms?.error ?? null },
  });

  return NextResponse.json({ url: checkoutUrl, sms });
}
