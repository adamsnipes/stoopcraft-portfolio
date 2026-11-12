// Orchestrates a single scrape run: Google Places → filter ladder →
// city-level dedupe → Twilio LTI → write leads.
//
// The dedupe story:
//   scraped_seen_places stores every place_id we've examined for a
//   (niche, canonical_city), including rejections. On a re-run we look
//   up the batch up-front and skip anything seen within RECHECK_WINDOW.
//   That skips the Twilio call entirely for repeats, which is where the
//   real money is.
//
// Filter ladder (cheap → expensive):
//   1. Status / name presence (free)
//   2. Chain blacklist (free, in-memory)
//   3. Adjacency filter (free, in-memory)
//   4. No-website check (free) — optional via opts.noWebsiteOnly
//   5. Phone presence + E.164 normalization (free)
//   6. seen_places dedup for this (niche, city) (one batched DB read)
//   7. Cross-city phone dedup against scraped_leads (one batched DB read)
//   8. Twilio LTI mobile validation (paid) — optional via opts.mobileOnly

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@dfy/db';
import { resolveNiche, canonicalizeCity, SOCIAL_AS_WEBSITE_DOMAINS } from './niches';
import { searchPlacesPaginated, type RawPlace } from './places-search';
import { normalizePhone, lookupNumber } from './twilio-lookup';

const RECHECK_WINDOW_DAYS = 30;
const PLACES_CALL_BUDGET = 30;
const TWILIO_CALL_BUDGET = 400;

export type ScrapeOptions = {
  niche: string;
  location: string;
  targetCount: number;
  noWebsiteOnly: boolean;
  mobileOnly: boolean;
  forceRecheckSeen: boolean;
};

export type ScrapeStats = {
  candidatesSeen: number;
  candidatesSkippedAsSeen: number;
  placesApiCalls: number;
  twilioApiCalls: number;
  leadsFound: number;
};

type SeenDecision =
  | 'kept'
  | 'chain'
  | 'adjacent'
  | 'has_website'
  | 'no_phone'
  | 'not_mobile'
  | 'blocked_carrier'
  | 'closed'
  | 'duplicate_phone'
  | 'invalid_phone';

type Sb = SupabaseClient<Database>;

function nameLower(p: RawPlace): string {
  return (p.displayName?.text ?? '').toLowerCase();
}

function isChain(name: string, chains: string[]): boolean {
  return chains.some((kw) => name.includes(kw));
}

function isNoWebsite(uri: string | undefined): boolean {
  const u = (uri ?? '').trim().toLowerCase();
  if (!u) return true;
  return SOCIAL_AS_WEBSITE_DOMAINS.some((d) => u.includes(d));
}

// Pull every seen place_id for (niche, city) within the recheck window in
// one query, so per-place lookups are an O(1) Set hit.
async function loadSeenPlaceIds(
  sb: Sb,
  niche: string,
  canonicalCity: string,
): Promise<Set<string>> {
  const cutoff = new Date(Date.now() - RECHECK_WINDOW_DAYS * 24 * 3600 * 1000).toISOString();
  const { data } = await sb
    .from('scraped_seen_places')
    .select('place_id')
    .eq('niche', niche)
    .eq('canonical_city', canonicalCity)
    .gte('last_seen_at', cutoff);
  return new Set((data ?? []).map((r) => r.place_id));
}

// Pull every phone we've already saved as a lead — used for cross-city
// dedupe (same business listed under multiple neighborhoods).
async function loadSeenPhones(sb: Sb, niche: string): Promise<Set<string>> {
  const { data } = await sb
    .from('scraped_leads')
    .select('normalized_phone')
    .eq('niche', niche);
  return new Set((data ?? []).map((r) => r.normalized_phone));
}

async function upsertSeen(
  sb: Sb,
  placeId: string,
  niche: string,
  canonicalCity: string,
  decision: SeenDecision,
  runId: string,
): Promise<void> {
  const now = new Date().toISOString();
  await sb.from('scraped_seen_places').upsert(
    {
      place_id: placeId,
      niche,
      canonical_city: canonicalCity,
      decision,
      last_seen_at: now,
      last_run_id: runId,
    },
    { onConflict: 'place_id,niche' },
  );
}

