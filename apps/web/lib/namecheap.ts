// Namecheap client — used by the landing-page wizard (availability) and by
// the auto-provisioning flow (registration, DNS). Two transport paths:
//
//   1. (preferred, production) Call the namecheap-proxy service on Railway.
//      Vercel functions get dynamic egress IPs and Namecheap's API requires
//      a static whitelisted IP, so we proxy through a Railway service that
//      has a stable IP. Configured via NAMECHEAP_PROXY_URL + _TOKEN.
//
//   2. (fallback, local dev) Call Namecheap directly from the Vercel app.
//      Requires whitelisting the developer's IP in the Namecheap dashboard.
//      Configured via NAMECHEAP_API_USER / _KEY / _USERNAME / _CLIENT_IP.
//      Note: only availability-check is supported via the direct path —
//      registration/DNS go through the proxy (admins shouldn't be auto-
//      registering from a laptop).
//
// If neither is configured (or both fail), returns
// `{ configured: false, reason: ... }` and the form degrades to a
// "we'll confirm after payment" message. The `reason` is plumbed into
// the funnel log so Axiom shows *why* a particular check came back
// unknown (vs the old behaviour where we silently logged nothing).

const PROD_ENDPOINT = 'https://api.namecheap.com/xml.response';
const SANDBOX_ENDPOINT = 'https://api.sandbox.namecheap.com/xml.response';

export type AvailabilityReason =
  | 'proxy_unconfigured'      // PROXY_URL/PROXY_TOKEN unset AND no direct creds
  | 'proxy_non_ok'            // proxy returned HTTP !2xx
  | 'proxy_invalid_response'  // proxy returned 2xx but body shape unexpected
  | 'proxy_request_failed'    // network error / timeout calling proxy
  | 'direct_parse_failed'     // direct Namecheap XML didn't match the regex
  | 'direct_request_failed';  // network error / timeout calling Namecheap

export type AvailabilityResult =
  | {
      configured: false;
      reason: AvailabilityReason;
      // Upstream HTTP status when relevant (proxy_non_ok). Useful for
      // distinguishing "proxy is down" (500/502) from "proxy rejected us"
      // (401/403 — wrong PROXY_TOKEN).
      upstream_status?: number;
    }
  | {
      configured: true;
      available: boolean;
      premium: boolean;
      // Wholesale/retail price for new 1-year registration in USD. Null
      // when the proxy couldn't determine it (older proxy build, pricing
      // API failure, premium without an explicit price). Treat null as
      // "unknown — don't auto-register" at the caller.
      registration_price_usd: number | null;
    };

