import { cheapPreviewSlug } from '@/lib/marketing-brand';

// ============================================================================
// Edge-safe host → client resolution for the proxy (static slug + brand).
//
// The proxy runs on every customer-site request and can't use the Node
// Supabase SDK, so this hits PostgREST directly with a plain fetch and caches
// the result (positive AND negative) in module scope with a short TTL. The
// Next docs warn the proxy isn't for "slow data fetching" — the cache is what
// keeps this to a single round-trip per host per TTL per edge instance, not
// per request.
//
// TTL is deliberately short so activating/converting a site reflects quickly;
// staleness is bounded to CACHE_TTL_MS.
// ============================================================================

const CACHE_TTL_MS = 60_000;

export type HostClient = {
  slug: string;
  /** Renders an uploaded R2 bundle (served by /h/<slug>) instead of the template. */
  isStatic: boolean;
  /** clients.brand — decides which domain the client's subdomain lives on. */
  brand: string;
};

type CacheEntry = { client: HostClient | null; expires: number };
const cache = new Map<string, CacheEntry>();

/**
 * Resolve a hostname to its client, or null for an unknown host (or a
 * misconfigured env). Never throws.
 */
export async function lookupClientHost(hostname: string): Promise<HostClient | null> {
  const now = Date.now();
  const hit = cache.get(hostname);
  if (hit && hit.expires > now) return hit.client;

  const client = await queryClientHost(hostname);
  cache.set(hostname, { client, expires: now + CACHE_TTL_MS });
  return client;
}

async function queryClientHost(hostname: string): Promise<HostClient | null> {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const platformDomain = process.env.PLATFORM_DOMAIN ?? '';
  if (!baseUrl || !key) return null;

  const brandSlug = cheapPreviewSlug(hostname);
  const isSubdomain = !!brandSlug || (!!platformDomain && hostname.endsWith('.' + platformDomain));
  const column = isSubdomain ? 'slug' : 'custom_domain';
  const value = brandSlug ?? (isSubdomain ? hostname.replace('.' + platformDomain, '') : hostname);

  const url = `${baseUrl}/rest/v1/clients?${column}=eq.${encodeURIComponent(value)}&select=slug,render_mode,brand&limit=1`;

  try {
    const res = await fetch(url, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as Array<{ slug: string; render_mode: string | null; brand: string | null }>;
    const row = rows[0];
    return row ? { slug: row.slug, isStatic: row.render_mode === 'static', brand: row.brand ?? 'stoopcraft' } : null;
  } catch {
    return null;
  }
}
