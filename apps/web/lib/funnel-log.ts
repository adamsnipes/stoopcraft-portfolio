// Structured logging for the public funnel — Axiom-friendly. We ship to the
// `vercel` dataset via the Vercel→Axiom log drain, which auto-extracts JSON
// fields from the function-log `message` payload. That auto-extraction only
// works if the *entire* message is valid JSON, so we deliberately do NOT
// prefix the log lines (e.g. `[funnel] {...}`) — the prefix would force the
// whole line into a single unstructured string in Axiom.
//
// Field conventions (kept consistent across endpoints so a single Axiom
// query works across the whole funnel):
//   flow                — human-readable: 'search-business', 'build-site',
//                         'checkout', 'domain-check', 'stripe-webhook',
//                         'welcome-email', 'dns-provisioning'
//   event               — 'start' | 'ok' | 'error' | 'rate_limited' | ...
//   ip                  — client IP (funnel routes only)
//   ms                  — duration of the operation in ms
//   funnel_session_id   — client-generated UUID, follows a single visitor
//                         from search → build → checkout → webhook →
//                         downstream provisioning. Single-query journey
//                         reconstruction in Axiom.
//   client_id           — present once /api/generate has created the row.
//                         Bridges the pre-generate (session-id-only) phase
//                         to the post-generate (client-id-also) phase.
//   request_id          — Vercel's request trace ID (x-vercel-id header).
//                         Lets you jump from an Axiom log line to Vercel's
//                         own request inspector.
//   city / region /     — Vercel's per-request geo headers (x-vercel-ip-*).
//   country               City is URL-encoded at the edge; we decode it.
//                         Region is an ISO 3166-2 subdivision code (e.g.
//                         "CA"), country is ISO 3166-1 alpha-2 ("US").
//                         Absent on local dev — fields just drop out.
//
// Rate-limit denials trigger an admin email on the *first* hit per (key,
// window) so we hear about abuse without watching logs daily. Subsequent
// denials in the same window are logged but not emailed.

import { sendAdminAlert } from './email';

export type FunnelFlow =
  | 'search-business'
  | 'build-site'
  | 'save-preview'
  | 'restore-preview'
  | 'checkout'
  | 'domain-check'
  | 'stripe-webhook'
  | 'welcome-email'
  | 'dns-provisioning';

type FunnelEvent =
  | 'start'
  | 'ok'
  | 'rate_limited'
  | 'honeypot_blocked'
  | 'validation_failed'
  | 'duplicate_place_id'
  | 'place_not_found'
  | 'already_claimed'
  | 'error';

type FunnelFields = {
  flow: FunnelFlow;
  event: FunnelEvent;
  // Funnel routes pass ip; backend webhooks/jobs don't.
  ip?: string;
  ms?: number;
  error?: string;
  funnel_session_id?: string | null;
  client_id?: string | null;
  request_id?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  // Free-form additional context — kept narrow so the log line stays
  // grep-friendly and Axiom field cardinality stays sane.
  [k: string]: unknown;
};

export function logFunnel(fields: FunnelFields): void {
  // Strip undefined/null values to keep the log line tight in Axiom — fewer
  // empty fields cluttering the auto-extracted column list.
  const cleaned: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v !== undefined && v !== null) cleaned[k] = v;
  }
  const stream = fields.event === 'error' ? console.error : console.log;
  stream(JSON.stringify(cleaned));
}

/**
 * Extract Vercel's per-request trace ID from headers. Returns null when
 * running locally (header is absent). Pass the resulting string into every
 * funnel log within the same request so Axiom rows are joinable to Vercel's
 * own request inspector.
 */
export function requestIdFromHeaders(headers: Headers): string | null {
  return headers.get('x-vercel-id') ?? null;
}

/**
 * Extract Vercel's per-request geo headers (city / region / country). Spread
 * the result into each `logFunnel` call so a single Axiom query can filter or
 * group by location. All three fields drop out on local dev where the headers
 * are absent.
 */
export function geoFromHeaders(headers: Headers): {
  city: string | null;
  region: string | null;
  country: string | null;
} {
  const raw = headers.get('x-vercel-ip-city');
  let city: string | null = null;
  if (raw) {
    try {
      city = decodeURIComponent(raw);
    } catch {
      // Malformed percent-encoding — keep the raw value rather than dropping it.
      city = raw;
    }
  }
  return {
    city,
    region: headers.get('x-vercel-ip-country-region'),
    country: headers.get('x-vercel-ip-country'),
  };
}

/**
 * Send an admin alert email when an IP first trips a rate limit. Safe to
 * call from request handlers — fire-and-forget; we never let an email
 * failure affect the user response.
 */
export function alertRateLimit(opts: {
  flow: FunnelFlow;
  ip: string;
  max: number;
  windowMs: number;
  resetAt: number;
  funnel_session_id?: string | null;
}): void {
  const subject = `[funnel] rate limit tripped: ${opts.flow} (${opts.ip})`;
  const windowHours = Math.round(opts.windowMs / 3_600_000);
  const resetIso = new Date(opts.resetAt).toISOString();
  const sessionRow = opts.funnel_session_id
    ? `<tr><td style="padding:4px 12px"><b>Session</b></td><td style="padding:4px 12px"><code>${opts.funnel_session_id}</code></td></tr>`
    : '';
  const html = `
    <h2>Rate limit tripped on the public funnel</h2>
    <table style="border-collapse:collapse;font-family:system-ui;font-size:14px">
      <tr><td style="padding:4px 12px"><b>Flow</b></td><td style="padding:4px 12px"><code>${opts.flow}</code></td></tr>
      <tr><td style="padding:4px 12px"><b>IP</b></td><td style="padding:4px 12px"><code>${opts.ip}</code></td></tr>
      ${sessionRow}
      <tr><td style="padding:4px 12px"><b>Limit</b></td><td style="padding:4px 12px">${opts.max} requests / ${windowHours}h</td></tr>
      <tr><td style="padding:4px 12px"><b>Resets at</b></td><td style="padding:4px 12px">${resetIso}</td></tr>
    </table>
    <p style="font-family:system-ui;font-size:13px;color:#555">
      In Axiom, filter <code>flow == "${opts.flow}"</code> and <code>ip == "${opts.ip}"</code>
      ${opts.funnel_session_id ? `(or <code>funnel_session_id == "${opts.funnel_session_id}"</code>)` : ''}
      to see what they were doing. First denial in this window — subsequent denials by the same IP won't email.
    </p>
  `;
  void sendAdminAlert({ subject, html }).catch((err) => {
    console.error('[funnel] failed to send rate-limit alert', err);
  });
}
