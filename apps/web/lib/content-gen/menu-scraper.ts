// Uber Eats menu scraper client — calls an external scraper service (n8n
// webhook) at MENU_SCRAPER_URL, validates the response against the same
// constraints the admin menu route enforces, and returns a discriminated
// outcome the pipeline can branch on.
//
// The scraper itself runs outside Vercel because it needs persistent session
// cookies (Uber Eats requires browser-shaped requests with a uev2.* cookie
// that gets re-issued weekly). Keeping it off-platform also isolates the
// scraping IP from our build/serving IPs.
//
// Outcomes: hit → use the returned menu; miss / timeout / error / invalid /
// disabled → caller should fall back to the LLM skeleton. Never throws.

import { z } from 'zod';
import { isAllowedPhotoUrl } from '@/lib/photos/url-whitelist';
import type { MenuConfig } from '@dfy/db';

const DEFAULT_TIMEOUT_MS = 10_000;

// Mirror of the admin /menu PUT validation (lengths, dietary tags, host
// whitelist). The scraper is trusted to mint UUIDs for category/item ids.
const itemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(80),
  description: z.string().max(280).default(''),
  price: z.string().max(40).default(''),
  dietary: z.array(z.enum(['gf', 'vg', 'v', 'df', 'spicy', 'nf'])).optional(),
  photo_url: z
    .string()
    .max(500)
    .refine(isAllowedPhotoUrl, { message: 'photo_url host not allowed' })
    .optional(),
});

const categorySchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(60),
  description: z.string().max(160).optional(),
  items: z.array(itemSchema).min(1).max(40),
});

const hitSchema = z.object({
  found: z.literal(true),
  menu: z.object({
    show_images: z.boolean().optional(),
    categories: z.array(categorySchema).min(1).max(20),
  }),
});

const missSchema = z.object({ found: z.literal(false) });

const responseSchema = z.union([hitSchema, missSchema]);

export type ScrapeOutcome =
  | { status: 'hit'; menu: MenuConfig; itemCount: number }
  | { status: 'miss' }
  | { status: 'timeout' }
  | { status: 'invalid'; reason: string }
  | { status: 'error'; reason: string }
  | { status: 'disabled' };

export type ScrapeInput = {
  business_name: string;
  lat: number;
  lng: number;
};

// Build an ordered list of candidate search queries to try against Uber.
// We can't know in advance how Uber spells a business ("Tier10" vs
// "Tier 10"), so instead of guessing we try most-specific first and only
// fall back to looser variants if it misses. Deduped so identical
// candidates (e.g. names with no dash and no letter-digit runs) only
// trigger one network call.
function candidatesForSearch(name: string): string[] {
  const trimmed = name.trim();
  const dashStripped = (trimmed.split(/\s+[-–—|]\s+/)[0] ?? trimmed).trim();
  const spaceInjected = dashStripped
    .replace(/([a-zA-Z])(\d)/g, '$1 $2')
    .replace(/(\d)([a-zA-Z])/g, '$1 $2');
  return [...new Set([trimmed, dashStripped, spaceInjected])].filter(Boolean);
}

async function attemptScrape(
  url: string,
  secret: string,
  body: ScrapeInput,
  signal: AbortSignal,
): Promise<ScrapeOutcome> {
  let resp: Response;
  try {
    resp = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-scraper-secret': secret },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') return { status: 'timeout' };
    return { status: 'error', reason: (err as Error)?.message ?? 'fetch_failed' };
  }

  if (!resp.ok) return { status: 'error', reason: `http_${resp.status}` };

  let payload: unknown;
  try {
    payload = await resp.json();
  } catch {
    return { status: 'invalid', reason: 'non_json' };
  }

  const parsed = responseSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      status: 'invalid',
      reason: parsed.error.issues[0]?.message ?? 'schema_mismatch',
    };
  }
  if (parsed.data.found === false) return { status: 'miss' };

  const itemCount = parsed.data.menu.categories.reduce(
    (n, c) => n + c.items.length,
    0,
  );
  return { status: 'hit', menu: parsed.data.menu, itemCount };
}

export async function scrapeMenuFromUberEats(
  input: ScrapeInput,
  opts: { timeoutMs?: number } = {},
): Promise<ScrapeOutcome> {
  const url = process.env.MENU_SCRAPER_URL;
  const secret = process.env.MENU_SCRAPER_SECRET;
  if (!url || !secret) return { status: 'disabled' };

  // One shared abort budget across all candidate attempts so the total
  // wait stays bounded by timeoutMs regardless of how many variants we try.
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  let lastOutcome: ScrapeOutcome = { status: 'miss' };
  try {
    for (const candidate of candidatesForSearch(input.business_name)) {
      lastOutcome = await attemptScrape(
        url,
        secret,
        { business_name: candidate, lat: input.lat, lng: input.lng },
        ctl.signal,
      );
      // Stop on success or on a non-miss failure — only a clean miss is
      // worth retrying with a looser query variant.
      if (lastOutcome.status !== 'miss') break;
    }
  } finally {
    clearTimeout(timer);
  }

  return lastOutcome;
}
