// Companion to /api/save-preview — turns a saved restore link
// (/?restore=<id>&t=<token>) back into the GenerateResult shape the landing
// page expects so it can render the iframe + claim wizard without
// re-running generation.
//
// Token-gated: we only return the payload if claim_token matches and the
// site is still unclaimed. Already-claimed sites surface a distinct 409
// so the landing page can route the user to their portal instead.

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { checkRateLimit, clientIpFromHeaders } from '@/lib/rate-limit';
import {
  logFunnel,
  requestIdFromHeaders,
  geoFromHeaders,
} from '@/lib/funnel-log';

const inputSchema = z.object({
  client_id: z.string().uuid(),
  t: z.string().min(1).max(200),
});

const FLOW = 'restore-preview' as const;
// Generous ceiling — this is a benign read called once per email-click.
// We just need a floor in place to keep a leaked link from getting hammered.
const RATE_LIMIT = { max: 30, windowMs: 60 * 60 * 1000 };

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ip = clientIpFromHeaders(req.headers);
  const request_id = requestIdFromHeaders(req.headers);
  const geo = geoFromHeaders(req.headers);

  const limit = checkRateLimit(`restore-preview:${ip}`, RATE_LIMIT);
  if (!limit.allowed) {
    logFunnel({ flow: FLOW, event: 'rate_limited', ip, request_id, ...geo });
    return NextResponse.json(
      {
        error: 'rate_limited',
        retry_after_seconds: Math.max(1, Math.ceil((limit.resetAt - Date.now()) / 1000)),
      },
      { status: 429 },
    );
  }

  const { searchParams } = new URL(req.url);
  const parsed = inputSchema.safeParse({
    client_id: searchParams.get('client_id'),
    t: searchParams.get('t'),
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'validation_failed' }, { status: 400 });
  }

  const admin = createServiceRoleClient();
  const { data: client } = await admin
    .from('clients')
    .select('id, slug, business_name, claim_token, status, owner_user_id, short_code')
    .eq('id', parsed.data.client_id)
    .eq('claim_token', parsed.data.t)
    .single();

  if (!client) {
    logFunnel({
      flow: FLOW,
      event: 'error',
      ip,
      request_id,
      ...geo,
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
      client_id: client.id,
    });
    return NextResponse.json({ error: 'already_claimed' }, { status: 409 });
  }

  const platformDomain = process.env.PLATFORM_DOMAIN ?? 'localhost:3000';

  logFunnel({
    flow: FLOW,
    event: 'ok',
    ip,
    request_id,
    ...geo,
    client_id: client.id,
  });

  return NextResponse.json({
    success: true,
    client_id: client.id,
    slug: client.slug,
    business_name: client.business_name,
    platform_domain: platformDomain,
    claim_token: client.claim_token,
    ...(client.short_code
      ? { short_url: `https://${platformDomain}/s/${client.short_code}` }
      : {}),
  });
}
