import { NextRequest, NextResponse } from 'next/server';
import { resolveStaticServe } from '@/lib/static-sites/access';
import { getStaticObject } from '@/lib/r2/static-site';
import { serveBlog } from '@/lib/blog/render';
import { findRedirect } from '@/lib/static-sites/redirects';
import { injectClaimBanner } from '@/lib/static-sites/claim-banner';
import { CHEAP_BRAND, isCheapBrandClient, isCheapBrandDomain } from '@/lib/marketing-brand';

// Static-site bundles are streamed from R2 (Node runtime — uses the AWS SDK).
// The proxy rewrites a static client's host to /h/<slug>/… ; relative assets
// (via the injected <base href>) hit this handler directly.
export const dynamic = 'force-dynamic';

// The platform origin. Static sites load the shared lead-capture.js from here
// and POST leads to its /api/contact — they're served from R2 (a different
// origin), so 'self' alone blocks both. Keep in sync with SITE_URL in
// app/layout.tsx / robots / sitemap.
const PLATFORM_ORIGIN = 'https://stoopcraft.com';

// Public R2 bucket origin — used by media-src so self-hosted <video> can stream
// straight from R2 (which supports HTTP Range). Derived from the same env var
// proxy.ts uses; falls back to the r2.dev wildcard.
const R2_PUBLIC_MEDIA = process.env.NEXT_PUBLIC_R2_PUBLIC_URL
  ? `https://${new URL(process.env.NEXT_PUBLIC_R2_PUBLIC_URL).host}`
  : 'https://*.r2.dev';

// Hand-authored pages carry inline <style>/<script>; allow them rather than
// rewriting every page to add nonces. PLATFORM_ORIGIN is allowed for the shared
// lead-capture script (script-src) and its cross-origin lead POST (connect-src).
// frame-src allows the keyless Google Maps service-area embed (maps.google.com /
// www.google.com) and Vimeo video embeds (player.vimeo.com); without it iframes
// fall back to default-src 'self' and 404.
// www.googletagmanager.com: gtag.js loader for the per-client GA4 property.
// *.google-analytics.com / *.analytics.google.com: GA4 event ingest (the
// fetch/XHR beacons gtag sends alongside its image pixels — img-src https:
// already covers those). Analytics only: no doubleclick/ads origins, because
// client sites run gtag with ads personalisation and Google signals disabled.
// js.stripe.com: Stripe's embeddable pricing table (<stripe-pricing-table>,
// BarBot) — Stripe documents exactly script-src + frame-src for it.
// CHEAP_BRAND.url: same as PLATFORM_ORIGIN for sites built for the Stupid
// Cheap Websites brand, which load lead-capture.js from (and post leads to)
// the brand domain so their source never names the platform.
// This is the ONLY CSP on a static-site response — proxy.ts returns early for
// static hosts, before its own CSP block — so anything a client page loads
// must be allowed here.
const STATIC_CSP = [
  `default-src 'self'`,
  `script-src 'self' 'unsafe-inline' ${PLATFORM_ORIGIN} ${CHEAP_BRAND.url} https://www.googletagmanager.com https://js.stripe.com`,
  `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
  `img-src 'self' data: https:`,
  `font-src 'self' data: https://fonts.gstatic.com`,
  // media-src: self-hosted <video>/<audio> streamed from the public R2 bucket
  // (e.g. client intro videos). R2's public URL supports HTTP Range, so it
  // serves video directly to the browser — bypassing this route/function.
  `media-src 'self' data: ${R2_PUBLIC_MEDIA}`,
  `connect-src 'self' ${PLATFORM_ORIGIN} ${CHEAP_BRAND.url} https://www.googletagmanager.com https://*.google-analytics.com https://*.analytics.google.com`,
  // barbots.co: share-chatbot iframe (Delivery Dilemma's Pharmacy Assistant page).
  `frame-src 'self' https://www.google.com https://maps.google.com https://player.vimeo.com https://calendly.com https://barbots.co https://js.stripe.com`,
  `frame-ancestors 'self'`,
].join('; ');

type Params = Promise<{ slug: string; path?: string[] }>;

