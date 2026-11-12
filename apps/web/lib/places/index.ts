import Anthropic from '@anthropic-ai/sdk';
import sharp from 'sharp';
import { z } from 'zod';

const anthropic = new Anthropic();

// `reviews` is intentionally excluded — it pushes Place Details into the
// Enterprise + Atmosphere SKU ($25/1K, 1K free) vs Pro ($17/1K, 5K free).
// `primaryType` + `types` are how we infer the business niche server-side
// (lib/content-gen/niche-inference.ts) so the landing-page flow doesn't need
// to ask the user.
const FIELD_MASK = [
  'displayName',
  'formattedAddress',
  'addressComponents',
  'nationalPhoneNumber',
  'location',
  'businessStatus',
  'photos',
  'primaryType',
  'types',
].join(',');

export type PlaceData = {
  business_name: string;
  address: string;
  city: string;
  state: string;
  phone: string | null;
  lat: number | null;
  lng: number | null;
  business_status: string;
  photo_references: string[];
  // GBP category as the owner set it — used to infer niche without asking
  // the user. Empty string if Google didn't return one.
  primary_type: string;
  types: string[];
};

type V1AddressComponent = {
  longText: string;
  shortText: string;
  types: string[];
};

type V1Response = {
  displayName?: { text: string };
  formattedAddress?: string;
  addressComponents?: V1AddressComponent[];
  nationalPhoneNumber?: string;
  location?: { latitude: number; longitude: number };
  businessStatus?: string;
  photos?: Array<{ name: string }>;
  primaryType?: string;
  types?: string[];
};

const ACCEPTED_MEDIA_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

const rankItemSchema = z.object({
  photo: z.number().int().min(1),
  score: z.number().int().min(1).max(10),
});

function rankingSchema(photoCount: number) {
  return z
    .array(rankItemSchema)
    .min(1)
    .refine((arr) => new Set(arr.map((i) => i.photo)).size === arr.length, { message: 'duplicates' })
    .refine((arr) => arr.every((i) => i.photo >= 1 && i.photo <= photoCount), {
      message: 'out of range',
    });
}

const HERO_SCORE_THRESHOLD = 3;

export type FetchedPhoto = { ref: string; buffer: Buffer };

const MAX_STORED_PHOTOS = 8;
const RANK_POOL_SIZE = 10;

/**
 * Fetch up to MAX_STORED_PHOTOS photos at full storage resolution and return
 * them with their raw buffers. Each photo costs one Place Details Photos
 * billable call; we never fetch the same photo twice.
 *
 * If the place has more candidates than we'd store, we fetch RANK_POOL_SIZE
 * (10) and ask Claude to rank from in-memory thumbnails — no extra Google
 * calls — then keep the top MAX_STORED_PHOTOS (8) buffers.
 */
