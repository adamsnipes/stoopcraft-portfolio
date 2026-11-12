import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { lookupClientHost } from '@/lib/static-sites/host-lookup';
import { CHEAP_BRAND, cheapBrandInternalPath, cheapBrandPublicPath, cheapPreviewDomain, cheapPreviewSlug, isCheapBrandClient, isCheapBrandHost, isCheapBrandPath } from '@/lib/marketing-brand';

const PLATFORM_DOMAIN = process.env.PLATFORM_DOMAIN ?? 'localhost';
const RESERVED_SUBDOMAINS = new Set([
  'www',
  'admin',
  'portal',
  'claim',
  'api',
  'staging',
  'auth',
  'onboarding',
  'checkout',
]);

const STOOPCRAFT_HOSTS = new Set(['stoopcraft.com', 'www.stoopcraft.com']);

// Non-page requests the brand domain serves from this deployment: its lead
// API, its clients' short links, its own assets, the portfolio screenshots and
// any other static file.
function isCheapPassthrough(pathname: string): boolean {
  return pathname.startsWith('/api/')
    || /^\/s\/[A-Za-z0-9_-]+$/.test(pathname)
    || pathname.startsWith('/_next/')
    || pathname.startsWith('/cheap-websites/')
    || pathname.startsWith('/work/')
    || /\.[a-z0-9]+$/i.test(pathname);
}

