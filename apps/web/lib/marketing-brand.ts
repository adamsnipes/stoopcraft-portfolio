// Independent marketing offer. Do not change PRICING.starter or an existing
// Stripe price: StoopCraft customers retain their current plans.
export const CHEAP_BRAND = {
  id: 'stupid-cheap-websites',
  name: 'Stupid Cheap Websites',
  domain: 'stupidcheapwebsites.com',
  url: 'https://stupidcheapwebsites.com',
  path: '/stupid-cheap-websites',
  // Public contact + reply-to. ImprovMX forwards it to `inbox`, so mail never
  // points at a free-mail address that filters score as phishing.
  email: 'hello@stupidcheapwebsites.com',
  // Where team alerts land directly.
  inbox: 'developer@example.com',
  // From address on the brand's own Resend account (RESEND_API_KEY_CHEAP).
  sender: 'hello@stupidcheapwebsites.com',
  monthly: 40,
} as const;

// A client's sales brand (clients.brand). Decides the claim banner, /pay page,
// Stripe Checkout branding/price, welcome page and activation emails.
export type ClientBrand = 'stoopcraft' | typeof CHEAP_BRAND.id;

export function isCheapBrandClient(brand: string | null | undefined): boolean {
  return brand === CHEAP_BRAND.id;
}

// Public pages on the brand domain. Each maps to the same path under
// CHEAP_BRAND.path internally ('/' → CHEAP_BRAND.path itself).
const CHEAP_BRAND_STATIC_PAGES = new Set(['/', '/privacy', '/terms', '/welcome']);
const CHEAP_BRAND_PAY_PAGE = /^\/pay\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Internal route for a public brand-domain path, or null when the brand has
// no such page.
export function cheapBrandInternalPath(pathname: string): string | null {
  if (pathname === '/') return CHEAP_BRAND.path;
  if (CHEAP_BRAND_STATIC_PAGES.has(pathname) || CHEAP_BRAND_PAY_PAGE.test(pathname)) {
    return `${CHEAP_BRAND.path}${pathname}`;
  }
  return null;
}

// Where the brand's pages live: its own domain in production, the internal
// path on a local dev server (where the brand host isn't routable).
export function cheapBrandOrigin(): string {
  const platformDomain = process.env.PLATFORM_DOMAIN ?? 'localhost:3000';
  return platformDomain.startsWith('localhost')
    ? `http://${platformDomain}${CHEAP_BRAND.path}`
    : CHEAP_BRAND.url;
}

export function isCheapBrandHost(host: string): boolean {
  const hostname = (host.toLowerCase().split(':')[0] ?? '').replace(/\.$/, '');
  return hostname === CHEAP_BRAND.domain || hostname === `www.${CHEAP_BRAND.domain}`;
}

export function isCheapBrandPath(pathname: string): boolean {
  return pathname === CHEAP_BRAND.path || pathname.startsWith(`${CHEAP_BRAND.path}/`);
}

// Public URL for an internal brand route; anything unknown maps to the homepage.
export function cheapBrandPublicPath(pathname: string): string {
  const internal = pathname.length > 1 ? pathname.replace(/\/$/, '') : pathname;
  if (!internal.startsWith(`${CHEAP_BRAND.path}/`)) return '/';
  const candidate = internal.slice(CHEAP_BRAND.path.length);
  return cheapBrandInternalPath(candidate) ? candidate : '/';
}

// Client site subdomains. StoopCraft clients are served at
// <slug>.<PLATFORM_DOMAIN>; brand clients at <slug>.stupidcheapwebsites.com, so
// a prospect's preview never shows the platform domain. The brand domain is
// routed to the production deployment only, so off production (localhost,
// staging) brand clients fall back to the platform subdomain.
export function cheapPreviewDomain(): string | null {
  return process.env.PLATFORM_DOMAIN === 'stoopcraft.com' ? CHEAP_BRAND.domain : null;
}

// Bare host (no protocol) of a client's subdomain site.
export function clientSubdomainHost(client: { slug: string; brand?: string | null }): string {
  const brandDomain = isCheapBrandClient(client.brand) ? cheapPreviewDomain() : null;
  return `${client.slug}.${brandDomain ?? process.env.PLATFORM_DOMAIN ?? 'localhost:3000'}`;
}

// Origin that serves a client's /s/<code> short link.
export function clientShortLinkOrigin(brand: string | null | undefined): string {
  const platformDomain = process.env.PLATFORM_DOMAIN ?? 'localhost:3000';
  if (isCheapBrandClient(brand) && cheapPreviewDomain()) return CHEAP_BRAND.url;
  return `${platformDomain.startsWith('localhost') ? 'http' : 'https'}://${platformDomain}`;
}

// Slug of a brand client subdomain (<slug>.stupidcheapwebsites.com), or null
// for any other host, including the brand's own apex and www.
export function cheapPreviewSlug(host: string): string | null {
  const hostname = (host.toLowerCase().split(':')[0] ?? '').replace(/\.$/, '');
  const suffix = `.${CHEAP_BRAND.domain}`;
  if (!hostname.endsWith(suffix)) return null;
  const slug = hostname.slice(0, -suffix.length);
  return slug && slug !== 'www' && !slug.includes('.') ? slug : null;
}

// Any host on the brand domain: apex, www or a client subdomain.
export function isCheapBrandDomain(host: string): boolean {
  return isCheapBrandHost(host) || cheapPreviewSlug(host) !== null;
}