export async function fetchAndRankPhotos(refs: string[], niche: string): Promise<FetchedPhoto[]> {
  if (refs.length === 0) return [];

  const apiKey = process.env.GOOGLE_PLACES_API_KEY!;
  // No reason to fetch more than we'd ever rank or store.
  const willRank = refs.length > MAX_STORED_PHOTOS;
  const toFetch = refs.slice(0, willRank ? RANK_POOL_SIZE : MAX_STORED_PHOTOS);

  const fetched = await Promise.all(
    toFetch.map(async (ref) => {
      const url = new URL(`https://places.googleapis.com/v1/${ref}/media`);
      url.searchParams.set('key', apiKey);
      url.searchParams.set('maxWidthPx', '1600');
      try {
        const res = await fetch(url.toString(), { redirect: 'follow' });
        if (!res.ok) return null;
        const mediaType = (res.headers.get('content-type') ?? 'image/jpeg').split(';')[0]!.trim();
        if (!ACCEPTED_MEDIA_TYPES.has(mediaType)) return null;
        const buffer = Buffer.from(await res.arrayBuffer());
        return { ref, buffer };
      } catch {
        return null;
      }
    })
  );

  const valid = fetched.filter((x): x is NonNullable<typeof x> => x !== null);
  if (valid.length <= MAX_STORED_PHOTOS) return valid;

  // Build thumbnails in-memory from the buffers we already have.
  const withThumbs = await Promise.all(
    valid.map(async (item) => {
      try {
        const thumb = await sharp(item.buffer)
          .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 80 })
          .toBuffer();
        return { ...item, thumbBase64: thumb.toString('base64') };
      } catch {
        return null;
      }
    })
  );
  const ranked = withThumbs.filter((x): x is NonNullable<typeof x> => x !== null);
  if (ranked.length <= MAX_STORED_PHOTOS) {
    return ranked.map(({ ref, buffer }) => ({ ref, buffer }));
  }

  const imageBlocks = ranked.flatMap((t, pos) => [
    { type: 'text' as const, text: `Photo ${pos + 1}:` },
    {
      type: 'image' as const,
      source: { type: 'base64' as const, media_type: 'image/jpeg' as const, data: t.thumbBase64 },
    },
  ]);

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 400,
      tools: [
        {
          name: 'rank_photos',
          description: 'Score every photo for suitability as a full-bleed hero background image',
          input_schema: {
            type: 'object' as const,
            properties: {
              rankings: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    photo: {
                      type: 'integer',
                      minimum: 1,
                      maximum: ranked.length,
                      description: 'Photo number (1-indexed)',
                    },
                    score: {
                      type: 'integer',
                      minimum: 1,
                      maximum: 10,
                      description:
                        '1=completely unusable, 10=perfect hero. Score 1-3 for screenshots/ads/text images.',
                    },
                  },
                  required: ['photo', 'score'],
                },
                description: 'All photos with scores. Every photo must appear exactly once.',
              },
            },
            required: ['rankings'],
          },
        },
      ],
      tool_choice: { type: 'tool', name: 'rank_photos' },
      messages: [
        {
          role: 'user',
          content: [
            ...imageBlocks,
            {
              type: 'text',
              text: `These are photos from a ${niche.replace('_', ' ')} business. Score every photo (1–10) for use as a full-bleed hero background on a professional landing page.

Score 8–10 (great): wide establishing shot of the interior or exterior, good lighting, shows the business environment, visual breathing room for text overlay.

Score 1–3 (unusable): screenshot or text-heavy image, advertisement or promotional flyer, logo/graphic without real photography, extreme close-up, very dark or blurry, does not show the actual business space.

Score all ${ranked.length} photos.`,
            },
          ],
        },
      ],
    });

    const toolUse = response.content.find((b) => b.type === 'tool_use');
    if (!toolUse || toolUse.type !== 'tool_use') {
      return ranked.slice(0, MAX_STORED_PHOTOS).map(({ ref, buffer }) => ({ ref, buffer }));
    }

    const scored = rankingSchema(ranked.length).parse(
      (toolUse.input as { rankings: unknown }).rankings
    );

    const sorted = [...scored].sort((a, b) => {
      const aUsable = a.score > HERO_SCORE_THRESHOLD;
      const bUsable = b.score > HERO_SCORE_THRESHOLD;
      if (aUsable !== bUsable) return aUsable ? -1 : 1;
      return b.score - a.score;
    });

    return sorted.slice(0, MAX_STORED_PHOTOS).map((item) => {
      const src = ranked[item.photo - 1]!;
      return { ref: src.ref, buffer: src.buffer };
    });
  } catch {
    return ranked.slice(0, MAX_STORED_PHOTOS).map(({ ref, buffer }) => ({ ref, buffer }));
  }
}

export type PlaceSearchCandidate = {
  id: string;
  displayName: string;
  formattedAddress: string;
  // GBP category — surfaced on the candidate card so the user visually
  // confirms the right business type before clicking generate.
  primaryType: string;
};

// Geocode a free-form location string (state, city, zip) into a viewport
// rectangle. Used purely as a soft `locationBias` for Text Search — so
// service-area businesses (mobile detailers, etc.) that have no street
// address still surface alongside storefronts in the bias region. The
// Geocoding API shares the same project key as Places; if the API isn't
// enabled or the query is unparseable, we return null and the caller falls
// through to today's unbiased behavior.
type GeocodedViewport = {
  low: { latitude: number; longitude: number };
  high: { latitude: number; longitude: number };
};

