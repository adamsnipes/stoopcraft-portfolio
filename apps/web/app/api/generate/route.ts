// Public generate endpoint — used by the marketing landing page so a visitor
// can type their business name, pick from Google candidates, and see their
// site rendered in an iframe without ever picking a niche. The niche is
// inferred server-side from the Place's GBP category.
//
// Differences vs /api/admin/generate:
//   - No admin auth. Anyone can call. Abuse-protected via per-IP rate limit
//     and the duplicate-place-id guard inside the pipeline.
//   - Accepts only { google_place_id }. Niche is inferred, not user-typed.
//   - Returns slug + claim_token alongside the canonical URL so the client
//     can build a local-dev-friendly iframe URL from window.location.

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { fetchPlaceData } from '@/lib/places';
import {
  inferNicheFromPlace,
  isRestaurantFromPlace,
} from '@/lib/content-gen/niche-inference';
import { generateClientSite } from '@/lib/content-gen/pipeline';
import { checkRateLimit, clientIpFromHeaders } from '@/lib/rate-limit';
import { checkHoneypot } from '@/lib/turnstile';
import {
  logFunnel,
  alertRateLimit,
  requestIdFromHeaders,
  geoFromHeaders,
} from '@/lib/funnel-log';
import {
  readRefCookieFromRequest,
  readRefUtmSourceFromRequest,
  resolveActiveSalesRepId,
} from '@/lib/sales-rep/ref-cookie';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { getAuthenticatedRep } from '@/lib/sales-rep/auth';

const inputSchema = z.object({
  google_place_id: z.string().min(1).max(300),
  // Honeypot field — humans never see it. May also arrive omitted entirely.
  website: z.string().nullish(),
  // Client-generated UUID stable across the visitor's funnel session.
  funnel_session_id: z.string().uuid().nullish(),
});

const FLOW = 'build-site' as const;
// Per-IP limit — 3 generates per hour is enough for honest users (typical
// flow generates once) and a hard ceiling for casual scraping. Heavier abuse
// gets caught by the pipeline's duplicate-place-id check or by Vercel WAF.
const RATE_LIMIT = { max: 3, windowMs: 60 * 60 * 1000 };

