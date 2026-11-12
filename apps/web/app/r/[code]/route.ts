// Referral landing redirect. Sets a 30-day httpOnly cookie with the rep's
// code and bounces the visitor to the marketing landing page. We validate
// the code against an active sales_reps row before setting — a typo'd or
// stale link still works (visitor lands on /) but no cookie is stored, so
// attribution can't be poisoned.
//
// UTM capture: utm_source / utm_medium / utm_campaign on the URL get
// recorded in the click event metadata, and source is stamped into a
// sibling sc_ref_src cookie so the pipeline can attribute the eventual
// conversion to the channel that drove the click.

import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import {
  REF_COOKIE_MAX_AGE_SECONDS,
  REF_COOKIE_NAME,
  REF_UTM_SOURCE_COOKIE_NAME,
  normalizeUtmValue,
  resolveActiveSalesRepId,
} from '@/lib/sales-rep/ref-cookie';

type RouteContext = { params: Promise<{ code: string }> };

export async function GET(req: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const { code } = await params;
  const normalized = code.toLowerCase();

  const utmSource = normalizeUtmValue(req.nextUrl.searchParams.get('utm_source'));
  const utmMedium = normalizeUtmValue(req.nextUrl.searchParams.get('utm_medium'));
  const utmCampaign = normalizeUtmValue(req.nextUrl.searchParams.get('utm_campaign'));

  const admin = createServiceRoleClient();
  const repId = await resolveActiveSalesRepId(admin, normalized);

  const dest = new URL('/', req.url);
  const res = NextResponse.redirect(dest);

  if (repId) {
    const cookieOpts = {
      maxAge: REF_COOKIE_MAX_AGE_SECONDS,
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    };
    res.cookies.set(REF_COOKIE_NAME, normalized, cookieOpts);
    if (utmSource) {
      res.cookies.set(REF_UTM_SOURCE_COOKIE_NAME, utmSource, cookieOpts);
    }

    // Log the click. utm_* live in the metadata blob so the dashboard
    // can do per-channel breakdowns without a schema change.
    await admin.from('events').insert({
      type: 'rep_ref_click',
      metadata: {
        sales_rep_id: repId,
        code: normalized,
        ...(utmSource ? { utm_source: utmSource } : {}),
        ...(utmMedium ? { utm_medium: utmMedium } : {}),
        ...(utmCampaign ? { utm_campaign: utmCampaign } : {}),
      },
    });
  }

  return res;
}
