// Meta (Facebook) shared config + server-side Conversions API (CAPI).
//
// The browser Pixel (app/_components/MetaPixel.tsx) is lossy: ad/tracking
// blockers, Safari ITP / Firefox ETP, and CSP hiccups silently drop a large
// slice of real Lead events before they ever reach Meta. CAPI sends the same
// event server-to-server, where blockers can't touch it, so it's the reliable
// floor. The browser pixel still fires the same event with a shared event_id;
// Meta deduplicates the pair, so we don't double-count.
//
// Both surfaces must agree on the Pixel/dataset id, so it lives here.

import { createHash } from 'node:crypto';

export const META_PIXEL_ID = '1503930598135136';

// Graph API version is pinned: Meta deprecates versions on a ~2yr clock, and a
// silent default-version bump shouldn't change our payload contract.
const CAPI_URL = `https://graph.facebook.com/v21.0/${META_PIXEL_ID}/events`;

// Meta wants PII normalized then SHA-256 hashed (lowercased, trimmed). IP and
// user agent are the exception — those are sent raw for match quality.
function hash(value: string): string {
  return createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
}

export type LeadCapiInput = {
  // Shared with the browser pixel's fbq(...,{eventID}) for deduplication.
  eventId: string;
  email: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  // Request-derived signals that sharpen Meta's attribution match.
  clientIp?: string;
  userAgent?: string;
  fbp?: string; // _fbp cookie
  fbc?: string; // _fbc cookie (carries the click id when present)
  eventSourceUrl?: string;
};

// Fire a server-side Lead event. Never throws: CAPI is best-effort telemetry
// and must not break the lead-capture request that calls it. No-ops when
// META_CAPI_ACCESS_TOKEN is unset (local dev), so callers need no guard.
export async function sendLeadCapiEvent(input: LeadCapiInput): Promise<void> {
  const token = process.env.META_CAPI_ACCESS_TOKEN;
  if (!token) return;

  const userData: Record<string, unknown> = { em: [hash(input.email)] };

  const phoneDigits = input.phone?.replace(/\D/g, '');
  if (phoneDigits) userData.ph = [hash(phoneDigits)];
  if (input.firstName) userData.fn = [hash(input.firstName)];
  if (input.lastName) userData.ln = [hash(input.lastName)];
  if (input.clientIp) userData.client_ip_address = input.clientIp;
  if (input.userAgent) userData.client_user_agent = input.userAgent;
  if (input.fbp) userData.fbp = input.fbp;
  if (input.fbc) userData.fbc = input.fbc;

  const body = {
    data: [
      {
        event_name: 'Lead',
        event_time: Math.floor(Date.now() / 1000),
        event_id: input.eventId,
        action_source: 'website',
        ...(input.eventSourceUrl ? { event_source_url: input.eventSourceUrl } : {}),
        user_data: userData,
      },
    ],
    // Set only when testing: routes the event to Events Manager → Test Events
    // instead of live reporting. Must be unset in production.
    ...(process.env.META_CAPI_TEST_EVENT_CODE
      ? { test_event_code: process.env.META_CAPI_TEST_EVENT_CODE }
      : {}),
  };

  try {
    const res = await fetch(`${CAPI_URL}?access_token=${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.error('meta capi lead failed', res.status, detail);
    }
  } catch (err) {
    console.error('meta capi lead error', err);
  }
}
