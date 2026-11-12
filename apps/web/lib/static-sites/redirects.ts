import { createServiceRoleClient } from '@/lib/supabase/server';

export type Redirect = { from: string; to: string };

/** Normalize a path for matching: leading slash, no trailing slash, lowercased. */
function normalizePath(p: string): string {
  let s = (p || '').trim();
  if (!s.startsWith('/') && !/^https?:\/\//i.test(s)) s = `/${s}`;
  if (s.length > 1 && !s.includes('?')) s = s.replace(/\/+$/, '');
  return s.toLowerCase();
}

/**
 * Redirect target for `path` on this client, or null. Scoped by clientId.
 * Only called on a would-be 404, so the extra query is paid rarely.
 */
export async function findRedirect(clientId: string, path: string): Promise<string | null> {
  const admin = createServiceRoleClient();
  const { data } = await admin.from('clients').select('redirects').eq('id', clientId).maybeSingle();
  const list = data?.redirects;
  if (!Array.isArray(list)) return null;

  const want = normalizePath(path);
  for (const r of list as Redirect[]) {
    if (r && typeof r.from === 'string' && typeof r.to === 'string' && normalizePath(r.from) === want) {
      return r.to.trim();
    }
  }
  return null;
}

/**
 * Parse the admin textarea into a clean redirect list. One rule per line:
 *   /old-path -> /new-path     (also accepts "→", "=>", or whitespace/comma)
 * Blank lines and lines starting with # are ignored.
 */
export function parseRedirects(text: string): Redirect[] {
  const out: Redirect[] = [];
  for (const raw of (text || '').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const parts = line.split(/\s*(?:->|=>|→|,|\s)\s*/).filter(Boolean);
    if (parts.length < 2) continue;
    const from = parts[0]!.trim();
    const to = parts[parts.length - 1]!.trim();
    if (from && to) out.push({ from, to });
  }
  // De-dupe by `from` (last one wins), cap to a sane size.
  const byFrom = new Map<string, Redirect>();
  for (const r of out) byFrom.set(normalizePath(r.from), r);
  return Array.from(byFrom.values()).slice(0, 500);
}

/** Render the list back into the textarea format for editing. */
export function redirectsToText(list: unknown): string {
  if (!Array.isArray(list)) return '';
  return (list as Redirect[])
    .filter((r) => r && typeof r.from === 'string' && typeof r.to === 'string')
    .map((r) => `${r.from} -> ${r.to}`)
    .join('\n');
}