export async function runScrape(opts: {
  sb: Sb;
  runId: string;
  scrapeOpts: ScrapeOptions;
  googleApiKey: string;
  twilioSid: string | null;
  twilioAuthToken: string | null;
}): Promise<ScrapeStats> {
  const { sb, runId, scrapeOpts, googleApiKey, twilioSid, twilioAuthToken } = opts;
  const niche = resolveNiche(scrapeOpts.niche);
  const canonicalCity = canonicalizeCity(scrapeOpts.location);

  // Fan out: ask Google for enough candidates to cover the filter funnel.
  // Trades and "no-website" filters reject heavily, so we oversample.
  const maxResults = Math.min(scrapeOpts.targetCount * 8, PLACES_CALL_BUDGET * 20);

  const stats: ScrapeStats = {
    candidatesSeen: 0,
    candidatesSkippedAsSeen: 0,
    placesApiCalls: 0,
    twilioApiCalls: 0,
    leadsFound: 0,
  };

  const seenPlaceIds = scrapeOpts.forceRecheckSeen
    ? new Set<string>()
    : await loadSeenPlaceIds(sb, niche.key, canonicalCity);
  const seenPhones = await loadSeenPhones(sb, niche.key);

  const { places, apiCalls } = await searchPlacesPaginated({
    query: niche.query,
    location: scrapeOpts.location,
    maxResults,
    apiKey: googleApiKey,
  });
  stats.placesApiCalls = apiCalls;
  stats.candidatesSeen = places.length;

  for (const place of places) {
    if (stats.leadsFound >= scrapeOpts.targetCount) break;
    if (stats.twilioApiCalls >= TWILIO_CALL_BUDGET) break;

    const id = place.id;
    if (!id) continue;

    // Fast path: skip anything we've seen recently for this (niche, city).
    // No DB write — we don't want to bump last_seen_at on every re-run
    // and accidentally extend the recheck window indefinitely.
    if (seenPlaceIds.has(id)) {
      stats.candidatesSkippedAsSeen += 1;
      continue;
    }
    seenPlaceIds.add(id);

    const name = (place.displayName?.text ?? '').trim();
    if (!name) continue;

    if ((place.businessStatus ?? 'OPERATIONAL') !== 'OPERATIONAL') {
      await upsertSeen(sb, id, niche.key, canonicalCity, 'closed', runId);
      continue;
    }

    const nl = nameLower(place);
    if (isChain(nl, niche.chainKeywords)) {
      await upsertSeen(sb, id, niche.key, canonicalCity, 'chain', runId);
      continue;
    }
    if (niche.adjacencyFilter?.(nl)) {
      await upsertSeen(sb, id, niche.key, canonicalCity, 'adjacent', runId);
      continue;
    }

    const websiteUri = place.websiteUri?.trim() ?? '';
    const usesSocialAsWebsite = !!websiteUri && isNoWebsite(websiteUri);
    const noWebsite = !websiteUri;
    if (scrapeOpts.noWebsiteOnly && !noWebsite && !usesSocialAsWebsite) {
      await upsertSeen(sb, id, niche.key, canonicalCity, 'has_website', runId);
      continue;
    }

    const rawPhone = (place.nationalPhoneNumber ?? '').trim();
    if (!rawPhone) {
      await upsertSeen(sb, id, niche.key, canonicalCity, 'no_phone', runId);
      continue;
    }
    const normalized = normalizePhone(rawPhone);
    if (!normalized) {
      await upsertSeen(sb, id, niche.key, canonicalCity, 'invalid_phone', runId);
      continue;
    }

    if (seenPhones.has(normalized)) {
      await upsertSeen(sb, id, niche.key, canonicalCity, 'duplicate_phone', runId);
      continue;
    }

    let lineType: string | null = null;
    if (scrapeOpts.mobileOnly) {
      if (!twilioSid || !twilioAuthToken) {
        throw new Error('twilio_not_configured');
      }
      stats.twilioApiCalls += 1;
      const lookup = await lookupNumber({
        phoneE164: normalized,
        sid: twilioSid,
        authToken: twilioAuthToken,
      });
      if (!lookup.ok) {
        const decision: SeenDecision =
          lookup.reason === 'blocked_carrier'
            ? 'blocked_carrier'
            : lookup.reason === 'invalid'
              ? 'invalid_phone'
              : 'not_mobile';
        await upsertSeen(sb, id, niche.key, canonicalCity, decision, runId);
        continue;
      }
      if (!lookup.isMobile) {
        await upsertSeen(sb, id, niche.key, canonicalCity, 'not_mobile', runId);
        continue;
      }
      lineType = lookup.lineType;
    }

    seenPhones.add(normalized);

    const { error } = await sb.from('scraped_leads').insert({
      place_id: id,
      scrape_run_id: runId,
      business_name: name,
      address: place.formattedAddress ?? null,
      phone: rawPhone,
      normalized_phone: normalized,
      niche: niche.key,
      canonical_city: canonicalCity,
      location_input: scrapeOpts.location,
      rating: typeof place.rating === 'number' ? place.rating : null,
      review_count: typeof place.userRatingCount === 'number' ? place.userRatingCount : null,
      uses_social_as_website: usesSocialAsWebsite,
      website_uri: websiteUri || null,
      line_type: lineType,
    });

    if (!error) {
      stats.leadsFound += 1;
      await upsertSeen(sb, id, niche.key, canonicalCity, 'kept', runId);
    }
  }

  return stats;
}
