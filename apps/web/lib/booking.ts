import type { BookingMethod } from '@dfy/db';

// Demo Calendly URL used on unclaimed/preview sites so prospects can see a
// working booking flow when they're sent a link. Once a customer claims
// their site they pick a method + link in the admin and this fallback is
// no longer used.
export const DEMO_BOOKING_URL =
  process.env.NEXT_PUBLIC_DEMO_BOOKING_URL ?? 'https://calendly.com/stoopcraft/45min';

export type EmbedTheme = {
  background: string;
  text: string;
  accent: string;
};

// embedSrc null means the booking can't be iframed (Booksy blocks framing,
// phone is a tel: link). Sections must render the link variant in that case.
export type ResolvedBooking = {
  method: BookingMethod;
  embedSrc: string | null;
  externalHref: string;
};

// Strip a leading "#" and lower-case — Calendly's color params want bare
// 6-digit hex (e.g. "0069ff", not "#0069FF").
function calendlyHex(color: string): string | null {
  const trimmed = color.trim().replace(/^#/, '').toLowerCase();
  return /^[0-9a-f]{6}$/.test(trimmed) ? trimmed : null;
}

function applyCalendlyTheme(url: string, theme: EmbedTheme | undefined): string {
  const u = new URL(url);
  // Always hide marketing chrome — these embeds live on the customer's site,
  // they don't need Calendly's GDPR banner or event-type recap.
  u.searchParams.set('hide_gdpr_banner', '1');
  u.searchParams.set('hide_landing_page_details', '1');
  if (theme) {
    const bg = calendlyHex(theme.background);
    const tx = calendlyHex(theme.text);
    const pr = calendlyHex(theme.accent);
    if (bg) u.searchParams.set('background_color', bg);
    if (tx) u.searchParams.set('text_color', tx);
    if (pr) u.searchParams.set('primary_color', pr);
  }
  return u.toString();
}

function normalizeMethod(method: string | null | undefined): BookingMethod {
  if (method === 'booksy' || method === 'phone' || method === 'cuts') return method;
  return 'calendly';
}

/**
 * Resolve the effective booking destination for a tenant.
 * - method='calendly' + URL → themed iframe embed.
 * - method='calendly' + no URL on unclaimed ('live') sites → demo Calendly so
 *   outreach prospects see a working embed.
 * - method='calendly' + no URL on claimed sites → null (customer hasn't set
 *   their link; we don't pipe their leads to our demo).
 * - method='booksy' + URL → external link only (Booksy refuses iframing).
 * - method='cuts' + URL → external link only (The Cut deep-links into the
 *   barber's profile; same iframe constraints as Booksy).
 * - method='phone' + client phone → tel: link.
 * - Anything else → null and the section suppresses itself.
 */
export function resolveTenantBooking(
  method: string | null | undefined,
  bookingUrl: string | null | undefined,
  status: 'live' | 'claimed',
  phone: string | null | undefined,
  theme?: EmbedTheme,
): ResolvedBooking | null {
  const m = normalizeMethod(method);

  if (m === 'phone') {
    if (!phone) return null;
    return { method: m, embedSrc: null, externalHref: `tel:${phone}` };
  }

  if (m === 'booksy' || m === 'cuts') {
    if (!bookingUrl) return null;
    return { method: m, embedSrc: null, externalHref: bookingUrl };
  }

  // calendly
  if (bookingUrl) {
    return {
      method: m,
      embedSrc: tryApplyCalendlyTheme(bookingUrl, theme),
      externalHref: bookingUrl,
    };
  }
  if (status === 'live') {
    return {
      method: m,
      embedSrc: tryApplyCalendlyTheme(DEMO_BOOKING_URL, theme),
      externalHref: DEMO_BOOKING_URL,
    };
  }
  return null;
}

// new URL() throws on relative strings (e.g. legacy "username/30min"
// Cal.com slugs left over from before the method picker existed). Fall
// through to embedSrc=null so the section renders the link variant
// instead of crashing.
function tryApplyCalendlyTheme(url: string, theme: EmbedTheme | undefined): string | null {
  try {
    return applyCalendlyTheme(url, theme);
  } catch {
    return null;
  }
}
