// Tiny Namecheap availability proxy. Lives on Railway because Namecheap's
// API requires whitelisted IPs and Vercel functions have dynamic egress
// IPs from the AWS Lambda pool — there's no way to whitelist them all.
// Railway services get a stable egress IP we register in the Namecheap
// dashboard once and forget.
//
// Endpoints (all POST, all require Bearer PROXY_SECRET):
//   /availability     — namecheap.domains.check + cached price
//   /pricing          — namecheap.users.getPricing for .com new registration
//   /register         — namecheap.domains.create (registers a domain)
//   /dns/set-custom   — namecheap.domains.dns.setCustom (point nameservers)
//
// Credentials never leave Railway.

import { Hono } from 'hono';
import { serve } from '@hono/node-server';

const PROD_ENDPOINT = 'https://api.namecheap.com/xml.response';
const SANDBOX_ENDPOINT = 'https://api.sandbox.namecheap.com/xml.response';

type Env = {
  PROXY_SECRET: string;
  NAMECHEAP_API_USER: string;
  NAMECHEAP_API_KEY: string;
  NAMECHEAP_USERNAME: string;
  NAMECHEAP_CLIENT_IP: string;
  NAMECHEAP_SANDBOX?: string;
};

function requireEnv(): Env {
  const required = [
    'PROXY_SECRET',
    'NAMECHEAP_API_USER',
    'NAMECHEAP_API_KEY',
    'NAMECHEAP_USERNAME',
    'NAMECHEAP_CLIENT_IP',
  ] as const;
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}`);
  }
  return {
    PROXY_SECRET: process.env['PROXY_SECRET']!,
    NAMECHEAP_API_USER: process.env['NAMECHEAP_API_USER']!,
    NAMECHEAP_API_KEY: process.env['NAMECHEAP_API_KEY']!,
    NAMECHEAP_USERNAME: process.env['NAMECHEAP_USERNAME']!,
    NAMECHEAP_CLIENT_IP: process.env['NAMECHEAP_CLIENT_IP']!,
    NAMECHEAP_SANDBOX: process.env['NAMECHEAP_SANDBOX'],
  };
}

const env = requireEnv();
const endpoint = env.NAMECHEAP_SANDBOX === 'true' ? SANDBOX_ENDPOINT : PROD_ENDPOINT;

const app = new Hono();

// ============================================================================
// Helpers
// ============================================================================

function baseParams(): URLSearchParams {
  return new URLSearchParams({
    ApiUser: env.NAMECHEAP_API_USER,
    ApiKey: env.NAMECHEAP_API_KEY,
    UserName: env.NAMECHEAP_USERNAME,
    ClientIp: env.NAMECHEAP_CLIENT_IP,
  });
}

function authorized(authHeader: string | undefined): boolean {
  const auth = authHeader ?? '';
  const expected = `Bearer ${env.PROXY_SECRET}`;
  return auth.length === expected.length && auth === expected;
}

// Pricing cache — .com retail pricing doesn't fluctuate minute-to-minute, so
// caching for 5 min saves a Namecheap round-trip on every availability check.
let priceCache: { value: number; expiresAt: number } | null = null;
const PRICE_TTL_MS = 5 * 60 * 1000;

async function getComRegistrationPriceUSD(): Promise<number | null> {
  if (priceCache && priceCache.expiresAt > Date.now()) return priceCache.value;

  const params = baseParams();
  params.set('Command', 'namecheap.users.getPricing');
  params.set('ProductType', 'DOMAIN');
  params.set('ProductCategory', 'REGISTER');
  params.set('ActionName', 'REGISTER');
  params.set('ProductName', 'com');

  try {
    const res = await fetch(`${endpoint}?${params.toString()}`, {
      method: 'GET',
      signal: AbortSignal.timeout(8000),
    });
    const xml = await res.text();

    // Namecheap returns a tiered <Price> list (1yr, 2yr, ...). We want the
    // 1-year retail price. Shape:
    //   <Price Duration="1" DurationType="YEAR" Price="11.06" RegularPrice="11.06" ... />
    const match = xml.match(
      /<Price[^>]*Duration="1"[^>]*DurationType="YEAR"[^>]*Price="([0-9.]+)"/i,
    );
    if (!match || !match[1]) {
      console.warn('pricing parse failed', { snippet: xml.slice(0, 240) });
      return null;
    }
    const price = parseFloat(match[1]);
    if (!Number.isFinite(price)) return null;
    priceCache = { value: price, expiresAt: Date.now() + PRICE_TTL_MS };
    return price;
  } catch (err) {
    console.error('pricing request failed', { err });
    return null;
  }
}

// ============================================================================
// Routes
// ============================================================================

// Health check — Railway pings this to confirm the service is up.
app.get('/', (c) => c.json({ ok: true, service: 'namecheap-proxy' }));

app.post('/availability', async (c) => {
  if (!authorized(c.req.header('authorization'))) {
    return c.json({ error: 'unauthorized' }, 401);
  }

  let body: { domain?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'invalid_json' }, 400);
  }

  if (typeof body.domain !== 'string') {
    return c.json({ error: 'domain_required' }, 400);
  }
  const domain = body.domain.trim().toLowerCase();
  if (!/^[a-z0-9-]+\.[a-z]{2,}$/.test(domain) || domain.length > 253) {
    return c.json({ error: 'invalid_domain' }, 400);
  }

  const params = baseParams();
  params.set('Command', 'namecheap.domains.check');
  params.set('DomainList', domain);

  try {
    const res = await fetch(`${endpoint}?${params.toString()}`, {
      method: 'GET',
      signal: AbortSignal.timeout(6000),
    });
    const xml = await res.text();

    const match = xml.match(
      /<DomainCheckResult[^>]*Available="(true|false)"[^>]*IsPremiumName="(true|false)"/i,
    );
    if (!match) {
      console.warn('namecheap parse failed', { domain, snippet: xml.slice(0, 240) });
      return c.json({ error: 'namecheap_parse_failed' }, 502);
    }

    // Premium pricing comes back on the same response line as
    // PremiumRegistrationPrice="..." — only set when IsPremiumName=true.
    let premiumPriceUsd: number | null = null;
    if (match[2] === 'true') {
      const premiumMatch = xml.match(
        /<DomainCheckResult[^>]*PremiumRegistrationPrice="([0-9.]+)"/i,
      );
      if (premiumMatch?.[1]) {
        const p = parseFloat(premiumMatch[1]);
        if (Number.isFinite(p)) premiumPriceUsd = p;
      }
    }

    // Fetch retail price in parallel only for non-premium .com (premium uses
    // its own price already in the check response). Cached on the proxy.
    const registrationPriceUsd =
      match[2] === 'false' && domain.endsWith('.com')
        ? await getComRegistrationPriceUSD()
        : premiumPriceUsd;

    return c.json({
      available: match[1] === 'true',
      premium: match[2] === 'true',
      registration_price_usd: registrationPriceUsd,
    });
  } catch (err) {
    console.error('namecheap request failed', { domain, err });
    return c.json({ error: 'namecheap_request_failed' }, 502);
  }
});

app.post('/pricing', async (c) => {
  if (!authorized(c.req.header('authorization'))) {
    return c.json({ error: 'unauthorized' }, 401);
  }
  const price = await getComRegistrationPriceUSD();
  if (price === null) return c.json({ error: 'pricing_unavailable' }, 502);
  return c.json({ tld: 'com', registration_price_usd: price });
});

app.post('/register', async (c) => {
  if (!authorized(c.req.header('authorization'))) {
    return c.json({ error: 'unauthorized' }, 401);
  }

  let body: {
    domain?: unknown;
    years?: unknown;
    contact?: unknown;
  };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'invalid_json' }, 400);
  }

  if (typeof body.domain !== 'string') {
    return c.json({ error: 'domain_required' }, 400);
  }
  const domain = body.domain.trim().toLowerCase();
  if (!/^[a-z0-9-]+\.[a-z]{2,}$/.test(domain) || domain.length > 253) {
    return c.json({ error: 'invalid_domain' }, 400);
  }
  if (!domain.endsWith('.com')) {
    return c.json({ error: 'tld_not_supported' }, 400);
  }

  const years = typeof body.years === 'number' && body.years >= 1 && body.years <= 10
    ? Math.floor(body.years)
    : 1;

  const contact = body.contact as Record<string, unknown> | undefined;
  if (!contact || typeof contact !== 'object') {
    return c.json({ error: 'contact_required' }, 400);
  }

  // Namecheap requires registrant/admin/tech/auxbilling contact blocks. We
  // mirror the registrant info into all four — single owner identity.
  const required = [
    'firstName', 'lastName', 'address1', 'city',
    'stateProvince', 'postalCode', 'country', 'phone', 'emailAddress',
  ] as const;
  for (const key of required) {
    if (typeof contact[key] !== 'string' || !contact[key]) {
      return c.json({ error: 'contact_field_missing', field: key }, 400);
    }
  }

  const params = baseParams();
  params.set('Command', 'namecheap.domains.create');
  params.set('DomainName', domain);
  params.set('Years', String(years));
  // Free WhoisGuard privacy on .com — included with new registrations.
  params.set('AddFreeWhoisguard', 'yes');
  params.set('WGEnabled', 'yes');

  // Mirror registrant -> Tech / Admin / AuxBilling so we don't expose the
  // customer's name on WHOIS (privacy is on but Namecheap still validates).
  for (const role of ['Registrant', 'Tech', 'Admin', 'AuxBilling']) {
    params.set(`${role}FirstName`, contact['firstName'] as string);
    params.set(`${role}LastName`, contact['lastName'] as string);
    params.set(`${role}Address1`, contact['address1'] as string);
    if (typeof contact['address2'] === 'string' && contact['address2']) {
      params.set(`${role}Address2`, contact['address2']);
    }
    params.set(`${role}City`, contact['city'] as string);
    params.set(`${role}StateProvince`, contact['stateProvince'] as string);
    params.set(`${role}PostalCode`, contact['postalCode'] as string);
    params.set(`${role}Country`, contact['country'] as string);
    params.set(`${role}Phone`, contact['phone'] as string);
    params.set(`${role}EmailAddress`, contact['emailAddress'] as string);
  }

  try {
    const res = await fetch(`${endpoint}?${params.toString()}`, {
      method: 'POST',
      signal: AbortSignal.timeout(30000),
    });
    const xml = await res.text();

    // Success shape:
    //   <DomainCreateResult Domain="x.com" Registered="true" ChargedAmount="11.06" ... />
    const success = xml.match(
      /<DomainCreateResult[^>]*Registered="(true|false)"[^>]*ChargedAmount="([0-9.]+)"/i,
    );
    if (success && success[1] === 'true') {
      const chargedAmount = parseFloat(success[2] ?? '0');
      return c.json({
        registered: true,
        domain,
        years,
        charged_amount_usd: Number.isFinite(chargedAmount) ? chargedAmount : null,
      });
    }

    // Failure — extract Namecheap's error message for the admin alert.
    const errMatch = xml.match(/<Error\s+Number="(\d+)">([^<]+)<\/Error>/i);
    const errorNumber = errMatch?.[1] ?? null;
    const errorMessage = errMatch?.[2] ?? null;
    console.warn('namecheap register failed', { domain, errorNumber, errorMessage, snippet: xml.slice(0, 400) });
    return c.json(
      {
        registered: false,
        error: 'registration_failed',
        namecheap_error_number: errorNumber,
        namecheap_error_message: errorMessage,
      },
      502,
    );
  } catch (err) {
    console.error('namecheap register request failed', { domain, err });
    return c.json({ error: 'namecheap_request_failed' }, 502);
  }
});

app.post('/dns/set-custom', async (c) => {
  if (!authorized(c.req.header('authorization'))) {
    return c.json({ error: 'unauthorized' }, 401);
  }

  let body: { domain?: unknown; nameservers?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'invalid_json' }, 400);
  }

  if (typeof body.domain !== 'string') {
    return c.json({ error: 'domain_required' }, 400);
  }
  const domain = body.domain.trim().toLowerCase();
  if (!/^[a-z0-9-]+\.[a-z]{2,}$/.test(domain) || domain.length > 253) {
    return c.json({ error: 'invalid_domain' }, 400);
  }

  if (!Array.isArray(body.nameservers) || body.nameservers.length < 2) {
    return c.json({ error: 'nameservers_required' }, 400);
  }
  const nameservers = body.nameservers.filter((n): n is string => typeof n === 'string');
  if (nameservers.length < 2) {
    return c.json({ error: 'nameservers_required' }, 400);
  }

  // setCustom takes SLD + TLD as separate params.
  const dot = domain.indexOf('.');
  const sld = domain.slice(0, dot);
  const tld = domain.slice(dot + 1);

  const params = baseParams();
  params.set('Command', 'namecheap.domains.dns.setCustom');
  params.set('SLD', sld);
  params.set('TLD', tld);
  params.set('Nameservers', nameservers.join(','));

  try {
    const res = await fetch(`${endpoint}?${params.toString()}`, {
      method: 'POST',
      signal: AbortSignal.timeout(15000),
    });
    const xml = await res.text();

    // Success shape:
    //   <DomainDNSSetCustomResult Domain="x.com" Update="true" />
    const success = xml.match(/<DomainDNSSetCustomResult[^>]*Update="(true|false)"/i);
    if (success && success[1] === 'true') {
      return c.json({ updated: true, domain, nameservers });
    }

    const errMatch = xml.match(/<Error\s+Number="(\d+)">([^<]+)<\/Error>/i);
    console.warn('namecheap setCustom failed', {
      domain,
      errorNumber: errMatch?.[1] ?? null,
      errorMessage: errMatch?.[2] ?? null,
      snippet: xml.slice(0, 400),
    });
    return c.json(
      {
        updated: false,
        error: 'set_custom_failed',
        namecheap_error_number: errMatch?.[1] ?? null,
        namecheap_error_message: errMatch?.[2] ?? null,
      },
      502,
    );
  } catch (err) {
    console.error('namecheap setCustom request failed', { domain, err });
    return c.json({ error: 'namecheap_request_failed' }, 502);
  }
});

const port = Number(process.env['PORT'] ?? 8080);
serve({ fetch: app.fetch, port }, () => {
  console.log(`namecheap-proxy listening on :${port}`);
});
