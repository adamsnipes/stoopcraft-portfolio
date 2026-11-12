// Public places search — used by the landing-page generator. Returns the
// same candidate shape as /api/admin/places-search but without admin auth,
// and includes the GBP primaryType so candidate cards can show "Joe's ·
// Italian Restaurant" before the user clicks generate.
//
// Rate-limited per IP to fence off scrape-style abuse. Searches are cheaper
// than generates (~one Text Search call) but still cost money in aggregate.

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { searchPlacesByText } from '@/lib/places';
import { checkRateLimit, clientIpFromHeaders } from '@/lib/rate-limit';
import { checkHoneypot } from '@/lib/turnstile';
import {
  logFunnel,
  alertRateLimit,
  requestIdFromHeaders,
  geoFromHeaders,
} from '@/lib/funnel-log';

const inputSchema = z.object({
  textQuery: z.string().trim().min(2).max(200),
  // Optional location hint (city/state/zip) used purely as a soft
  // `locationBias` for Text Search so service-area businesses surface
  // alongside storefronts. The location is still embedded in `textQuery`
  // for backwards compatibility; this field only opts in to the bias.
  address: z.string().trim().max(200).nullish(),
  // Honeypot field — humans never see it (rendered off-screen).
  website: z.string().nullish(),
  // Client-generated UUID stable across the visitor's funnel session. Used
  // to reconstruct the journey in Axiom. Optional so older cached clients
  // (pre-rollout) still work.
  funnel_session_id: z.string().uuid().nullish(),
});

const FLOW = 'search-business' as const;
const RATE_LIMIT = { max: 30, windowMs: 60 * 60 * 1000 };

export async function POST(req: NextRequest): Promise<NextResponse> {
  const startedAt = Date.now();
  const ip = clientIpFromHeaders(req.headers);
  const request_id = requestIdFromHeaders(req.headers);
  const geo = geoFromHeaders(req.headers);

  const limit = checkRateLimit(`places-search:${ip}`, RATE_LIMIT);
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
    query: parsed.data.textQuery,
  });

  const places = await searchPlacesByText(
    parsed.data.textQuery,
    parsed.data.address ?? undefined,
  );

  // Log the candidate IDs + display names we're returning to the user.
  // place_ids are public (Google Places IDs) — safe to log. Capped at 5
  // to keep log line size sane even on permissive Google responses.
  logFunnel({
    flow: FLOW,
    event: 'ok',
    ip,
    request_id,
    ...geo,
    funnel_session_id,
    ms: Date.now() - startedAt,
    results: places.length,
    candidates: places.slice(0, 5).map((p) => ({
      id: p.id,
      name: p.displayName,
      type: p.primaryType,
    })),
  });

  return NextResponse.json({ places });
}
