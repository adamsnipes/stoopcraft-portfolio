// Public endpoint that creates a Stripe Checkout session for a customer
// claiming a freshly-generated site. Gated by claim_token so randoms can't
// trigger checkout against arbitrary client IDs.
//
// The domain question is captured here and forwarded into Stripe metadata
// so the webhook can act on it: 'have' → set custom_domain immediately,
// 'need' → operator queue.

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { createCheckoutSession } from '@/lib/stripe';
import { checkRateLimit, clientIpFromHeaders } from '@/lib/rate-limit';
import { checkHoneypot } from '@/lib/turnstile';
import {
  logFunnel,
  alertRateLimit,
  requestIdFromHeaders,
  geoFromHeaders,
} from '@/lib/funnel-log';

const baseSchema = {
  client_id: z.string().uuid(),
  claim_token: z.string().min(1).max(200),
  email: z.string().email().max(200),
  website: z.string().nullish(),
  // Client-generated UUID stable across the visitor's funnel session. Also
  // sent into Stripe metadata so the webhook + subscription events surface
  // it in Axiom logs.
  funnel_session_id: z.string().uuid().nullish(),
};

// Discriminated by domain_choice — the requested_domain is only required
// (and only meaningful) for 'have' or 'need'.
const inputSchema = z.discriminatedUnion('domain_choice', [
  z.object({
    ...baseSchema,
    domain_choice: z.literal('have'),
    requested_domain: z
      .string()
      .trim()
      .toLowerCase()
      .min(4)
      .max(253)
      .regex(/^[a-z0-9.-]+\.[a-z]{2,}$/, 'must be a valid domain'),
  }),
  z.object({
    ...baseSchema,
    domain_choice: z.literal('need'),
    requested_domain: z
      .string()
      .trim()
      .toLowerCase()
      .min(4)
      .max(63)
      .regex(/^[a-z0-9-]+\.com$/, 'must be a plain .com'),
  }),
]);

const FLOW = 'checkout' as const;
const RATE_LIMIT = { max: 5, windowMs: 60 * 60 * 1000 };

export async function POST(req: NextRequest): Promise<NextResponse> {
  const startedAt = Date.now();
  const ip = clientIpFromHeaders(req.headers);
  const request_id = requestIdFromHeaders(req.headers);
  const geo = geoFromHeaders(req.headers);

  const limit = checkRateLimit(`checkout-claim:${ip}`, RATE_LIMIT);
  if (!limit.allowed) {
    logFunnel({ flow: FLOW, event: 'rate_limited', ip, request_id, ...geo });
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
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const parsed = inputSchema.safeParse(body);
  if (!parsed.success) {
    logFunnel({ flow: FLOW, event: 'validation_failed', ip, request_id, ...geo });
    return NextResponse.json(
      { error: 'validation_failed', details: parsed.error.issues },
      { status: 400 },
    );
  }

  const funnel_session_id = parsed.data.funnel_session_id ?? null;

  // Honeypot only — claim is already gated by claim_token possession (only
  // handed out by a successful /api/generate). Adding Turnstile here would
  // block real customers at the pay button if the widget refresh failed,
  // which is a 100% lost sale.
  const abuse = checkHoneypot(parsed.data as Record<string, unknown>);
  if (!abuse.ok) {
    logFunnel({
      flow: FLOW,
      event: 'honeypot_blocked',
      ip,
      request_id,
      ...geo,
      funnel_session_id,
    });
    return NextResponse.json(
      { error: 'abuse_blocked', reason: abuse.reason },
      { status: 403 },
    );
  }

  logFunnel({
    flow: FLOW,
    event: 'start',
    ip,
    request_id,
    ...geo,
    funnel_session_id,
    client_id: parsed.data.client_id,
    domain_choice: parsed.data.domain_choice,
  });

  // Verify the claim_token belongs to the client and the client is still
  // unclaimed. This is what stops abuse where someone POSTs an arbitrary
  // client_id to start a checkout against a site they don't own.
  const admin = createServiceRoleClient();
  const { data: client } = await admin
    .from('clients')
    .select('id, status, owner_user_id, business_name')
    .eq('id', parsed.data.client_id)
    .eq('claim_token', parsed.data.claim_token)
    .single();

  if (!client) {
    logFunnel({
      flow: FLOW,
      event: 'error',
      ip,
      request_id,
      ...geo,
      funnel_session_id,
      error: 'invalid_claim_token',
      client_id: parsed.data.client_id,
    });
    return NextResponse.json({ error: 'invalid_claim_token' }, { status: 404 });
  }

  if (client.status === 'claimed' || client.owner_user_id) {
    logFunnel({
      flow: FLOW,
      event: 'already_claimed',
      ip,
      request_id,
      ...geo,
      funnel_session_id,
      client_id: client.id,
    });
    return NextResponse.json({ error: 'already_claimed' }, { status: 409 });
  }

  const platformDomain = process.env.PLATFORM_DOMAIN ?? 'localhost:3000';
  const proto = platformDomain.startsWith('localhost') ? 'http' : 'https';

  try {
    const url = await createCheckoutSession({
      clientId: client.id,
      plan: 'starter',
      email: parsed.data.email,
      successUrl: `${proto}://${platformDomain}/?claim_success=${client.id}`,
      cancelUrl: `${proto}://${platformDomain}/?claim_cancelled=${client.id}`,
      domainChoice: parsed.data.domain_choice,
      requestedDomain: parsed.data.requested_domain,
      funnelSessionId: funnel_session_id,
    });
    // Extract the Stripe Checkout Session ID (cs_xxx...) from the URL so
    // we can correlate the funnel log line to the Stripe dashboard /
    // webhook events without logging the full redirect URL.
    const stripe_session_id =
      url.match(/\/(cs_[A-Za-z0-9_]+)/)?.[1] ?? null;
    logFunnel({
      flow: FLOW,
      event: 'ok',
      ip,
      request_id,
      ...geo,
      funnel_session_id,
      ms: Date.now() - startedAt,
      client_id: client.id,
      domain_choice: parsed.data.domain_choice,
      requested_domain: parsed.data.requested_domain,
      stripe_session_id,
    });
    return NextResponse.json({ url });
  } catch (err) {
    console.error('createCheckoutSession failed', err);
    logFunnel({
      flow: FLOW,
      event: 'error',
      ip,
      request_id,
      ...geo,
      funnel_session_id,
      ms: Date.now() - startedAt,
      error: 'checkout_failed',
      client_id: client.id,
    });
    return NextResponse.json({ error: 'checkout_failed' }, { status: 500 });
  }
}
