// Paginated Text Search against the Places API (New). Field mask is
// restricted to the Pro tier (cheapest SKU that returns phone + website
// + rating). Do NOT add openingHours, editorialSummary, priceLevel, or
// reviews here — those push to Enterprise / Atmosphere pricing.

const TEXT_SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText';

const FIELD_MASK = [
  'places.displayName',
  'places.formattedAddress',
  'places.nationalPhoneNumber',
  'places.websiteUri',
  'places.businessStatus',
  'places.id',
  'places.rating',
  'places.userRatingCount',
  'nextPageToken',
].join(',');

export type RawPlace = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  websiteUri?: string;
  businessStatus?: string;
  rating?: number;
  userRatingCount?: number;
};

export type TextSearchResult = {
  places: RawPlace[];
  apiCalls: number;
};

const MAX_PAGES = 3;
const PAGE_SIZE = 20;

// Run a Text Search and follow nextPageToken up to maxResults. Returns
// the raw places plus the number of API calls made (for budget tracking).
// Each pageToken request must include textQuery + locationBias if used,
// otherwise the API returns 400.
export async function searchPlacesPaginated(opts: {
  query: string;
  location: string;
  maxResults: number;
  apiKey: string;
}): Promise<TextSearchResult> {
  const { query, location, maxResults, apiKey } = opts;
  const collected: RawPlace[] = [];
  let pageToken: string | null = null;
  let apiCalls = 0;
  let pages = 0;

  const textQuery = `${query} in ${location}`;

  while (collected.length < maxResults && pages < MAX_PAGES) {
    if (pageToken) await sleep(2000);

    const body: Record<string, unknown> = {
      textQuery,
      maxResultCount: Math.min(PAGE_SIZE, maxResults - collected.length),
      includePureServiceAreaBusinesses: true,
    };
    if (pageToken) body.pageToken = pageToken;

    let res: Response;
    try {
      res = await fetch(TEXT_SEARCH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': FIELD_MASK,
        },
        body: JSON.stringify(body),
      });
    } catch {
      break;
    }
    apiCalls += 1;

    if (!res.ok) break;
    const data = (await res.json()) as {
      places?: RawPlace[];
      nextPageToken?: string;
    };
    const batch = data.places ?? [];
    if (batch.length === 0) break;

    collected.push(...batch);
    pages += 1;
    pageToken = data.nextPageToken ?? null;
    if (!pageToken) break;
  }

  return { places: collected.slice(0, maxResults), apiCalls };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