async function geocodeViewport(address: string): Promise<GeocodedViewport | null> {
  const trimmed = address.trim();
  if (!trimmed) return null;
  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  url.searchParams.set('address', trimmed);
  url.searchParams.set('region', 'us');
  url.searchParams.set('key', process.env.GOOGLE_PLACES_API_KEY!);
  try {
    const res = await fetch(url.toString());
    if (!res.ok) return null;
    const data = (await res.json()) as {
      status?: string;
      results?: Array<{
        geometry?: {
          viewport?: {
            northeast?: { lat: number; lng: number };
            southwest?: { lat: number; lng: number };
          };
        };
      }>;
    };
    if (data.status !== 'OK') return null;
    const vp = data.results?.[0]?.geometry?.viewport;
    if (!vp?.northeast || !vp?.southwest) return null;
    return {
      low: { latitude: vp.southwest.lat, longitude: vp.southwest.lng },
      high: { latitude: vp.northeast.lat, longitude: vp.northeast.lng },
    };
  } catch {
    return null;
  }
}

export async function searchPlacesByText(
  textQuery: string,
  addressHint?: string,
): Promise<PlaceSearchCandidate[]> {
  // Pure SABs (mobile detailers, cleaners, plumbers, etc.) are excluded
  // from Text Search by default. Opting in returns them alongside
  // storefronts — storefront recall is unaffected.
  const body: Record<string, unknown> = {
    textQuery,
    includePureServiceAreaBusinesses: true,
  };

  // Soft bias only — `locationBias` boosts matches inside the rectangle
  // but never excludes outside ones. Storefronts that already rank via
  // text relevance still win; SABs in the region get a fair shot.
  if (addressHint?.trim()) {
    const viewport = await geocodeViewport(addressHint);
    if (viewport) body.locationBias = { rectangle: viewport };
  }

  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': process.env.GOOGLE_PLACES_API_KEY!,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.primaryType',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) return [];

  const data = (await res.json()) as {
    places?: Array<{
      id?: string;
      displayName?: { text?: string };
      formattedAddress?: string;
      primaryType?: string;
    }>;
  };

  return (data.places ?? [])
    .filter((p): p is {
      id: string;
      displayName?: { text?: string };
      formattedAddress?: string;
      primaryType?: string;
    } => typeof p.id === 'string' && p.id.length > 0)
    .map((p) => ({
      id: p.id,
      displayName: p.displayName?.text ?? '',
      formattedAddress: p.formattedAddress ?? '',
      primaryType: p.primaryType ?? '',
    }));
}

export async function fetchPlaceData(placeId: string): Promise<PlaceData | null> {
  const url = `https://places.googleapis.com/v1/places/${placeId}?key=${process.env.GOOGLE_PLACES_API_KEY!}`;
  const res = await fetch(url, { headers: { 'X-Goog-FieldMask': FIELD_MASK } });
  if (!res.ok) return null;

  const data = (await res.json()) as V1Response;

  const components = data.addressComponents ?? [];
  // `types` is documented as required, but the API occasionally returns
  // components without it for unusual / international addresses. Optional-chain
  // the lookup so a single malformed component doesn't 500 the whole request.
  const city =
    components.find((c) => c.types?.includes('locality'))?.longText ??
    components.find((c) => c.types?.includes('sublocality_level_1'))?.longText ??
    components.find((c) => c.types?.includes('sublocality'))?.longText ??
    components.find((c) => c.types?.includes('postal_town'))?.longText ??
    '';
  const state = components.find((c) => c.types?.includes('administrative_area_level_1'))?.shortText ?? '';

  return {
    business_name: data.displayName?.text ?? '',
    address: data.formattedAddress ?? '',
    city,
    state,
    phone: data.nationalPhoneNumber ?? null,
    lat: data.location?.latitude ?? null,
    lng: data.location?.longitude ?? null,
    business_status: data.businessStatus ?? 'OPERATIONAL',
    photo_references: (data.photos ?? []).map((p) => p.name).filter(Boolean),
    primary_type: data.primaryType ?? '',
    types: data.types ?? [],
  };
}
