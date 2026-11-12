import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import type { NextRequest } from 'next/server';
import { CHEAP_BRAND, cheapPreviewSlug, clientShortLinkOrigin, clientSubdomainHost, isCheapBrandHost } from '../../apps/web/lib/marketing-brand';

type HostClient = { slug: string; isStatic: boolean; brand: string } | null;
// proxy.ts reads PLATFORM_DOMAIN once at import; use the production value.
const { lookupClientHost } = vi.hoisted(() => {
  process.env.PLATFORM_DOMAIN = 'stoopcraft.com';
  return { lookupClientHost: vi.fn(async (_host: string): Promise<HostClient> => null) };
});
vi.mock('@/lib/static-sites/host-lookup', () => ({ lookupClientHost }));
import { proxy } from '../../apps/web/proxy';

function request(path: string, host = CHEAP_BRAND.domain, headers = {}) {
  const url = `https://${host}${path}`;
  return { url, headers: new Headers({ host, ...headers }), nextUrl: { clone: () => new URL(url) } } as unknown as NextRequest;
}

describe('independent marketing domain', () => {
  beforeEach(() => vi.clearAllMocks());
  it('matches only the exact apex and www, including dev ports', () => {
    expect(isCheapBrandHost('STUPIDCHEAPWEBSITES.COM:3100')).toBe(true);
    expect(isCheapBrandHost('www.stupidcheapwebsites.com')).toBe(true);
    expect(isCheapBrandHost('stupidcheapwebsites.com.evil.test')).toBe(false);
    expect(isCheapBrandHost('client.stupidcheapwebsites.com')).toBe(false);
  });
  it('rewrites the homepage, retains attribution, CSP and brand headers, and skips the tenant DB', async () => {
    const response = await proxy(request('/?utm_source=meta&campaign=40'));
    expect(response.headers.get('x-middleware-rewrite')).toBe(`https://${CHEAP_BRAND.domain}${CHEAP_BRAND.path}?utm_source=meta&campaign=40`);
    expect(response.headers.get('x-middleware-request-x-marketing-brand')).toBe(CHEAP_BRAND.id);
    expect(response.headers.get('content-security-policy')).toContain('nonce-');
    expect(response.headers.get('x-robots-tag')).toBeNull();
    expect(lookupClientHost).not.toHaveBeenCalled();
  });
  it.each(['/api/agency-inquiry', '/cheap-websites/icon.svg', '/work/clients/nimbus-pest.jpg'])('passes through %s on the marketing domain', async path => {
    const response = await proxy(request(path, `www.${CHEAP_BRAND.domain}`));
    expect(response.headers.get('x-middleware-rewrite')).toBeNull();
    expect(response.headers.get('x-middleware-next')).toBe('1');
    expect(lookupClientHost).not.toHaveBeenCalled();
  });
  it('redirects the internal alias to the canonical home, preserving query', async () => {
    const response = await proxy(request(`${CHEAP_BRAND.path}?utm_source=test`));
    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toBe(`${CHEAP_BRAND.url}/?utm_source=test`);
  });
  it.each([['/privacy', '/privacy'], ['/terms', '/terms']])('rewrites %s to the brand legal page', async (path, suffix) => {
    const response = await proxy(request(path));
    expect(response.headers.get('x-middleware-rewrite')).toBe(`https://${CHEAP_BRAND.domain}${CHEAP_BRAND.path}${suffix}`);
    expect(response.headers.get('x-middleware-request-x-marketing-brand')).toBe(CHEAP_BRAND.id);
  });
  it.each([['/pricing', '/'], ['/admin', '/'], [`${CHEAP_BRAND.path}/terms`, '/terms']])('never renders a platform page on the brand domain: %s', async (path, target) => {
    const response = await proxy(request(path));
    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toBe(`${CHEAP_BRAND.url}${target}`);
  });
  it.each([['/pay/0b5f1c3e-1d2a-4c8e-9f00-123456789abc', '/pay/0b5f1c3e-1d2a-4c8e-9f00-123456789abc'], ['/welcome', '/welcome']])('rewrites the activation page %s', async (path, suffix) => {
    const response = await proxy(request(`${path}?session_id=cs_test`));
    expect(response.headers.get('x-middleware-rewrite')).toBe(`https://${CHEAP_BRAND.domain}${CHEAP_BRAND.path}${suffix}?session_id=cs_test`);
  });
  it('does not treat a non-uuid /pay path as a brand page', async () => {
    const response = await proxy(request('/pay/not-a-client'));
    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toBe(`${CHEAP_BRAND.url}/`);
  });
  it('sends stoopcraft.com visitors of the brand path to the brand domain', async () => {
    const response = await proxy(request(`${CHEAP_BRAND.path}/privacy?x=1`, 'stoopcraft.com'));
    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toBe(`${CHEAP_BRAND.url}/privacy?x=1`);
  });
  it('leaves the existing platform homepage alone and strips forged classification', async () => {
    const response = await proxy(request('/', 'localhost', { 'x-marketing-brand': CHEAP_BRAND.id, 'x-is-customer-site': '1' }));
    expect(response.headers.get('x-middleware-rewrite')).toBeNull();
    expect(response.headers.get('x-middleware-request-x-marketing-brand')).toBeNull();
    expect(response.headers.get('x-middleware-request-x-is-customer-site')).toBeNull();
  });
  it('continues resolving ordinary customer domains', async () => {
    const response = await proxy(request('/services?q=one', 'customer.example'));
    expect(response.headers.get('x-middleware-rewrite')).toBe('https://customer.example/sites/customer.example/services?q=one');
    expect(response.headers.get('x-middleware-request-x-is-customer-site')).toBe('1');
    expect(lookupClientHost).toHaveBeenCalledWith('customer.example');
  });
  it('serves domain-specific crawler metadata instead of the StoopCraft sitemap', async () => {
    const robots = await proxy(request('/robots.txt'));
    expect(await robots.text()).toContain(`${CHEAP_BRAND.url}/sitemap.xml`);
    const sitemap = await proxy(request('/sitemap.xml'));
    expect(await sitemap.text()).toContain(`<loc>${CHEAP_BRAND.url}/</loc>`);
    expect(lookupClientHost).not.toHaveBeenCalled();
  });
});

