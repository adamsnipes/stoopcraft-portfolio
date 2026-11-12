// Public endpoint backing the branded Starter checkout page (/pay/[id]).
// Creates a Stripe Checkout session for a specific client and returns its URL.
//
// Unlike the landing-page claim flow (/api/checkout/claim), this is meant to
// be handed out by an operator for an existing, already-generated client — so
// there's no claim_token / domain step here. The client UUID itself is the
// unguessable handle. We still bake client_id into the session metadata so the
// Stripe webhook can claim the site, create the account, and run provisioning.

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { createCheckoutSession } from '@/lib/stripe';
import { cheapBrandOrigin, isCheapBrandClient } from '@/lib/marketing-brand';
import { checkRateLimit, clientIpFromHeaders } from '@/lib/rate-limit';
import { checkHoneypot } from '@/lib/turnstile';
import {
  logFunnel,
  alertRateLimit,
  requestIdFromHeaders,
  geoFromHeaders,
} from '@/lib/funnel-log';

type RouteContext = { params: Promise<{ id: string }> };

// Email is optional — when omitted Stripe collects it on the checkout page and
// that address becomes authoritative for account creation (same as the claim
// flow). Honeypot field is accepted and checked but never required.
const inputSchema = z.object({
  email: z.string().email().max(200).optional(),
  // Only plans with a branded checkout page are accepted here.
  // Defaults to 'starter' so existing links (no plan field) are unchanged.
  plan: z.enum(['starter', 'biweekly', 'sms', 'scw']).default('starter'),
});

// Reuse the 'checkout' funnel flow; `source` distinguishes the branded page.
const FLOW = 'checkout' as const;
const RATE_LIMIT = { max: 5, windowMs: 60 * 60 * 1000 };

export async function POST(req: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const startedAt = Date.now();
  const { id } = await params;
  const ip = clientIpFromHeaders(req.headers);
  const request_id = requestIdFromHeaders(req.headers);
  const geo = geoFromHeaders(req.headers);

  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const limit = checkRateLimit(`pay-page:${ip}`, RATE_LIMIT);
  if (!limit.allowed) {
    logFunnel({ flow: FLOW, event: 'rate_limited', source: 'pay_page', ip, request_id, ...geo });
    if (limit.firstDenial) {
      alertRateLimit({
        flow: FLOW,
        ip,
        max: RATE_LIMIT.max,
        windowMs: RATE_LIMIT.windowMs,
        resetAt: limit.resetAt,
      });
    }
    return NextResponse.json(
      {
        error: 'rate_limited',
        retry_after_seconds: Math.max(1, Math.ceil((limit.resetAt - Date.now()) / 1000)),
      },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const parsed = inputSchema.safeParse(body);
  if (!parsed.success) {
    logFunnel({ flow: FLOW, event: 'validation_failed', source: 'pay_page', ip, request_id, ...geo, client_id: id });
    return NextResponse.json(
      { error: 'validation_failed', details: parsed.error.issues },
      { status: 400 },
    );
  }

  // Honeypot — cheap bot filter; no Turnstile to avoid blocking real payers.
  const abuse = checkHoneypot((body ?? {}) as Record<string, unknown>);
  if (!abuse.ok) {
    logFunnel({ flow: FLOW, event: 'honeypot_blocked', source: 'pay_page', ip, request_id, ...geo, client_id: id });
    return NextResponse.json({ error: 'abuse_blocked', reason: abuse.reason }, { status: 403 });
  }

  const admin = createServiceRoleClient();
  const { data: client } = await admin
    .from('clients')
    .select('id, status, owner_user_id, brand')
    .eq('id', id)
    .single();

  if (!client) {
    logFunnel({ flow: FLOW, event: 'error', source: 'pay_page', ip, request_id, ...geo, error: 'client_not_found', client_id: id });
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  // Already paying — don't let a stale link create a second subscription.
  if (client.status === 'claimed' || client.owner_user_id) {
    logFunnel({ flow: FLOW, event: 'already_claimed', source: 'pay_page', ip, request_id, ...geo, client_id: client.id });
    return NextResponse.json({ error: 'already_active' }, { status: 409 });
  }

  // A client's brand fixes its plan: Stupid Cheap Websites clients can only buy
  // the $40 plan and StoopCraft clients can never buy it, whatever the request
  // says. Success/cancel pages live on the brand's own domain.
  const cheapBrand = isCheapBrandClient(client.brand);
  if (cheapBrand !== (parsed.data.plan === 'scw')) {
    logFunnel({ flow: FLOW, event: 'validation_failed', source: 'pay_page', ip, request_id, ...geo, client_id: client.id, error: 'plan_brand_mismatch' });
    return NextResponse.json({ error: 'plan_brand_mismatch' }, { status: 400 });
  }

  const platformDomain = process.env.PLATFORM_DOMAIN ?? 'localhost:3000';
  const proto = platformDomain.startsWith('localhost') ? 'http' : 'https';
  const origin = cheapBrand ? cheapBrandOrigin() : `${proto}://${platformDomain}`;

  logFunnel({ flow: FLOW, event: 'start', source: 'pay_page', ip, request_id, ...geo, client_id: client.id });

  try {
    const url = await createCheckoutSession({
      clientId: client.id,
      plan: parsed.data.plan,
      email: parsed.data.email,
      successUrl: `${origin}/welcome?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: cheapBrand ? `${origin}/pay/${client.id}` : `${origin}/pay/${client.id}?plan=${parsed.data.plan}`,
    });
    const stripe_session_id = url.match(/\/(cs_[A-Za-z0-9_]+)/)?.[1] ?? null;
    logFunnel({
      flow: FLOW,
      event: 'ok',
      source: 'pay_page',
      ip,
      request_id,
      ...geo,
      ms: Date.now() - startedAt,
      client_id: client.id,
      stripe_session_id,
    });
    return NextResponse.json({ url });
  } catch (err) {
    console.error('pay-page createCheckoutSession failed', err);
    logFunnel({
      flow: FLOW,
      event: 'error',
      source: 'pay_page',
      ip,
      request_id,
      ...geo,
      ms: Date.now() - startedAt,
      error: 'checkout_failed',
      client_id: client.id,
    });
    return NextResponse.json({ error: 'checkout_failed' }, { status: 500 });
  }
}