export async function checkDomainAvailability(
  domain: string,
): Promise<AvailabilityResult> {
  // Path 1: proxy (production). Credentials live on Railway, we just need
  // the URL + a shared secret here.
  const proxyUrl = process.env.NAMECHEAP_PROXY_URL;
  const proxyToken = process.env.NAMECHEAP_PROXY_TOKEN;
  if (proxyUrl && proxyToken) {
    try {
      const res = await fetch(`${proxyUrl.replace(/\/$/, '')}/availability`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${proxyToken}`,
        },
        body: JSON.stringify({ domain }),
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) {
        console.warn('[namecheap] proxy non-OK', { domain, status: res.status });
        return { configured: false, reason: 'proxy_non_ok', upstream_status: res.status };
      }
      const data = (await res.json()) as {
        available?: boolean;
        premium?: boolean;
        registration_price_usd?: number | null;
      };
      if (typeof data.available !== 'boolean') {
        console.warn('[namecheap] proxy invalid response', { domain, data });
        return { configured: false, reason: 'proxy_invalid_response' };
      }
      return {
        configured: true,
        available: data.available,
        premium: data.premium === true,
        registration_price_usd:
          typeof data.registration_price_usd === 'number' ? data.registration_price_usd : null,
      };
    } catch (err) {
      console.warn('[namecheap] proxy request failed', { domain, err });
      return { configured: false, reason: 'proxy_request_failed' };
    }
  }

  // Path 2: direct Namecheap call (local dev with whitelisted home IP).
  const apiUser = process.env.NAMECHEAP_API_USER;
  const apiKey = process.env.NAMECHEAP_API_KEY;
  const userName = process.env.NAMECHEAP_USERNAME;
  const clientIp = process.env.NAMECHEAP_CLIENT_IP;
  if (!apiUser || !apiKey || !userName || !clientIp) {
    return { configured: false, reason: 'proxy_unconfigured' };
  }

  const endpoint =
    process.env.NAMECHEAP_SANDBOX === 'true' ? SANDBOX_ENDPOINT : PROD_ENDPOINT;
  const params = new URLSearchParams({
    ApiUser: apiUser,
    ApiKey: apiKey,
    UserName: userName,
    ClientIp: clientIp,
    Command: 'namecheap.domains.check',
    DomainList: domain,
  });

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
      console.warn('[namecheap] parse failed', { domain, snippet: xml.slice(0, 200) });
      return { configured: false, reason: 'direct_parse_failed' };
    }
    return {
      configured: true,
      available: match[1] === 'true',
      premium: match[2] === 'true',
      // Direct-path callers (local dev) don't get a price — the proxy is the
      // only path that fetches getPricing. Null means "skip the price gate."
      registration_price_usd: null,
    };
  } catch (err) {
    console.warn('[namecheap] direct request failed', { domain, err });
    return { configured: false, reason: 'direct_request_failed' };
  }
}

/**
 * Generate a few sensible .com alternatives when the requested name is
 * taken. Purely local — no Namecheap calls. Callers can subsequently
 * check the alternatives via checkDomainAvailability if desired.
 */
export function suggestAlternatives(base: string): string[] {
  const stem = base
    .toLowerCase()
    .replace(/\.com$/, '')
    .replace(/[^a-z0-9]/g, '');
  if (!stem) return [];
  return [
    `${stem}hq.com`,
    `${stem}shop.com`,
    `${stem}studio.com`,
    `get${stem}.com`,
    `${stem}official.com`,
  ];
}

// ============================================================================
// Registration + DNS — proxy-only. Used by the auto-provisioning flow.
// ============================================================================

export type RegistrantContact = {
  firstName: string;
  lastName: string;
  address1: string;
  address2?: string;
  city: string;
  stateProvince: string;
  postalCode: string;
  country: string;        // ISO-3166-1 alpha-2, e.g. 'US'
  phone: string;          // Namecheap format: '+1.5551234567'
  emailAddress: string;
};

export type RegisterResult =
  | {
      registered: true;
      domain: string;
      years: number;
      charged_amount_usd: number | null;
    }
  | {
      registered: false;
      error: string;
      namecheap_error_number?: string | null;
      namecheap_error_message?: string | null;
      upstream_status?: number;
    };

export function registrantContactFromEnv(): RegistrantContact | null {
  const required: Record<keyof Omit<RegistrantContact, 'address2'>, string | undefined> = {
    firstName: process.env.NAMECHEAP_REGISTRANT_FIRST_NAME,
    lastName: process.env.NAMECHEAP_REGISTRANT_LAST_NAME,
    address1: process.env.NAMECHEAP_REGISTRANT_ADDRESS1,
    city: process.env.NAMECHEAP_REGISTRANT_CITY,
    stateProvince: process.env.NAMECHEAP_REGISTRANT_STATE_PROVINCE,
    postalCode: process.env.NAMECHEAP_REGISTRANT_POSTAL_CODE,
    country: process.env.NAMECHEAP_REGISTRANT_COUNTRY,
    phone: process.env.NAMECHEAP_REGISTRANT_PHONE,
    emailAddress: process.env.NAMECHEAP_REGISTRANT_EMAIL,
  };
  for (const v of Object.values(required)) {
    if (!v) return null;
  }
  const address2 = process.env.NAMECHEAP_REGISTRANT_ADDRESS2;
  return {
    ...(required as { [K in keyof typeof required]: string }),
    ...(address2 ? { address2 } : {}),
  };
}

async function callProxy<T>(
  path: string,
  body: Record<string, unknown>,
  timeoutMs: number,
): Promise<{ ok: true; data: T } | { ok: false; status?: number; error: string }> {
  const proxyUrl = process.env.NAMECHEAP_PROXY_URL;
  const proxyToken = process.env.NAMECHEAP_PROXY_TOKEN;
  if (!proxyUrl || !proxyToken) {
    return { ok: false, error: 'proxy_unconfigured' };
  }
  try {
    const res = await fetch(`${proxyUrl.replace(/\/$/, '')}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${proxyToken}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const data = (await res.json().catch(() => null)) as T | null;
    if (!res.ok || data === null) {
      return { ok: false, status: res.status, error: 'proxy_non_ok' };
    }
    return { ok: true, data };
  } catch (err) {
    console.warn('[namecheap] proxy request failed', { path, err });
    return { ok: false, error: 'proxy_request_failed' };
  }
}

export async function registerDomain(
  domain: string,
  contact: RegistrantContact,
  years = 1,
): Promise<RegisterResult> {
  const result = await callProxy<{
    registered?: boolean;
    domain?: string;
    years?: number;
    charged_amount_usd?: number | null;
    error?: string;
    namecheap_error_number?: string | null;
    namecheap_error_message?: string | null;
  }>('/register', { domain, years, contact }, 30000);

  if (!result.ok) {
    return {
      registered: false,
      error: result.error,
      ...(result.status ? { upstream_status: result.status } : {}),
    };
  }
  if (result.data.registered === true && typeof result.data.domain === 'string') {
    return {
      registered: true,
      domain: result.data.domain,
      years: result.data.years ?? years,
      charged_amount_usd:
        typeof result.data.charged_amount_usd === 'number'
          ? result.data.charged_amount_usd
          : null,
    };
  }
  return {
    registered: false,
    error: result.data.error ?? 'registration_failed',
    namecheap_error_number: result.data.namecheap_error_number ?? null,
    namecheap_error_message: result.data.namecheap_error_message ?? null,
  };
}

export type SetNameserversResult =
  | { updated: true; domain: string; nameservers: string[] }
  | {
      updated: false;
      error: string;
      namecheap_error_number?: string | null;
      namecheap_error_message?: string | null;
    };

export async function setNameservers(
  domain: string,
  nameservers: string[],
): Promise<SetNameserversResult> {
  const result = await callProxy<{
    updated?: boolean;
    domain?: string;
    nameservers?: string[];
    error?: string;
    namecheap_error_number?: string | null;
    namecheap_error_message?: string | null;
  }>('/dns/set-custom', { domain, nameservers }, 15000);

  if (!result.ok) {
    return { updated: false, error: result.error };
  }
  if (result.data.updated === true && typeof result.data.domain === 'string') {
    return {
      updated: true,
      domain: result.data.domain,
      nameservers: result.data.nameservers ?? nameservers,
    };
  }
  return {
    updated: false,
    error: result.data.error ?? 'set_nameservers_failed',
    namecheap_error_number: result.data.namecheap_error_number ?? null,
    namecheap_error_message: result.data.namecheap_error_message ?? null,
  };
}