export async function proxy(req: NextRequest) {
  const url = req.nextUrl.clone();
  const host = req.headers.get('host') ?? '';
  const hostname = (host.split(':')[0] ?? '').toLowerCase();
  const isCheapHost = isCheapBrandHost(host);
  const cheapClientSlug = cheapPreviewSlug(host);
  const isCheapPage = isCheapHost || isCheapBrandPath(url.pathname);

  // This is another platform-owned brand, not a customer domain. Keep its
  // API calls and public assets on this deployment; only its own pages render.
  if (isCheapHost && url.pathname === '/robots.txt') {
    return new NextResponse(`User-agent: *\nAllow: /$\nDisallow: /\nSitemap: ${CHEAP_BRAND.url}/sitemap.xml\n`, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }
  if (isCheapHost && url.pathname === '/sitemap.xml') {
    return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${CHEAP_BRAND.url}/</loc></url></urlset>`, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
  }

  // === Static-site asset/canonical passthrough ===
  // Requests already at /h/<slug>/… (assets resolved via the injected <base>,
  // or the platform-apex admin preview) go straight to the route handler. The
  // handler owns content-type, cache, robots and CSP for these. Without this
  // guard the host rewrite below would double-prefix the path.
  if (url.pathname.startsWith('/h/')) {
    return NextResponse.next();
  }

  // === Subdomain resolution ===
  let rewriteTarget: string | null = null;
  let isCustomerSite = false;

  const isApexOrWww =
    hostname === PLATFORM_DOMAIN || hostname === `www.${PLATFORM_DOMAIN}`;
  const isPlatformSubdomain = hostname.endsWith('.' + PLATFORM_DOMAIN);

  if (isCheapHost) {
    const brandPage = cheapBrandInternalPath(url.pathname);
    if (brandPage) {
      rewriteTarget = brandPage;
    } else if (!isCheapPassthrough(url.pathname)) {
      // Internal aliases go to their public URL; any other page route (the
      // StoopCraft homepage, /pricing, /admin…) must never render under this
      // brand, so it lands on the brand homepage.
      const canonical = new URL(cheapBrandPublicPath(url.pathname), req.url);
      canonical.search = url.search;
      return NextResponse.redirect(canonical, 308);
    }
  } else if (STOOPCRAFT_HOSTS.has(hostname) && isCheapBrandPath(url.pathname)) {
    // The brand is only public on its own domain; stoopcraft.com/stupid-cheap-websites
    // would tie the two together. Localhost/staging keep the path for review.
    const target = new URL(cheapBrandPublicPath(url.pathname), CHEAP_BRAND.url);
    target.search = url.search;
    return NextResponse.redirect(target, 308);
  } else if (cheapClientSlug) {
    // <slug>.stupidcheapwebsites.com: a brand client's site. The brand check
    // below keeps any other client off this domain.
    rewriteTarget = `/sites/${encodeURIComponent(hostname)}${url.pathname}`;
    isCustomerSite = true;
  } else if (!isApexOrWww && isPlatformSubdomain) {
    const subdomain = hostname.replace('.' + PLATFORM_DOMAIN, '');
    if (!RESERVED_SUBDOMAINS.has(subdomain)) {
      rewriteTarget = `/sites/${encodeURIComponent(hostname)}${url.pathname}`;
      isCustomerSite = true;
    }
  } else if (!isApexOrWww && !isPlatformSubdomain && hostname !== 'localhost') {
    // Custom domain
    rewriteTarget = `/sites/${encodeURIComponent(hostname)}${url.pathname}`;
    isCustomerSite = true;
  }

  // === Client lookup: brand domain + static HTML sites ===
  // Only customer hosts are looked up, so platform/admin/api/apex traffic never
  // hits the DB.
  if (isCustomerSite) {
    const client = await lookupClientHost(hostname);

    // Each brand's clients live only on that brand's domain. 307, not 308: a
    // client's brand can change before it is claimed.
    if (cheapClientSlug && !isCheapBrandClient(client?.brand)) {
      return NextResponse.redirect(CHEAP_BRAND.url, 307);
    }
    const brandDomain = cheapPreviewDomain();
    if (isPlatformSubdomain && brandDomain && client && isCheapBrandClient(client.brand)) {
      const target = new URL(`https://${client.slug}.${brandDomain}${url.pathname}`);
      target.search = url.search; // keeps the ?t= preview token
      return NextResponse.redirect(target, 307);
    }

    // A static client renders an uploaded R2 bundle instead of the React
    // template: rewrite to the /h/<slug> route handler (which serves the bundle
    // and owns its headers); template hosts fall through unchanged.
    if (client?.isStatic) {
      const rewritePath = `/h/${client.slug}${url.pathname === '/' ? '' : url.pathname}`;
      const target = new URL(rewritePath, req.url);
      target.search = url.search; // preserve ?t= pre-sale/preview token
      const staticResponse = NextResponse.rewrite(target);
      staticResponse.headers.set('X-Content-Type-Options', 'nosniff');
      staticResponse.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
      staticResponse.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
      return staticResponse;
    }
  }

  // === CSP nonce (unique per request) ===
  const nonce = crypto.randomUUID().replace(/-/g, '');

  // Build CSP first so we can put it on BOTH request headers (for Next.js to
  // parse the nonce during render) and response headers (for the browser to
  // enforce). Per Next.js docs: it extracts the nonce from the CSP *request*
  // header — response-only is a no-op.
  const isDev = process.env.NODE_ENV === 'development';
  const r2PublicUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_URL
    ? new URL(process.env.NEXT_PUBLIC_R2_PUBLIC_URL).host
    : '*.r2.dev';

  // Customer sites need to be iframable by the admin dashboard at the platform apex
  // (live preview at /admin/clients/[id]/content). Non-customer pages stay self-only.
  // CSP frame-ancestors supersedes X-Frame-Options on modern browsers, so XFO is omitted.
  const frameAncestors = isCustomerSite
    ? `'self' https://${PLATFORM_DOMAIN}`
    : `'self'`;

  const csp = [
    `default-src 'self'`,
    // strict-dynamic lets nonce-trusted scripts load further chunks at runtime
    // without each chunk needing to be on the allowlist — required for Next.js
    // dynamic imports and React refresh in dev.
    // embed.tawk.to: Tawk.to chat widget bootstrap script (also
    // covered by strict-dynamic once loaded with a nonce, but listed
    // here for older browsers that ignore strict-dynamic).
    // *.posthog.com / us-assets.i.posthog.com: PostHog loads its full
    // bundle and feature-flag/replay extensions at runtime. strict-dynamic
    // covers the nonced bootstrap, but older browsers still consult the
    // explicit allowlist, so list both regional asset hosts.
    // connect.facebook.net: Meta Pixel's fbevents.js. The nonced bootstrap is
    // covered by strict-dynamic, but older browsers consult the explicit host.
    // www.googletagmanager.com: Google Ads gtag.js loader + the chunks it pulls
    // at runtime. The nonced loader is covered by strict-dynamic; listed here
    // for older browsers that ignore it.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''} https://js.stripe.com https://app.cal.com https://embed.tawk.to https://us-assets.i.posthog.com https://eu-assets.i.posthog.com https://connect.facebook.net https://www.googletagmanager.com`,
    // *.tawk.to / embed.tawk.to: Tawk widget stylesheet bundle.
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://embed.tawk.to https://*.tawk.to`,
    // *.uber.com: hotlinked menu-item photos (Uber Eats CDN). Kept in sync
    // with lib/photos/url-whitelist.ts — adding a host to the whitelist
    // without adding it here will save successfully but render blank.
    // cdn.brandfetch.io: ordering-platform logos (DoorDash, Uber Eats, etc.)
    // rendered inside the OrderingLinks buttons.
    // *.tawk.to / *.tawkcdn.com: Tawk avatars and assets.
    // cdn.jsdelivr.net: Tawk's emoji renderer pulls EmojiOne PNGs from
    // jsdelivr (e.g. the 👋 in the default greeting). Without this, every
    // chat preview throws a CSP violation in the console.
    // www.facebook.com: Meta Pixel's <noscript> tracking pixel + the image
    // beacons fbevents.js fires for events.
    // www.googletagmanager.com / www.google.com / googleads.g.doubleclick.net:
    // Google Ads fires its conversion + remarketing beacons as image pixels
    // across these hosts.
    `img-src 'self' data: https://${r2PublicUrl} https://maps.googleapis.com https://*.uber.com https://cdn.brandfetch.io https://*.tawk.to https://*.tawkcdn.com https://cdn.jsdelivr.net https://www.facebook.com https://www.googletagmanager.com https://www.google.com https://googleads.g.doubleclick.net`,
    // Google Maps embed: official Embed API serves from www.google.com,
    // the unofficial no-key fallback (maps.google.com/maps?q=...&output=embed)
    // serves from maps.google.com. Both needed for restaurant Location section.
    // *.tawk.to: Tawk chat widget renders inside an iframe.
    // www.facebook.com: Meta Pixel opens a hidden facebook.com iframe for
    // cookie matching / advanced matching. Without it the pixel logs a
    // "Framing 'https://www.facebook.com/' violates frame-src" error and loses
    // match quality (the Lead event itself still beacons via connect/img-src).
    // td.doubleclick.net / www.googletagmanager.com: Google Ads conversion
    // linker opens a hidden iframe for cross-domain cookie matching.
    // player.vimeo.com: embedded Vimeo videos on client static sites. Must
    // match the STATIC_CSP frame-src in app/h/[slug]/[[...path]]/route.ts —
    // browsers enforce the intersection of both CSP headers, so an origin
    // missing from either list is blocked.
    // barbots.co: share-chatbot iframe on client static sites (same sync rule).
    // *.stupidcheapwebsites.com: the admin editor's preview iframe for brand
    // clients, whose platform subdomain redirects to the brand domain.
    `frame-src 'self' https://app.cal.com https://calendly.com https://js.stripe.com https://*.${PLATFORM_DOMAIN} https://*.${CHEAP_BRAND.domain} https://www.google.com https://maps.google.com https://player.vimeo.com https://*.tawk.to https://www.facebook.com https://td.doubleclick.net https://www.googletagmanager.com https://barbots.co`,
    // *.tawk.to: Tawk HTTPS + WebSocket transports for live messages.
    // *.i.posthog.com: PostHog event ingest + session-recording endpoints.
    // Both US (us.i.posthog.com) and EU (eu.i.posthog.com) covered so the
    // CSP doesn't need to change if we switch regions.
    // www.facebook.com / connect.facebook.net: Meta Pixel event ingest (XHR
    // beacons fbevents.js sends in addition to the image pixels).
    // www.googletagmanager.com / *.google-analytics.com / *.analytics.google.com
    // / googleads.g.doubleclick.net / www.google.com: Google Ads gtag.js event
    // + conversion ingest (fetch/XHR beacons alongside the image pixels).
    `connect-src 'self' https://api.stripe.com https://*.supabase.co https://*.tawk.to wss://*.tawk.to https://*.i.posthog.com https://www.facebook.com https://connect.facebook.net https://www.googletagmanager.com https://*.google-analytics.com https://*.analytics.google.com https://googleads.g.doubleclick.net https://www.google.com`,
    // *.tawk.to / embed.tawk.to: Tawk's icon webfont (close/minimize/send
    // glyphs). Without these, the widget chrome renders as empty squares.
    `font-src 'self' data: https://fonts.gstatic.com https://embed.tawk.to https://*.tawk.to`,
    // Self-hosted <video>/<audio> streamed from the public R2 bucket (client
    // intro videos). R2's public URL supports HTTP Range, so it streams direct
    // to the browser. Must match media-src in app/h/[slug]/[[...path]]/route.ts.
    `media-src 'self' data: https://${r2PublicUrl}`,
    `frame-ancestors ${frameAncestors}`,
  ].join('; ');

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-pathname', url.pathname);
  // Never trust client-supplied classification headers.
  requestHeaders.delete('x-is-customer-site');
  requestHeaders.delete('x-marketing-brand');
  if (isCheapPage) requestHeaders.set('x-marketing-brand', CHEAP_BRAND.id);
  // Next.js auto-stamps the nonce onto every inline script it generates if
  // it's on the request headers. Setting it only on the response was a no-op
  // — hydration scripts shipped without a nonce and got blocked by CSP.
  requestHeaders.set('x-nonce', nonce);
  // Next.js parses the CSP request header to extract the nonce during SSR;
  // without this, even with x-nonce set, inline scripts ship un-nonced.
  requestHeaders.set('Content-Security-Policy', csp);
  // Surfaced so server components (e.g. root layout) can branch on
  // "is this a customer-served site?" without re-deriving from hostname.
  // The visible URL bar stays at the customer subdomain even though we
  // rewrite to /sites/[host] internally, so client-side pathname checks
  // would miss this and render platform-only UI (Tawk widget, etc.) on
  // customer sites.
  if (isCustomerSite) requestHeaders.set('x-is-customer-site', '1');

  const response = rewriteTarget
    ? NextResponse.rewrite(Object.assign(new URL(rewriteTarget, req.url), { search: url.search }), { request: { headers: requestHeaders } })
    : NextResponse.next({ request: { headers: requestHeaders } });

  // === Security headers ===
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=()'
  );

  response.headers.set('Content-Security-Policy', csp);

  // noindex on all customer-site requests — pages set their own robots meta
  // (safety net: even cached pages won't get indexed if they slip through)
  if (isCustomerSite) {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  }

  response.headers.set('x-nonce', nonce);

  return response;
}

export const config = {
  // Image extensions are deliberately NOT excluded here. Static client sites
  // serve their bundle through the /h/<slug> rewrite above, so an image request
  // on a customer domain (https://client.com/og-image.jpg) must reach the proxy
  // to be rewritten. Excluding image extensions made every absolute image URL
  // on a client domain 404 — which broke og:image/twitter:image and schema
  // image/logo on every static site (on-page <img> still worked, because those
  // are relative and resolve via the injected <base href="/h/<slug>/">).
  // Platform-owned assets still skip the proxy via _next/static and _next/image.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/stripe/webhook).*)',
  ],
};
