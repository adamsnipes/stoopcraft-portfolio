// Public "save my preview for later" endpoint. Lets an unclaimed visitor
// email themselves a restore link before clicking "Generate another" on the
// landing page. The link in the email lands on /?restore=<id>&t=<token>
// which /api/restore-preview validates and turns back into a GenerateResult.
//
// Gated by claim_token + per-IP rate limit + honeypot — same pattern as
// /api/checkout/claim, since a successful save reveals nothing the visitor
// didn't already see (they just generated the preview moments ago).

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { sendUnclaimedPreviewEmail } from '@/lib/email';
import { checkRateLimit, clientIpFromHeaders } from '@/lib/rate-limit';
import { checkHoneypot } from '@/lib/turnstile';
import {
  logFunnel,
  alertRateLimit,
  requestIdFromHeaders,
  geoFromHeaders,
} from '@/lib/funnel-log';

const inputSchema = z.object({
  client_id: z.string().uuid(),
  claim_token: z.string().min(1).max(200),
  email: z.string().email().max(200),
  website: z.string().nullish(),
  funnel_session_id: z.string().uuid().nullish(),
});

const FLOW = 'save-preview' as const;
// Lower ceiling than generate — a save is cheap on our side (one email)
// but spammers could use us as a relay. 3/hr per IP is plenty for the
// "save mine then save my partner's" case while bounding abuse.
const RATE_LIMIT = { max: 3, windowMs: 60 * 60 * 1000 };

export async function POST(req: NextRequest): Promise<NextResponse> {
  const startedAt = Date.now();
  const ip = clientIpFromHeaders(req.headers);
  const request_id = requestIdFromHeaders(req.headers);
  const geo = geoFromHeaders(req.headers);

  const limit = checkRateLimit(`save-preview:${ip}`, RATE_LIMIT);
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

  logFunnel({
    flow: FLOW,
    event: 'start',
    ip,
    request_id,
    ...geo,
    funnel_session_id,
    client_id: parsed.data.client_id,
  });

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
  const restoreUrl =
    `${proto}://${platformDomain}/?restore=${client.id}` +
    `&t=${encodeURIComponent(parsed.data.claim_token)}`;

  try {
    await sendUnclaimedPreviewEmail({
      to: parsed.data.email,
      variables: {
        business_name: client.business_name,
        restore_url: restoreUrl,
      },
    });
    logFunnel({
      flow: FLOW,
      event: 'ok',
      ip,
      request_id,
      ...geo,
      funnel_session_id,
      ms: Date.now() - startedAt,
      client_id: client.id,
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('save-preview send failed', err);
    logFunnel({
      flow: FLOW,
      event: 'error',
      ip,
      request_id,
      ...geo,
      funnel_session_id,
      ms: Date.now() - startedAt,
      error: 'send_failed',
      client_id: client.id,
    });
    return NextResponse.json({ error: 'send_failed' }, { status: 500 });
  }
}