export async function POST(req: NextRequest): Promise<NextResponse> {
  const startedAt = Date.now();
  const ip = clientIpFromHeaders(req.headers);
  const request_id = requestIdFromHeaders(req.headers);
  const geo = geoFromHeaders(req.headers);

  const limit = checkRateLimit(`generate:${ip}`, RATE_LIMIT);
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

  // Honeypot only — Turnstile was removed from the funnel after live testing
  // showed too many false-flags on legitimate users. Defense-in-depth here:
  // honeypot + per-IP rate limit (3/hr) + pipeline's duplicate-place-id guard.
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
    place_id: parsed.data.google_place_id,
  });

  // Fetch the place once here purely to read primaryType/types for niche
  // inference. The pipeline fetches it again — yes, that's a duplicate Place
  // Details call, but it keeps the pipeline self-contained and the cost is
  // ~$0.005 per gen vs the LLM call which is ~$0.10+. Worth it for clarity.
  const place = await fetchPlaceData(parsed.data.google_place_id);
  if (!place) {
    logFunnel({
      flow: FLOW,
      event: 'place_not_found',
      ip,
      request_id,
      ...geo,
      funnel_session_id,
    });
    return NextResponse.json({ error: 'place_not_found' }, { status: 422 });
  }

  const inferred = inferNicheFromPlace({
    primary_type: place.primary_type,
    types: place.types,
  });
  // When inference picks 'other' but Google says it's a restaurant, force
  // the restaurant template family so the site ships with menu/reservations
  // sections instead of services/booking.
  const vertical_override =
    inferred.niche === 'other' &&
    isRestaurantFromPlace({ primary_type: place.primary_type, types: place.types })
      ? ('restaurant' as const)
      : undefined;

  const platformDomain = process.env.PLATFORM_DOMAIN ?? 'localhost:3000';

  // Referral attribution — two-tier lookup:
  //   1. /r/<code> cookie (anonymous visitor pre-clicked an affiliate link)
  //   2. Authenticated rep/affiliate session (they're logged in and just
  //      hit the landing page directly to pre-generate a site for a
  //      prospect — saves them the /r/<code> round-trip)
  // Cookie wins when both are present so a logged-in affiliate sharing
  // someone else's link still credits the cookie owner. Failure to resolve
  // is silent — the site still generates, just unattributed.
  const refCode = readRefCookieFromRequest(req);
  let sales_rep_id = refCode
    ? await resolveActiveSalesRepId(createServiceRoleClient(), refCode)
    : null;
  if (!sales_rep_id) {
    const ctx = await getAuthenticatedRep();
    if (ctx && ctx.rep.status === 'active') {
      sales_rep_id = ctx.rep.id;
    }
  }
  const referral_utm_source = refCode && sales_rep_id ? readRefUtmSourceFromRequest(req) : null;

  const result = await generateClientSite({
    google_place_id: parsed.data.google_place_id,
    niche: inferred.niche,
    industry_label: inferred.niche === 'other' ? inferred.industry_label : null,
    ...(vertical_override ? { vertical_override } : {}),
    source: 'public',
    funnel_session_id,
    sales_rep_id,
    referral_utm_source,
  });

  if (!result.ok) {
    logFunnel({
      flow: FLOW,
      event: result.error === 'duplicate_place_id' ? 'duplicate_place_id' : 'error',
      ip,
      request_id,
      ...geo,
      funnel_session_id,
      ms: Date.now() - startedAt,
      error: result.error,
      client_id: result.client_id ?? null,
      // Surface the same fields we expose to the client so the log line
      // shows exactly what the user saw — useful when the landing page
      // renders the iframe for an already-claimed duplicate.
      ...(result.slug ? { slug: result.slug } : {}),
      ...(result.business_name ? { business_name: result.business_name } : {}),
      ...(result.existing_status ? { existing_status: result.existing_status } : {}),
    });
    // For duplicate_place_id we surface enough info for the landing page
    // to render the existing site instead of bouncing the visitor:
    //   claimed → slug + business_name; iframe is public, no token needed
    //   live    → also includes claim_token so the visitor (likely the
    //             owner returning to finish checkout) gets the same
    //             iframe + claim wizard as a fresh generation
    // Both paths route to a site we already built; nothing here is more
    // sensitive than the SMS outreach short-links, which already surface
    // claim_token in the URL.
    return NextResponse.json(
      {
        error: result.error,
        ...(result.client_id ? { client_id: result.client_id } : {}),
        ...(result.slug ? { slug: result.slug } : {}),
        ...(result.business_name ? { business_name: result.business_name } : {}),
        ...(result.existing_status ? { existing_status: result.existing_status } : {}),
        ...(result.claim_token ? { claim_token: result.claim_token } : {}),
        ...(result.short_code
          ? { short_url: `https://${platformDomain}/s/${result.short_code}` }
          : {}),
        platform_domain: platformDomain,
      },
      { status: result.status },
    );
  }

  const fullUrl = `https://${result.slug}.${platformDomain}?t=${result.claim_token}`;
  const shortUrl = `https://${platformDomain}/s/${result.short_code}`;

  // Log the response payload we're about to return, sans the claim_token
  // (the token grants ownership of the unclaimed site — never log it).
  logFunnel({
    flow: FLOW,
    event: 'ok',
    ip,
    request_id,
    ...geo,
    funnel_session_id,
    ms: Date.now() - startedAt,
    client_id: result.client_id,
    slug: result.slug,
    niche: inferred.niche,
    business_name: result.business_name,
    short_code: result.short_code,
    platform_domain: platformDomain,
    short_url: shortUrl,
    ...(inferred.niche === 'other'
      ? { industry_label: inferred.industry_label }
      : {}),
  });

  return NextResponse.json({
    success: true,
    client_id: result.client_id,
    slug: result.slug,
    claim_token: result.claim_token,
    url: fullUrl,
    short_url: shortUrl,
    business_name: result.business_name,
    platform_domain: platformDomain,
    inferred_niche: inferred.niche,
    ...(inferred.niche === 'other' ? { industry_label: inferred.industry_label } : {}),
  });
}
