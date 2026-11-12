// Referral cookie — set when a visitor hits /r/<code>, read at /api/generate
// and /api/checkout/claim time so a sales rep gets credited for any site the
// visitor ends up generating + paying for. 30-day window matches typical
// affiliate-attribution norms; cookie is httpOnly because every read happens
// server-side.

import type { NextRequest } from 'next/server';
import { cookies as nextCookies } from 'next/headers';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@dfy/db';

export const REF_COOKIE_NAME = 'sc_ref';
// Source-only — medium/campaign live in the click-event metadata. Source is
// the field that drives per-channel attribution on the affiliate dashboard.
export const REF_UTM_SOURCE_COOKIE_NAME = 'sc_ref_src';
export const REF_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export function readRefCookieFromRequest(req: NextRequest): string | null {
  return req.cookies.get(REF_COOKIE_NAME)?.value ?? null;
}

export function readRefUtmSourceFromRequest(req: NextRequest): string | null {
  return req.cookies.get(REF_UTM_SOURCE_COOKIE_NAME)?.value ?? null;
}

export async function readRefCookie(): Promise<string | null> {
  const store = await nextCookies();
  return store.get(REF_COOKIE_NAME)?.value ?? null;
}

// Sanitize a user-supplied UTM value to a safe, queryable shape. Lower-case,
// alnum + dashes only, max 40 chars. Rejection (null return) means we just
// don't tag the click — defense against poison values in click logs.
export function normalizeUtmValue(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw.toLowerCase().replace(/[^a-z0-9-_]/g, '').slice(0, 40);
  return cleaned.length > 0 ? cleaned : null;
}

// Resolve a referral code to an active sales_rep_id. Returns null when the
// code is missing, malformed, unknown, or the rep isn't currently active —
// in any of those cases the visitor's site is still generated, just without
// attribution.
export async function resolveActiveSalesRepId(
  admin: SupabaseClient<Database>,
  code: string | null,
): Promise<string | null> {
  if (!code) return null;
  if (!/^[a-z0-9][a-z0-9-]{2,31}$/.test(code)) return null;
  const { data } = await admin
    .from('sales_reps')
    .select('id, status')
    .eq('code', code)
    .maybeSingle();
  if (!data || data.status !== 'active') return null;
  return data.id;
}
