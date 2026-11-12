// Maps Google Places `primaryType` / `types[]` onto our internal niche names.
// The landing-page flow derives the niche server-side so the user doesn't have
// to pick one — Google's category (set by the GBP owner) is the signal.
//
// When `primaryType` matches a known niche we use the curated profile in
// generate.ts. When it doesn't, we fall through to niche='other' and pass the
// raw primaryType as `industry_label` — the 'other' profile already tells the
// LLM to research the typed industry. So a long-tail business still ships a
// site, just without our hand-tuned design notes.

import { KNOWN_NICHES, type KnownNiche, type Niche } from './generate';

// Direct map: Google primary types → our niche keys. Derived from real GBP
// responses (see ToolSearch probe — Joe's Pizza returns 'pizza_restaurant',
// Levels Barbershop returns 'barber_shop', etc.).
const DIRECT_MAP: Record<string, KnownNiche> = {
  // Salon / personal services
  barber_shop: 'barber',
  hair_salon: 'hair_salon',
  nail_salon: 'nail_salon',
  beauty_salon: 'lash_brow',
  body_art_service: 'tattoo_shop',
  tattoo_parlor: 'tattoo_shop',
  spa: 'massage',
  massage: 'massage',
  massage_spa: 'massage',
  chiropractor: 'chiropractor',
  // Trades
  plumber: 'plumber',
  electrician: 'electrician',
  hvac_contractor: 'hvac',
  roofing_contractor: 'roofer',
  painter: 'painter',
  landscaper: 'landscaper',
  pest_control_service: 'pest_control',
  general_contractor: 'handyman',
  handyman: 'handyman',
  // Services
  car_wash: 'mobile_detailer',
  car_detailing_service: 'detailer',
  lawn_mower_repair_service: 'lawn_care',
  cleaning_service: 'cleaner',
  house_cleaning_service: 'cleaner',
  pet_groomer: 'dog_groomer',
  pet_care: 'dog_groomer',
  // Wellness / fitness
  personal_trainer: 'trainer',
  fitness_center: 'trainer',
  gym: 'trainer',
  // Creative
  photographer: 'photographer',
  wedding_photographer: 'photographer',
  florist: 'florist',
  // Food — restaurant vertical
  pizza_restaurant: 'pizzeria',
  italian_restaurant: 'italian_restaurant',
  steak_house: 'steakhouse',
  sushi_restaurant: 'sushi',
  japanese_restaurant: 'sushi',
  thai_restaurant: 'thai_restaurant',
  chinese_restaurant: 'chinese_restaurant',
  chinese_noodle_restaurant: 'chinese_restaurant',
  taco_restaurant: 'taqueria',
  mexican_restaurant: 'taqueria',
  barbecue_restaurant: 'bbq',
  seafood_restaurant: 'seafood_restaurant',
  indian_restaurant: 'indian',
  mediterranean_restaurant: 'mediterranean',
  greek_restaurant: 'greek',
  vietnamese_restaurant: 'vietnamese',
  korean_restaurant: 'korean',
  ramen_restaurant: 'ramen',
  middle_eastern_restaurant: 'middle_eastern',
  spanish_restaurant: 'spanish',
  bistro: 'bistro',
  bakery: 'bakery',
  cafe: 'coffee_shop',
  coffee_shop: 'coffee_shop',
  // Fast-casual umbrella
  salad_shop: 'fast_casual',
  vegetarian_restaurant: 'fast_casual',
  fast_food_restaurant: 'fast_casual',
  hamburger_restaurant: 'fast_casual',
  chicken_restaurant: 'fast_casual',
  sandwich_shop: 'fast_casual',
  // Wedding planner has no GBP primary type but if Google ever adds one:
  wedding_venue: 'wedding_planner',
};

// Restaurant verticals — extra signal so that even if our DIRECT_MAP misses
// the specific cuisine, we can still route through the restaurant template
// family (menu/reservations/ordering) instead of services/booking.
const RESTAURANT_FALLBACK_TYPES = new Set([
  'restaurant',
  'food',
  'meal_takeaway',
  'meal_delivery',
  'fine_dining_restaurant',
  'fast_food_restaurant',
  'diner',
  'breakfast_restaurant',
  'brunch_restaurant',
  'pub',
  'wine_bar',
  'cocktail_lounge',
]);

// Validate keys at compile time — direct map must only reference niches that
// actually exist in KNOWN_NICHES. (TypeScript catches missing keys; runtime
// guard catches typos in the literal table above.)
for (const k of Object.values(DIRECT_MAP)) {
  if (!(KNOWN_NICHES as readonly string[]).includes(k)) {
    throw new Error(`niche-inference: DIRECT_MAP references unknown niche '${k}'`);
  }
}

export type NicheInferenceResult =
  | { niche: KnownNiche; industry_label?: never }
  | { niche: 'other'; industry_label: string };

/**
 * Pick the best niche for a Google Place based on its primaryType + types[].
 * Walks `primaryType` first, then `types[]`. Falls back to 'other' with the
 * primaryType (or first type) as the industry_label so the generator still
 * has an industry name to anchor copy against.
 */
export function inferNicheFromPlace(input: {
  primary_type: string;
  types: string[];
}): NicheInferenceResult {
  const { primary_type, types } = input;

  // 1) Direct hit on primaryType — covers most claimed GBP listings.
  if (primary_type && DIRECT_MAP[primary_type]) {
    return { niche: DIRECT_MAP[primary_type]! };
  }

  // 2) Walk types[] for any direct match — catches places whose primaryType
  // is generic ('store') but whose types[] includes a specific category
  // ('body_art_service' for Bang Bang Tattoo).
  for (const t of types) {
    if (DIRECT_MAP[t]) return { niche: DIRECT_MAP[t]! };
  }

  // 3) No specific niche matched but Google says it's a restaurant — route
  // through 'other' with a restaurant-shaped label so the generator at least
  // produces restaurant-leaning copy. The route layer still needs to flip
  // business_vertical based on this signal; see callsite.
  if (
    types.some((t) => RESTAURANT_FALLBACK_TYPES.has(t)) ||
    RESTAURANT_FALLBACK_TYPES.has(primary_type)
  ) {
    const label = humanize(primary_type) || 'restaurant';
    return { niche: 'other', industry_label: label };
  }

  // 4) Long-tail fallback — pass whatever Google gave us as the industry
  // label so the LLM has a real string to research. Drop type suffixes like
  // 'point_of_interest' / 'establishment' that carry no industry signal.
  const usefulType =
    primary_type ||
    types.find((t) => !GENERIC_TYPES.has(t)) ||
    'local business';
  return { niche: 'other', industry_label: humanize(usefulType) };
}

const GENERIC_TYPES = new Set([
  'establishment',
  'point_of_interest',
  'service',
  'store',
  'food',
  'health',
  'general_contractor',
]);

function humanize(googleType: string): string {
  return googleType.replace(/_/g, ' ').trim().toLowerCase();
}

/**
 * Whether the inferred niche should ship the restaurant template family
 * (menu / reservations / ordering). Independent from `inferNicheFromPlace`
 * because the generate route reads it directly off the niche profile for
 * known niches, but for 'other' we need the GBP signal to make this call.
 */
export function isRestaurantFromPlace(input: {
  primary_type: string;
  types: string[];
}): boolean {
  return (
    RESTAURANT_FALLBACK_TYPES.has(input.primary_type) ||
    input.types.some((t) => RESTAURANT_FALLBACK_TYPES.has(t))
  );
}

// Re-exported for callers that need the union type.
export type { Niche };