export async function GET(
  req: NextRequest,
  { params }: { params: Params },
): Promise<NextResponse | Response> {
  const { slug, path } = await params;

  const access = await resolveStaticServe(slug);
  // The brand domain serves only the brand's clients — /h/<slug> on it must
  // not expose any other client's bundle.
  if (!access || (isCheapBrandDomain(req.headers.get('host') ?? '') && !isCheapBrandClient(access.brand))) {
    return new NextResponse('Not found', { status: 404 });
  }

  const segments = path ?? [];

  // Paused is a reversible kill switch, not a teardown. Serve a branded 503
  // (temporary, ranking-safe) instead of the bundle. 503 + Retry-After tells
  // crawlers "come back later" so the site's SEO survives the pause; a 200
  // would let them index the placeholder, and 404 would push deindexing.
  if (access.status === 'paused') {
    return pausedResponse(segments, access.brand);
  }

  // /blog → render the DB-backed blog for THIS client (scoped to access.clientId),
  // not an R2 bundle file. Everything below the static landing page still serves
  // from R2 as before.
  if (segments[0] === 'blog') {
    return serveBlog(access.clientId, access.status, segments.slice(1));
  }

  const relPath = segments.join('/');
  let object = await getStaticObject(slug, relPath);
  // Clean URLs: /corey serves corey.html (URL stays /corey). Only for an
  // extensionless last segment, so a missing asset still 404s instead of
  // costing a second lookup. A real file of the exact name always wins.
  if (!object && relPath && !/\.[a-z0-9]+$/i.test(segments[segments.length - 1] ?? '')) {
    object = await getStaticObject(slug, `${relPath}.html`);
  }
  if (!object) {
    // Old WP URL that no longer exists? Honor an operator-defined 301 before
    // 404ing, so backlinks to the previous site keep their value. Relative
    // Location resolves against the customer host the browser is on.
    const to = await findRedirect(access.clientId, `/${relPath}`);
    if (to) {
      return new Response(null, { status: 301, headers: { Location: to, 'Cache-Control': 'public, max-age=3600' } });
    }
    return new NextResponse('Not found', { status: 404 });
  }

  const isHtml = object.contentType.startsWith('text/html');
  const headers = new Headers({
    'Content-Type': object.contentType,
    'X-Content-Type-Options': 'nosniff',
  });

  if (isHtml) {
    // Replaces must show immediately; documents are cheap to re-fetch.
    headers.set('Cache-Control', 'no-cache');
    headers.set('Content-Security-Policy', STATIC_CSP);
    // Pre-sale/preview (live) must never be indexed; public (claimed) may be.
    if (access.status === 'live') {
      headers.set('X-Robots-Tag', 'noindex, nofollow');
      // Pre-sale bundles get the "claim this site" bar (links to /pay/[id]) so
      // the prospect can claim + pay from the bare preview URL — no token, no
      // copy-pasted link. Suppressed for demos (hide_claim_banner). Never on
      // claimed sites: they're the customer's real, indexable site.
      if (!access.hideClaimBanner) {
        const html = new TextDecoder().decode(object.body);
        const withBanner = injectClaimBanner(html, access.clientId, PLATFORM_ORIGIN, access.brand);
        return new Response(withBanner, { status: 200, headers });
      }
    }
  } else {
    headers.set('Cache-Control', 'public, max-age=3600');
  }

  return new Response(new Uint8Array(object.body), { status: 200, headers });
}

// A paused site is offline but recoverable. Document requests get a centered
// placeholder; asset requests (css/js/images/fonts) get a bare 503 so the
// browser doesn't try to parse an HTML body as a stylesheet. Both are 503 +
// Retry-After + noindex so the pause stays SEO-neutral and no-store so an
// unpause is reflected on the next request.
function pausedResponse(segments: string[], brand: string): Response {
  const last = segments[segments.length - 1] ?? '';
  const isAsset = /\.[a-z0-9]+$/i.test(last) && !/\.html?$/i.test(last);

  const headers = new Headers({
    'Cache-Control': 'no-store',
    'Retry-After': '3600',
    'X-Robots-Tag': 'noindex',
  });

  if (isAsset) {
    headers.set('Content-Type', 'text/plain; charset=utf-8');
    return new Response('Service Unavailable', { status: 503, headers });
  }

  headers.set('Content-Type', 'text/html; charset=utf-8');
  headers.set('Content-Security-Policy', STATIC_CSP);
  const contact = isCheapBrandClient(brand) ? CHEAP_BRAND.name : 'StoopCraft';
  return new Response(PAUSED_HTML.replace('{{contact}}', contact), { status: 503, headers });
}

const PAUSED_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Temporarily unavailable</title>
<style>
  html, body { height: 100%; margin: 0; }
  body {
    display: flex; align-items: center; justify-content: center;
    min-height: 100vh; padding: 24px; box-sizing: border-box;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: #1f2937; background: #f9fafb; text-align: center;
  }
  main { max-width: 30rem; }
  h1 { font-size: 1.5rem; font-weight: 600; margin: 0 0 0.75rem; }
  p { font-size: 1rem; line-height: 1.6; color: #6b7280; margin: 0; }
</style>
</head>
<body>
<main>
  <h1>This website is temporarily unavailable.</h1>
  <p>If you are the business owner, please contact {{contact}} to restore your website.</p>
</main>
</body>
</html>`;
