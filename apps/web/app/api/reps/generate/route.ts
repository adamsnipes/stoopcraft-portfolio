// Rep-initiated site generation. Mirrors /api/admin/generate but:
//   - auth is "active sales_reps row for the current user"
//   - sales_rep_id is stamped onto the new clients row (attribution)
//   - response includes a Stripe Checkout URL for the Starter plan so the
//     rep can copy either the preview-claim URL or the direct payment link.
//
// Niche is inferred server-side from the Google Place data, same as the
// public /api/generate flow — the rep doesn't pick a niche.

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { fetchPlaceData } from '@/lib/places';
import {
  inferNicheFromPlace,
  isRestaurantFromPlace,
} from '@/lib/content-gen/niche-inference';
import { generateClientSite } from '@/lib/content-gen/pipeline';
import { getAuthenticatedRep } from '@/lib/sales-rep/auth';
import { createCheckoutSession } from '@/lib/stripe';

const inputSchema = z.object({
  google_place_id: z.string().min(1).max(300),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ctx = await getAuthenticatedRep();
  if (!ctx || ctx.rep.status !== 'active') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (ctx.rep.kind === 'affiliate') {
    return NextResponse.json({ error: 'reps_only' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const parsed = inputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'validation_failed' }, { status: 400 });
  }

  const place = await fetchPlaceData(parsed.data.google_place_id);
  if (!place) return NextResponse.json({ error: 'place_not_found' }, { status: 422 });

  const inferred = inferNicheFromPlace({
    primary_type: place.primary_type,
    types: place.types,
  });
  const vertical_override =
    inferred.niche === 'other' &&
    isRestaurantFromPlace({ primary_type: place.primary_type, types: place.types })
      ? ('restaurant' as const)
      : undefined;

  const platformDomain = process.env.PLATFORM_DOMAIN ?? 'localhost:3000';
  const proto = platformDomain.startsWith('localhost') ? 'http' : 'https';

  const result = await generateClientSite({
    google_place_id: parsed.data.google_place_id,
    niche: inferred.niche,
    industry_label: inferred.niche === 'other' ? inferred.industry_label : null,
    ...(vertical_override ? { vertical_override } : {}),
    source: 'admin',
    sales_rep_id: ctx.rep.id,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, ...(result.client_id ? { client_id: result.client_id } : {}) },
      { status: result.status },
    );
  }

  const siteUrl = `${proto}://${result.slug}.${platformDomain}?t=${result.claim_token}`;

  // Direct Stripe payment link — Starter plan, attributed via the
  // sales_rep_id already baked onto the clients row. Failure here is
  // non-fatal: the rep can still share the site URL and the customer
  // can complete checkout through the in-page claim wizard.
  let paymentUrl: string | null = null;
  let paymentError: string | null = null;
  try {
    paymentUrl = await createCheckoutSession({
      clientId: result.client_id,
      plan: 'starter',
      successUrl: `${proto}://${platformDomain}/welcome?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: siteUrl,
    });
  } catch (err) {
    paymentError = err instanceof Error ? err.message : 'unknown';
  }

  return NextResponse.json({
    success: true,
    client_id: result.client_id,
    business_name: result.business_name,
    site_url: siteUrl,
    payment_url: paymentUrl,
    payment_error: paymentError,
  });
}
