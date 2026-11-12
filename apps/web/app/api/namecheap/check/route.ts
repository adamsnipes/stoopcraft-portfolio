// Public Namecheap availability check — called by the landing-page domain
// wizard while the customer is typing their desired .com. Rate-limited to
// fence off scrape-style abuse (each call is one Namecheap request).

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkDomainAvailability, suggestAlternatives } from '@/lib/namecheap';
import { checkRateLimit, clientIpFromHeaders } from '@/lib/rate-limit';
import { checkHoneypot } from '@/lib/turnstile';
import {
  logFunnel,
  alertRateLimit,
  requestIdFromHeaders,
  geoFromHeaders,
} from '@/lib/funnel-log';

// .com-only at launch; the form enforces this client-side too, but we
// re-validate so a hand-crafted POST can't probe other TLDs.
const inputSchema = z.object({
  domain: z
    .string()
    .trim()
    .toLowerCase()
    .min(4)
    .max(63)
    .regex(/^[a-z0-9-]+\.com$/, 'must be a plain .com'),
  website: z.string().nullish(),
  // Client-generated UUID stable across the visitor's funnel session.
  funnel_session_id: z.string().uuid().nullish(),
});

const FLOW = 'domain-check' as const;
const RATE_LIMIT = { max: 20, windowMs: 60 * 60 * 1000 };
// Domains priced above this cap are treated as "taken" in the funnel so
// auto-registration (when enabled) never exceeds our cost ceiling. Keep in
// sync with PRICE_CAP_USD in lib/domain-provisioning — they're both load-
// bearing for the same business rule (registration cost <= $20).
const PRICE_CAP_USD = 20;

export async function POST(req: NextRequest): Promise<NextResponse> {
  const startedAt = Date.now();
  const ip = clientIpFromHeaders(req.headers);
  const request_id = requestIdFromHeaders(req.headers);
  const geo = geoFromHeaders(req.headers);

  const limit = checkRateLimit(`namecheap:${ip}`, RATE_LIMIT);
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

  const result = await checkDomainAvailability(parsed.data.domain);
  const baseLog = {
    flow: FLOW,
    event: 'ok' as const,
    ip,
    request_id,
    ...geo,
    funnel_session_id,
    ms: Date.now() - startedAt,
    domain: parsed.data.domain,
  };

  if (!result.configured) {
    // No API creds OR upstream proxy failure → caller falls back to
    // "we'll confirm availability after payment" copy. Not a hard
    // error; manual registration is the source of truth anyway. We
    // log `reason` (proxy_unconfigured / proxy_non_ok / proxy_request_failed
    // / ...) so Axiom shows the *why* — vs the previous silent unknown.
    // The reason is also returned in the JSON so the dev test bench (and
    // any future debug UI) can show it without round-tripping to logs.
    logFunnel({
      ...baseLog,
      result: 'unknown',
      reason: result.reason,
      ...(result.upstream_status ? { upstream_status: result.upstream_status } : {}),
    });
    return NextResponse.json({
      status: 'unknown',
      reason: result.reason,
      ...(result.upstream_status ? { upstream_status: result.upstream_status } : {}),
    });
  }

  // Reject names priced above our cap so the funnel never surfaces a
  // domain we won't auto-register. Cap fires when the proxy returns a
  // concrete price > $20; null/unknown price falls through (the auto-
  // register flow re-validates price at registration time anyway).
  const overCap =
    typeof result.registration_price_usd === 'number' &&
    result.registration_price_usd > PRICE_CAP_USD;

  if (result.available && !result.premium && !overCap) {
    logFunnel({
      ...baseLog,
      result: 'available',
      price_usd: result.registration_price_usd ?? null,
    });
    return NextResponse.json({ status: 'available' });
  }

  // Premium names go through a separate registration flow in Namecheap with
  // significantly higher prices. We treat them as "taken" for the standard
  // landing flow rather than surprising the customer mid-checkout. Same for
  // over-cap names.
  logFunnel({
    ...baseLog,
    result: 'taken',
    premium: result.premium,
    over_cap: overCap,
    price_usd: result.registration_price_usd ?? null,
  });
  return NextResponse.json({
    status: 'taken',
    premium: result.premium,
    alternatives: suggestAlternatives(parsed.data.domain),
  });
}