describe('brand client subdomains', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.stubEnv('PLATFORM_DOMAIN', 'stoopcraft.com'); });
  afterEach(() => vi.unstubAllEnvs());
  const scw = { slug: 'joes-plumbing', isStatic: false, brand: CHEAP_BRAND.id };

  it('parses only single-label client subdomains of the brand domain', () => {
    expect(cheapPreviewSlug('Joes-Plumbing.StupidCheapWebsites.com:443')).toBe('joes-plumbing');
    expect(cheapPreviewSlug(CHEAP_BRAND.domain)).toBeNull();
    expect(cheapPreviewSlug(`www.${CHEAP_BRAND.domain}`)).toBeNull();
    expect(cheapPreviewSlug(`a.b.${CHEAP_BRAND.domain}`)).toBeNull();
    expect(cheapPreviewSlug(`joes.${CHEAP_BRAND.domain}.evil.test`)).toBeNull();
  });
  it('builds each brand\'s links on its own domain, falling back off production', () => {
    expect(clientSubdomainHost({ slug: 'joe', brand: CHEAP_BRAND.id })).toBe(`joe.${CHEAP_BRAND.domain}`);
    expect(clientSubdomainHost({ slug: 'joe', brand: 'stoopcraft' })).toBe('joe.stoopcraft.com');
    expect(clientShortLinkOrigin(CHEAP_BRAND.id)).toBe(CHEAP_BRAND.url);
    expect(clientShortLinkOrigin('stoopcraft')).toBe('https://stoopcraft.com');
    vi.stubEnv('PLATFORM_DOMAIN', 'staging.stoopcraft.com');
    expect(clientSubdomainHost({ slug: 'joe', brand: CHEAP_BRAND.id })).toBe('joe.staging.stoopcraft.com');
  });
  it('renders a brand client on its brand subdomain as a noindexed customer site', async () => {
    lookupClientHost.mockResolvedValueOnce(scw);
    const response = await proxy(request('/services?t=tok', `joes-plumbing.${CHEAP_BRAND.domain}`));
    expect(response.headers.get('x-middleware-rewrite')).toBe(`https://joes-plumbing.${CHEAP_BRAND.domain}/sites/joes-plumbing.${CHEAP_BRAND.domain}/services?t=tok`);
    expect(response.headers.get('x-middleware-request-x-is-customer-site')).toBe('1');
    expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow');
    expect(lookupClientHost).toHaveBeenCalledWith(`joes-plumbing.${CHEAP_BRAND.domain}`);
  });
  it('serves a static brand client\'s bundle from its brand subdomain', async () => {
    lookupClientHost.mockResolvedValueOnce({ ...scw, isStatic: true });
    const response = await proxy(request('/about', `joes-plumbing.${CHEAP_BRAND.domain}`));
    expect(response.headers.get('x-middleware-rewrite')).toBe(`https://joes-plumbing.${CHEAP_BRAND.domain}/h/joes-plumbing/about`);
  });
  it.each([[{ slug: 'acme', isStatic: true, brand: 'stoopcraft' }], [null]])('never renders a non-brand or unknown client on the brand domain (%o)', async client => {
    lookupClientHost.mockResolvedValueOnce(client);
    const response = await proxy(request('/', `acme.${CHEAP_BRAND.domain}`));
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(`${CHEAP_BRAND.url}/`);
  });
  it('moves a brand client off the platform subdomain, keeping path and preview token', async () => {
    lookupClientHost.mockResolvedValueOnce(scw);
    const response = await proxy(request('/menu?t=tok', 'joes-plumbing.stoopcraft.com'));
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(`https://joes-plumbing.${CHEAP_BRAND.domain}/menu?t=tok`);
  });
  it('leaves StoopCraft clients on the platform subdomain', async () => {
    lookupClientHost.mockResolvedValueOnce({ slug: 'acme', isStatic: true, brand: 'stoopcraft' });
    const response = await proxy(request('/', 'acme.stoopcraft.com'));
    expect(response.headers.get('x-middleware-rewrite')).toBe('https://acme.stoopcraft.com/h/acme');
  });
  it('passes short links through on the brand domain', async () => {
    const response = await proxy(request('/s/abc123'));
    expect(response.headers.get('x-middleware-next')).toBe('1');
  });
});
