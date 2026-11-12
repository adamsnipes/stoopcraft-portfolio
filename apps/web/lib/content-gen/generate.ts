import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import {
  generatedContentSchema,
  sanitizeGeneratedContent,
  type GeneratedContent,
} from './schema';
import type { MenuConfig } from '@dfy/db';

const anthropic = new Anthropic();

// "city, state" / "city" / "state" / "" — pure service-area businesses
// (mobile detailers, etc.) sometimes come back from Places with no
// locality or admin-area components, and the LLM prompts shouldn't render
// a dangling comma or "in , ".
function formatLocation(city: string, state: string): string {
  return [city, state].filter((p) => p && p.trim().length > 0).join(', ');
}

// ============================================================================
// Review filtering
// Rule: reviews are inputs for tone inference, never sources of factual claims.
// See DECISIONS.md Decision 6.
// ============================================================================

export type GoogleReview = {
  text: string;
  rating: number;
};

/**
 * Simple English heuristic — no language detection library needed.
 * Rejects text where >15% of characters are non-ASCII (covers Cyrillic,
 * CJK, Arabic, heavily accented Spanish, etc.).
 * Not perfect; the goal is noise reduction, not perfect classification.
 */
function looksLikeEnglish(text: string): boolean {
  if (text.length === 0) return false;
  const nonAscii = text.split('').filter((c) => c.charCodeAt(0) > 127).length;
  return nonAscii / text.length < 0.15;
}

export function filterReviews(reviews: GoogleReview[]): string[] {
  return reviews
    .filter((r) => r.rating >= 4)                           // marketing copy — positive signal only
    .filter((r) => r.text.length >= 30)                     // too short = no information
    .filter((r) => r.text.length <= 800)                    // too long = likely off-topic
    .map((r) =>
      r.text
        .replace(/https?:\/\/\S+/g, '')                     // strip URLs
        .replace(/\S+@\S+/g, '')                            // strip emails
        .replace(/\+?\d[\d\s\-()​]{7,}/g, '')          // strip phone numbers
        .replace(/<[^>]+>/g, '')                            // strip HTML
        .trim()
    )
    .filter(looksLikeEnglish)
    .filter((t) => t.length >= 20)                          // re-check after stripping
    .slice(0, 5);
}

// Single source of truth for the niches we support out-of-the-box.
// `other` is handled separately: it accepts a free-text industry_label and uses
// a neutral fallback profile so Meta-ads traffic from arbitrary industries
// doesn't dead-end at the validation step.
export const KNOWN_NICHES = [
  'barber',
  'hair_salon',
  'nail_salon',
  'detailer',
  'mobile_detailer',
  'lawn_care',
  'cleaner',
  'trainer',
  'dog_groomer',
  'power_washing',
  'junk_removal',
  'lash_brow',
  'electrician',
  'plumber',
  'hvac',
  'roofer',
  'painter',
  'landscaper',
  'pest_control',
  'tree_service',
  'pool_service',
  'handyman',
  'massage',
  'chiropractor',
  'tattoo_shop',
  'photographer',
  'florist',
  'bakery',
  'coffee_shop',
  'wedding_planner',
  'tutor',
  'med_spa',
  'pet_boarding',
  // Restaurant niches — each profile sets vertical: 'restaurant' which
  // routes the generator into the menu / reservations / ordering branch.
  'italian_restaurant',
  'sushi',
  'steakhouse',
  'pizzeria',
  'taqueria',
  'bistro',
  'thai_restaurant',
  'chinese_restaurant',
  'bbq',
  'seafood_restaurant',
  'indian',
  'mediterranean',
  'greek',
  'vietnamese',
  'korean',
  'ramen',
  'middle_eastern',
  'spanish',
  // Fast-casual covers smash burger / wings / chicken sandwich / bowls / etc.
  // The LLM picks up the specific format from the business name.
  'fast_casual',
] as const;

export type KnownNiche = (typeof KNOWN_NICHES)[number];
export type Niche = KnownNiche | 'other';

export type GenerationInput = {
  business_name: string;
  niche: Niche;
  city: string;
  state: string;
  reviews?: GoogleReview[];
  // Required when niche === 'other' — the free-text industry the user typed.
  industry_label?: string;
};

type ThemeStyle =
  | 'editorial'
  | 'luxe'
  | 'premium-dark'
  | 'bold'
  | 'minimal'
  | 'service-tech'
  // Restaurant styles. Only restaurant niche profiles reference these; the
  // route overrides theme.style after LLM generation when vertical='restaurant'
  // to guarantee the right style ships even if the LLM ignored the hint.
  | 'restaurant-trattoria'
  | 'restaurant-modern'
  | 'restaurant-cafe'
  | 'restaurant-omakase'
  | 'restaurant-counter'
  // Trades styles — contractor / home-services family. Hero ships an inline
  // lead form; section list includes trust badges, why-us bento, testimonials
  // grid, color CTA strip. Pipeline route overrides theme.style post-LLM when
  // vertical='trades' so the wrong-style fallback never ships.
  | 'trades-classic'
  | 'trades-bold'
  // Personality styles — admin-pickable alternates, no niche default points
  // here. Listed in the union for type exhaustiveness across compositions /
  // palettes / editor maps.
  | 'playful-pop'
  | 'brutalist'
  | 'art-deco'
  | 'retro-90s';

type SectionVariant = {
  hero: 'image' | 'minimal' | 'split';
  services: 'grid' | 'list';
  about: 'text' | 'text_image';
  gallery: 'masonry' | 'grid' | 'off';
};

type NicheProfile = {
  style: ThemeStyle;
  // Verticals branch the generator pipeline + section selection. Existing
  // niches leave this undefined → today's beauty/appointment-based template
  // path runs unchanged.
  //   'restaurant' — menu / ordering / reservations section family
  //   'trades'     — contractor lead-gen family (top utility bar, hero with
  //                  inline lead form, trust badges, why-us bento,
  //                  testimonials grid, color CTA strip)
  vertical?: 'restaurant' | 'trades';
  design: string;
  copy: string;
  variants: SectionVariant;
};

// ============================================================================
// Per-niche profiles — palette, voice, layout pulled from real industry research
// (browsing top boutique sites in each niche, not generic SaaS templates).
// One profile per niche so no two industries look like the same business.
// ============================================================================
const NICHE_PROFILES: Record<Niche, NicheProfile> = {
  barber: {
    style: 'premium-dark',
    design: `Heritage barbershop / chop-shop energy. Dark masculine base with a single warm metallic or oxblood accent. Reference: Frank's Chop Shop, Murdock London, Rudy's.
- background: very dark off-black (#0e0d0c, #14110e, #1a1714). Never pure black.
- primary: same dark family or one shade lighter for surfaces (#1c1a17, #2a2723).
- text: warm cream on dark sites (#f4ede0, #ece3d0). NEVER pure white.
- accent: oxblood (#7a1f1f), brass (#b8935a), warm tan (#c9a96e), or deep navy (#0f1f3d). Pick ONE.
- fontHeading: Bebas Neue (street/bold), Playfair Display (upscale heritage), or Fraunces (editorial-craft).
- fontBody: Roboto, Inter, or Lora.`,
    copy: `Voice: confident, no fluff, neighborhood pride. Mention chair count, walk-in policy, hours, cash/card. Acknowledge tradition without being corny. Services: list what's actually included (cut, hot towel, neck shave, lineup, beard trim). Be specific about format and time. Avoid "luxury" and "experience."`,
    variants: { hero: 'image', services: 'list', about: 'text_image', gallery: 'masonry' },
  },

  nail_salon: {
    style: 'luxe',
    design: `Boutique nail studio — Glossier/Olive & June minimal-luxe. Soft, sophisticated, low-contrast. Reference: Paintbox, Olive & June, Glosshouse.
- background: warm cream (#faf6f0, #f7f1e8) or soft blush (#f7eee8). NEVER pure white.
- primary: same cream family or muted taupe (#a8907a, #8e7e6e).
- text: warm ink (#1a1612, #2a221c). NEVER pure black.
- accent: muted blush (#c9a0a0, #d4a5a0), dusty sage (#8fa89a), terracotta (#c97c5d), or warm taupe.
- fontHeading: Playfair Display, Fraunces, or Cormorant Garamond.
- fontBody: Lora or Inter.
- Avoid loud saturated pink, neon, and pet-store palettes.`,
    copy: `Voice: refined, calm, considered. Mention sanitation (autoclave, fresh files), specific techniques (gel-X, builder gel, dip, acrylic, structured manicure), appointment vs walk-in, cancellation policy. Services: name the actual service with time (e.g., "Builder gel manicure · 75 min"). No "pamper yourself."`,
    variants: { hero: 'minimal', services: 'list', about: 'text_image', gallery: 'masonry' },
  },

  hair_salon: {
    style: 'luxe',
    design: `Boutique hair salon — colorist-led, editorial-feminine, unisex-welcoming. Distinct from barbershop (heritage masculine) and nail/lash studios (single-service focus). Reference: Spoke & Weal, Suite Caroline, Sally Hershberger, Cutler, Hairstory, Bumble and Bumble flagship.
- background: warm cream (#faf6f0, #f7f1e8) or soft bone (#efe7d6). NEVER pure white.
- primary: warm taupe (#a8907a), soft charcoal (#2a2520), or muted clay (#b89888).
- text: warm ink (#1a1612, #2a221c). NEVER pure black.
- accent: dusty rose (#d4a5a0), warm copper (#b87333), champagne gold (#c9a96e), terracotta (#c97c5d), or deep aubergine (#5a3a4a). ONE accent only.
- fontHeading: Cormorant Garamond, Fraunces, or Playfair Display. Editorial serif required.
- fontBody: Lora or Inter.
- Feel: editorial-salon — magazine spread, generous whitespace, slow tempo. Avoid neon-pink, "diva" palettes, and 90s-mall-salon energy.`,
    copy: `Voice: stylist/colorist-led, technique-specific, considered. Specific services: women's cut + style, men's cut, kids' cut, blowout, single-process color, root touch-up, partial vs full highlights, balayage, ombré, color correction, gloss/toner, keratin / smoothing treatment, deep conditioning, extensions (tape-in, hand-tied, K-tip), bridal/event styling. Per service: duration + starting price (note "starting at" — pricing varies by length/density). Consultation policy for color clients. Cancellation policy. Avoid "pamper yourself," "your crown," and "transform your look."`,
    variants: { hero: 'minimal', services: 'list', about: 'text_image', gallery: 'masonry' },
  },

  detailer: {
    style: 'premium-dark',
    design: `Shop-based auto detailing — supercar showroom aesthetic. Reference: Adam's Polishes, Topaz Detailing, Gtechniq partner shops.
- background: deep black (#0a0a0a, #111111) or charcoal (#1c1c1c).
- primary: charcoal (#1e1e1e, #2a2a2a).
- text: clean off-white (#f5f5f5, #fafafa).
- accent: ONE bright metallic — electric blue (#1a5eff, #2563eb), oxblood (#c0392b), or champagne gold (#c9a031). Avoid green/purple (looks budget).
- fontHeading: Bebas Neue (sporty), Inter (clean tech), or Space Grotesk (modern automotive).
- fontBody: Roboto, Inter.
- Strong contrast. No pastels.`,
    copy: `Voice: technical, specific, results-driven. List products/processes (paint correction stages, ceramic coating tier, foam pre-rinse, two-bucket wash, clay bar, polish). Per-package inclusions — interior vs exterior breakdown. Mention coating duration if relevant. Services: stage names + concrete inclusions, not adjectives.`,
    variants: { hero: 'image', services: 'grid', about: 'text_image', gallery: 'masonry' },
  },

  mobile_detailer: {
    style: 'service-tech',
    design: `Mobile detailing — "we come to you" service-platform feel. Brighter and more accessible than shop-based detailing. Reference: Spiffy, MobileWash, Washmen.
- background: cream-white (#f7f9fb, #fafafa) OR deep navy (#0f172a, #0a1628). Pick one direction.
- primary: navy or charcoal that pairs with the background.
- text: deep ink on light bg (#0a1628), or cream on dark bg.
- accent: electric blue (#2563eb, #3b82f6), teal (#0891b2), or chrome silver tone (#94a3b8). Bright but professional.
- fontHeading: Inter, Space Grotesk, or Poppins. Modern sans, not display.
- fontBody: Inter, DM Sans, Open Sans.
- Feel: clean, tech-forward, "they show up on time."`,
    copy: `Voice: convenience-led, specific service area, route-aware. Lead with "we come to you." Mention coverage radius, water/power requirements (we bring our own), book-online flow if relevant. Per-package inclusions: interior, exterior, engine bay, ceramic spray. Services: package name + what's done + approx time on-site (e.g., "Express Exterior · 45 min on-site").`,
    variants: { hero: 'image', services: 'grid', about: 'text', gallery: 'grid' },
  },

  lawn_care: {
    style: 'bold',
    design: `Professional lawn care — outdoor, reliable, transformation-focused. Reference: Lawn Doctor (refreshed), Sunday, premium independents.
- background: cream (#fafaf5, #f7f4ed) or off-white. Some sites can run dark forest-green hero with cream below.
- primary: deep forest green (#2d5a27, #1f3d1c), olive (#4a5d3a), or sage-charcoal (#3c4a3a).
- text: deep ink (#0f1a0c) or cream on dark.
- accent: warm sand (#d4a373), rich blue (#1e3a8a), or rust (#b45309).
- fontHeading: Inter, Poppins, Fraunces (editorial-trust).
- fontBody: Inter, Open Sans.
- Avoid bright kelly green (#00ff00) — looks budget. Lean deeper, more refined greens.`,
    copy: `Voice: reliable, route-based, recurring. Mention service area / zip codes, weekly vs biweekly vs one-time, what's actually done each visit (mow, edge, line trim, blow off hardscape, bag or mulch). Specific tasks with frequency. Aerate, overseed, fertilize, leaf cleanup as separate seasonal services. Services: visit type + concrete inclusions + cadence.`,
    variants: { hero: 'image', services: 'grid', about: 'text', gallery: 'grid' },
  },

  cleaner: {
    style: 'minimal',
    design: `Residential house cleaning — fresh sanctuary feel, trust-led. Reference: Tidy, Handy (boutique end), local recurring-clean services.
- background: cream (#fafaf5, #f7f4ed) or soft off-white. NEVER pure white.
- primary: warm gray (#3a3a3a) or soft slate (#475569).
- text: deep ink (#1a1a1a, #14110e).
- accent: dusty sage (#8fa89a, #a8b9a3), soft eucalyptus, dusty blue (#a4b8c4), or navy (#1a2f4a). Calm, not loud.
- fontHeading: Poppins (friendly), Fraunces (editorial-fresh), or Inter (clean modern).
- fontBody: Inter, Open Sans, DM Sans.
- Feel: like clean linen and morning light, not bleach commercial.`,
    copy: `Voice: trustworthy, specific, calm. Distinguish deep clean vs recurring maintenance. Room-by-room inclusions (bathrooms — fixtures, mirrors, mildew; kitchen — appliances exterior, counters, cabinet fronts). Bring own supplies / eco-friendly options. Bonded/insured if applicable. Recurring discount specifics. Services: clean type + what's included + approx duration for typical home size.`,
    variants: { hero: 'minimal', services: 'list', about: 'text_image', gallery: 'off' },
  },

  trainer: {
    style: 'bold',
    design: `Personal trainer — athletic, results-driven. Two valid directions: athletic-dark (gym/strength) or wellness-bright (lifestyle/mobility). Reference: 1-on-1 trainer Squarespace sites, Tonal trainer pages.
- Direction A (strength/athletic): background dark (#0a0e1a, #111827), primary charcoal, text cream, accent electric blue (#2563eb), volt (#84cc16), or orange (#ea580c).
- Direction B (lifestyle/wellness): background cream (#faf7f2), text deep ink, accent warm rust (#b45309) or moss (#3f5f3a).
- fontHeading: Bebas Neue or Space Grotesk (athletic), or Fraunces / Inter (wellness).
- fontBody: Inter, Roboto, Open Sans.
- Avoid generic "fitness" red gradients.`,
    copy: `Voice: outcome-focused, specific. Specialty: strength, weight loss, mobility, sport-specific, post-rehab, women over 40, etc. Session format: 1-on-1, small group, online programming. Concrete results — not inspiration, not "transform your life." Mention assessment / intake process. Services: program type + session structure + who it's for + duration (e.g., "12-week strength · 3x/wk · in-person").`,
    variants: { hero: 'image', services: 'grid', about: 'text_image', gallery: 'off' },
  },

  dog_groomer: {
    style: 'editorial',
    design: `Boutique dog grooming — warm, calm, trust-first. Never harsh, neon, or pet-store cartoon. Reference: Paws & Whiskers boutiques, Kennel Club–adjacent groomers.
- background: warm cream (#faf6ef, #f4ede0). NEVER pure white.
- primary: warm charcoal (#2d2a26, #1f1d1b) or soft taupe.
- text: deep warm ink (#1a1612).
- accent: dusty sage (#9bb19a), brass (#b8935a, #c89868), muted teal (#5a8a8a), or terracotta (#c97c5d). Pick ONE.
- fontHeading: Fraunces, Playfair Display, Cormorant Garamond, or Merriweather.
- fontBody: Lora, Inter, Open Sans.
- Avoid neon paw-print blue/pink and "fur baby" pet-store palettes.`,
    copy: `Voice: experienced, gentle, breed-aware. Specify shop vs mobile vs both. Pricing varies by size/breed/coat — say so and give starting price by size (S/M/L/XL). Handling style: one-dog-at-a-time, cage-free, hand-drying, no kennel dryers. Mention experience with nervous, senior, special-needs dogs if applicable. Breed experience builds trust (doodle, poodle, schnauzer, terrier hand-strip). Services: package name + concrete inclusions (bath, blow dry, brush out, nail trim, ear cleaning, sanitary trim, teeth brushing, de-shed, breed cut). Avoid "fur baby," "spa day," "pawfect."`,
    variants: { hero: 'minimal', services: 'list', about: 'text_image', gallery: 'masonry' },
  },

  power_washing: {
    style: 'bold',
    design: `Pressure / soft washing — transformation and visibility. Deep blue (water/sky) + crisp white is the canonical pairing. Reference: top SoftWash Systems members, Brothers Power Washing-tier brands.
- background: cream-white (#fafaf5) or deep navy (#0a3d62, #1e3a8a). Pick a direction.
- primary: deep blue (#0a3d62, #1e40af, #1e3a8a) or charcoal (#1e293b).
- text: deep ink on light, cream on dark.
- accent: bright sky blue (#3b82f6), sun amber (#fbbf24), or fresh white. Energetic, not loud.
- fontHeading: Bebas Neue (bold action), Inter, or Space Grotesk.
- fontBody: Inter, Roboto, Open Sans.
- Feel: "before/after restore" — clean, confident, transformation-led.`,
    copy: `Voice: transformation-focused, surface-specific. List surfaces: house siding (vinyl, hardie, brick, stucco), roofs (soft wash only — emphasize this), driveways, decks, concrete, fences. Soft wash vs high pressure where each is used. Mention chemicals are pet/plant-safe if true, biodegradable detergents. SoftWash Systems certified or similar credentials. Services: surface + method + typical sq ft pricing tier.`,
    variants: { hero: 'image', services: 'grid', about: 'text', gallery: 'masonry' },
  },

  junk_removal: {
    style: 'bold',
    design: `Junk removal — bold, friendly, action-oriented. Reference: 1-800-GOT-JUNK, College Hunks Hauling Junk, premium independents.
- background: cream-white (#fafaf5) or deep navy (#0f1f3d, #1a2f4a).
- primary: deep navy (#0f1f3d) or charcoal.
- text: deep ink on light, cream on dark.
- accent: bold orange (#ea580c, #f97316), warm yellow (#f59e0b), or kelly green (#16a34a) for eco-haul positioning. Pick ONE high-energy accent.
- fontHeading: Bebas Neue, Space Grotesk, or Poppins. Bold and big.
- fontBody: Inter, Open Sans, Roboto.
- Feel: friendly + capable. Big trucks, clear pricing, "we handle it."`,
    copy: `Voice: upfront, capable, no-surprises pricing. Mention truck size pricing (1/4 truck, 1/2, full) or itemized. Same-day / next-day availability. What you take (furniture, appliances, e-waste, construction debris, hot tubs, sheds) vs what you don't (hazmat). Donation/recycling — what % is diverted from landfill. Services: load size + typical items + price tier.`,
    variants: { hero: 'image', services: 'grid', about: 'text', gallery: 'grid' },
  },

  lash_brow: {
    style: 'luxe',
    design: `Lash & brow studio — boutique-luxe, refined-feminine. Reference: Blink Brow Bar, Lash LA, top independent lash artists.
- background: warm cream (#faf3ed, #f5ebe0) or soft blush (#f7eee8). NEVER pure white.
- primary: warm taupe (#a8907a), dusty mauve (#a8868a), or soft charcoal (#2a2520).
- text: warm ink (#1a1612, #2a221c).
- accent: dusty rose (#d4a5a0, #c89898), warm gold/champagne (#c9a96e, #b8935a), terracotta (#c97c5d), or deep mauve. ONE accent only.
- fontHeading: Cormorant Garamond, Fraunces, or Playfair Display. Editorial serif required.
- fontBody: Lora or Inter.
- Feel: like a Vogue spread — generous whitespace, slow tempo, refined typography. Avoid millennial pink, neon, and saturated palettes.`,
    copy: `Voice: refined, considered, technique-aware. Specific services: classic lash extensions, hybrid set, volume / mega volume, lash lift, lash tint, brow lamination, brow tint, brow shaping (tweeze/wax/thread), microblading or nano-brows if offered. Fill schedule (2/3/4 wk). Aftercare guidance signaled briefly. Patch-test policy. Sanitation. Services: name + technique + duration + typical longevity (e.g., "Hybrid full set · 2hr · 2-3 week fill").`,
    variants: { hero: 'minimal', services: 'list', about: 'text_image', gallery: 'masonry' },
  },

  electrician: {
    style: 'trades-classic',
    vertical: 'trades',
    design: `Licensed electrician — trade-trust, clean & modern. Reference: top boutique residential electricians on Houzz, Mister Sparky-tier independents (refreshed).
- background: cream-white (#fafaf5, #f7f9fb) OR deep navy (#0f172a, #0a1628). Pick one direction.
- primary: navy (#1e3a8a, #1e40af) or warm charcoal (#1f2937).
- text: deep ink on light bg, cream on dark.
- accent: amber/electric yellow (#f59e0b, #fbbf24), bright blue (#2563eb), or safety orange (#ea580c). One bright accent — electricity has energy.
- fontHeading: Inter, Space Grotesk, or Poppins. Modern sans only.
- fontBody: Inter, DM Sans, Open Sans.
- Avoid lightning-bolt clipart palettes. Trade-credible, not gimmicky.`,
    copy: `Voice: licensed/insured-first, troubleshooting-confident, code-aware. Mention license/insurance plainly. Specific services: panel upgrades (100A → 200A), EV charger install (Level 2, NEMA 14-50), recessed lighting, ceiling fan install, knob-and-tube replacement, troubleshooting (intermittent breakers, GFCI failures), generator install, smoke/CO detector wiring. Same-day vs scheduled. Free estimate policy. Avoid "your trusted local electrician."`,
    variants: { hero: 'image', services: 'grid', about: 'text', gallery: 'off' },
  },

  plumber: {
    style: 'trades-classic',
    vertical: 'trades',
    design: `Licensed plumber — emergency-ready, reliable, drains-and-water-heaters specific. Reference: top boutique residential plumbers, Roto-Rooter-tier independents (refreshed).
- background: cream-white (#fafaf5) OR deep navy (#0f172a). Pick one direction.
- primary: navy (#1e3a8a) or warm charcoal (#1f2937).
- text: deep ink on light, cream on dark.
- accent: water-blue (#0891b2, #2563eb), copper (#b87333), or emergency red (#dc2626). Pick ONE — emergency-led vs craft-led positioning.
- fontHeading: Inter, Space Grotesk, or Poppins.
- fontBody: Inter, Roboto, Open Sans.
- Avoid plunger clipart and cartoon water-drop palettes.`,
    copy: `Voice: licensed/insured, emergency-capable, fixture-and-pipe specific. Mention 24/7 vs business hours, response window if emergency-led. Specific services: water heater install/repair (tank vs tankless), drain cleaning (snake vs hydro-jet), leak detection, repipe, sewer line repair, garbage disposal, fixture install, gas line work, sump pump, water softener. Up-front pricing or estimate-first. Avoid "we get the job done right."`,
    variants: { hero: 'image', services: 'grid', about: 'text', gallery: 'off' },
  },

  hvac: {
    style: 'trades-classic',
    vertical: 'trades',
    design: `Licensed HVAC — install, repair, maintain. Reference: NATE-certified shops, Trane/Carrier dealer-tier independents.
- background: cream-white (#fafaf5) or deep navy (#0f172a).
- primary: navy (#1e3a8a) or warm charcoal (#1f2937).
- text: deep ink on light, cream on dark.
- accent: pick ONE direction — cool blue (#0891b2, #2563eb) for cooling-led brands, OR warm orange (#ea580c, #f97316) for heating-led brands. Never both.
- fontHeading: Inter, Space Grotesk, or Poppins.
- fontBody: Inter, DM Sans, Open Sans.
- Avoid generic snowflake-and-flame combo palettes.`,
    copy: `Voice: NATE-certified or manufacturer-certified, install/repair/maintain framing, seasonal service plans. Specific services: AC tune-up, heat pump install, ductless mini-split, furnace repair, thermostat upgrade (Nest/Ecobee), duct sealing, indoor air quality (UV, MERV upgrade, dehumidifier), maintenance plan with frequency. SEER rating awareness. Financing available if relevant. Avoid "comfort solutions for your home."`,
    variants: { hero: 'image', services: 'grid', about: 'text', gallery: 'off' },
  },

  roofer: {
    style: 'trades-classic',
    vertical: 'trades',
    design: `Roofing contractor — transformation, certifications, storm-ready. Reference: GAF Master Elite contractors, CertainTeed SELECT shops.
- background: cream (#fafaf5, #f7f4ed) or deep slate (#1e293b, #334155).
- primary: charcoal (#1f2937) or slate.
- text: deep ink on light, cream on dark.
- accent: deep red (#991b1b, #b91c1c), steel blue (#1e40af), or forest green (#15803d). One strong accent.
- fontHeading: Bebas Neue, Inter, or Space Grotesk. Big and confident.
- fontBody: Inter, Roboto, Open Sans.
- Feel: durable, before/after, "we've got the roof handled."`,
    copy: `Voice: certifications-first, materials-specific, storm-aware. Mention GAF/CertainTeed/Owens Corning certifications, manufacturer warranty tier. Specific services: full tear-off vs overlay, architectural shingle, metal roofing, flat/TPO, ventilation, gutter install, skylight, repair vs replace inspection, storm/hail damage insurance work, financing. Average install timeline. Avoid "quality roofing solutions."`,
    variants: { hero: 'image', services: 'grid', about: 'text', gallery: 'masonry' },
  },

  painter: {
    style: 'trades-classic',
    vertical: 'trades',
    design: `Residential painter — craft-led, prep-work-honest, color-confident. Reference: top boutique paint contractors on Houzz, Benjamin Moore Signature Color experts.
- background: cream (#fafaf5, #f7f4ed). Off-white only.
- primary: warm gray (#3a3a3a) or soft charcoal (#1f2937).
- text: deep ink (#1a1a1a).
- accent: muted teal (#0e7490), deep blue (#1e3a8a), terracotta (#c2410c), or mustard (#a16207). Calm, considered.
- fontHeading: Fraunces (craft), Inter (clean modern), or Poppins (friendly).
- fontBody: Inter, Open Sans, Lora.
- Feel: meticulous — "the prep is the work."`,
    copy: `Voice: prep-led, brand-of-paint specific, finish-aware. Specific services: interior repaint (walls, ceilings, trim, doors), cabinet refinish (sand/spray vs brush), exterior repaint, deck/fence stain, wallpaper removal, drywall repair before paint. Brand mentions: Sherwin-Williams, Benjamin Moore, Farrow & Ball if used. Number of coats included. Color consultation offered. Lead-paint certified for pre-1978 if applicable. Avoid "transform your space."`,
    variants: { hero: 'image', services: 'list', about: 'text_image', gallery: 'masonry' },
  },

  landscaper: {
    style: 'editorial',
    design: `Landscape design / install / hardscape — distinct from lawn care (mow/edge). Reference: APLD-member designers, top boutique design-build firms.
- background: warm cream (#faf6ef, #f5ebe0). Editorial light.
- primary: warm taupe (#5a4a3a) or deep charcoal (#1f1d1b).
- text: deep warm ink (#1a1612).
- accent: deep moss (#3f5f3a), terracotta (#c2410c), warm sand (#d4a373), or rust (#b45309). Earth-rooted.
- fontHeading: Fraunces, Cormorant Garamond, or Playfair Display. Editorial serif.
- fontBody: Lora, Inter, Open Sans.
- Feel: craft + nature + considered design. NOT lawn-care energy.`,
    copy: `Voice: design-led, install-capable, plant-knowledgeable. Distinguish design vs install vs ongoing. Specific services: landscape design (plans, 3D rendering), hardscape (paver patios, retaining walls, walkways, fire pits), softscape (planting beds, trees, shrubs, sod), irrigation install/audit, landscape lighting, drainage. Native/drought-tolerant focus if applicable. Project timeline range. Avoid "transform your outdoor living space."`,
    variants: { hero: 'image', services: 'grid', about: 'text_image', gallery: 'masonry' },
  },

  pest_control: {
    style: 'trades-classic',
    vertical: 'trades',
    design: `Residential pest control — IPM-led, family/pet safe, recurring. Reference: Aptive (refreshed), top boutique pest control independents.
- background: cream (#fafaf5) or deep navy (#0f172a).
- primary: navy or warm charcoal (#1f2937).
- text: deep ink on light, cream on dark.
- accent: deep green (#15803d, #047857) for eco/safe positioning, or warm rust (#b45309) for traditional. One accent only.
- fontHeading: Inter, Space Grotesk, or Poppins.
- fontBody: Inter, DM Sans, Open Sans.
- Avoid bug-cartoon palettes. Trade-credible, not pesty.`,
    copy: `Voice: integrated pest management, family/pet-safe-led, pest-specific. Specific services: quarterly recurring exterior treatment, ant/roach/spider/silverfish, rodent (interior trap + exterior bait), termite inspection and treatment (liquid vs bait), mosquito (in-season), bed bug (heat vs chemical), wildlife exclusion, wasp/hornet. EPA-registered products. Free re-treatment between visits. Avoid "pest problems? we'll handle it."`,
    variants: { hero: 'image', services: 'grid', about: 'text', gallery: 'off' },
  },

  tree_service: {
    style: 'trades-classic',
    vertical: 'trades',
    design: `Tree service — ISA-arborist, bucket-truck and climber crews, storm-capable. Reference: top ISA-certified independents, Bartlett-tier brand sites.
- background: cream (#fafaf5) or deep forest (#14291f).
- primary: forest green (#15803d, #166534) or warm charcoal (#1f2937).
- text: deep ink on light, cream on dark.
- accent: warm sand (#d4a373), rust (#b45309), or deep amber (#92400e). Earth-strong.
- fontHeading: Bebas Neue, Inter, or Space Grotesk.
- fontBody: Inter, Roboto, Open Sans.
- Feel: capable, careful, climber crew + chainsaw confidence.`,
    copy: `Voice: arborist-credentialed, removal-and-care specific, storm-ready. Specific services: tree removal (size tier), tree trimming/pruning (crown reduction, deadwood), stump grinding (depth), emergency storm work, cabling/bracing, plant health care (deep root feeding, treatment), crane work for tight access, lot clearing. ISA Certified Arborist on staff. Insurance + workers comp specifics. Avoid "tree care experts."`,
    variants: { hero: 'image', services: 'grid', about: 'text', gallery: 'grid' },
  },

  pool_service: {
    style: 'trades-classic',
    vertical: 'trades',
    design: `Pool service — weekly maintenance + equipment repair. Reference: top boutique pool service brands, ASP (Pool Pros).
- background: cream (#fafaf5) or deep navy (#0f172a).
- primary: navy (#1e3a8a) or charcoal (#1f2937).
- text: deep ink on light, cream on dark.
- accent: pool teal (#0891b2, #06b6d4) or aquamarine (#22d3ee). One blue accent only — water IS the brand.
- fontHeading: Inter, Space Grotesk, or Poppins.
- fontBody: Inter, DM Sans, Open Sans.
- Feel: clean water, reliable route, "your pool is taken care of."`,
    copy: `Voice: route-based weekly, equipment-aware, chemistry-confident. Specific services: weekly chemical + cleaning (skim, brush, vacuum, empty baskets, test/balance), filter clean/replace (cartridge, DE, sand), equipment repair (pump, heater, salt cell, automation), green-to-clean recovery, pool opening/closing, leak detection, tile cleaning. Service area + day-of-week routes. Salt vs chlorine vs mineral. Avoid "crystal clear pool experience."`,
    variants: { hero: 'image', services: 'grid', about: 'text', gallery: 'grid' },
  },

  handyman: {
    style: 'trades-classic',
    vertical: 'trades',
    design: `Residential handyman — small-jobs, list-of-trades, reliability-first. Reference: top owner-operator handymen, Mr. Handyman-tier independents (refreshed).
- background: cream (#fafaf5) or warm gray (#f7f4ed).
- primary: warm charcoal (#1f2937) or warm gray (#3f3f3f).
- text: deep ink (#1a1a1a).
- accent: warm orange (#ea580c, #f97316), warm amber (#d97706), or warm sand (#a16207). Approachable, capable.
- fontHeading: Inter, Poppins, or Space Grotesk.
- fontBody: Inter, Open Sans, DM Sans.
- Feel: approachable, "no job too small."`,
    copy: `Voice: small-job-friendly, list-broad, hourly-or-flat clear. Specific services: drywall patch + paint, faucet/fixture replace, ceiling fan install, picture/shelf hanging, door rehang/lock change, deck repair, baseboards, caulking, dryer vent clean, garbage disposal, light electrical (within trade scope), tile grout, weatherstripping. Hourly rate tier or per-job pricing. Minimum charge. Insured. Avoid "your home improvement partner."`,
    variants: { hero: 'image', services: 'grid', about: 'text', gallery: 'off' },
  },

  massage: {
    style: 'luxe',
    design: `Massage therapy — calm, modality-specific, LMT-led. Reference: top boutique LMT studios, Spafinder-tier independents.
- background: warm cream (#faf3ed, #f5ebe0) or soft sage-cream (#f4ede5).
- primary: warm taupe (#a8907a) or soft charcoal (#2a2520).
- text: warm ink (#1a1612).
- accent: dusty sage (#8fa89a, #9bb19a), eucalyptus (#7a9489), soft terracotta (#c97c5d), or muted gold (#b8935a). Calm, restorative.
- fontHeading: Cormorant Garamond, Fraunces, or Playfair Display.
- fontBody: Lora, Inter, Open Sans.
- Avoid neon spa-blue and glossy resort palettes. Calm, not commercial.`,
    copy: `Voice: licensed (LMT) credentials, modality-specific, intake-aware. Specific services: deep tissue, Swedish/relaxation, prenatal, sports/recovery, lymphatic drainage, cupping, hot stone, myofascial release, trigger point. Session length (60/90/120 min). Intake form + contraindication awareness. Quiet/low-noise environment. Heated table. Insurance acceptance if applicable. Avoid "pamper yourself" and "ultimate relaxation experience."`,
    variants: { hero: 'minimal', services: 'list', about: 'text_image', gallery: 'off' },
  },

  chiropractor: {
    style: 'minimal',
    design: `Chiropractic clinic — clinical-trust, technique-named, calm. Reference: top independent DC offices, The Joint (boutique end).
- background: cream (#fafaf5, #f7f4ed). Clinical-clean but warm.
- primary: warm gray (#3a3a3a) or deep navy (#1e3a8a).
- text: deep ink (#1a1a1a).
- accent: deep blue (#1e40af), sage green (#65a89a), or warm rust (#b45309). One calm accent.
- fontHeading: Fraunces (clinical-trust), Inter (clean modern), or Cormorant Garamond.
- fontBody: Inter, Open Sans, Lora.
- Feel: clinical-credible — not gym-energy, not spa-soft.`,
    copy: `Voice: technique-specific, intake-driven, evidence-aware. Specific services: initial consultation + exam (X-ray when appropriate), Diversified, Activator, Gonstead, Thompson Drop, soft tissue (ART/Graston), spinal decompression, prenatal, pediatric, sports injury, auto/work injury. Insurance accepted (commercial, Medicare, auto/PI). Adjustment plan vs single visit. Avoid "we get you out of pain" and unverifiable outcome claims.`,
    variants: { hero: 'minimal', services: 'list', about: 'text_image', gallery: 'off' },
  },

  tattoo_shop: {
    style: 'premium-dark',
    design: `Tattoo studio — artist-led, style-specific, custom-first. Reference: Bang Bang NYC, Saved Tattoo, top boutique studios with strong custom programs.
- background: very dark off-black (#0e0d0c, #14110e). Never pure black.
- primary: charcoal (#1c1a17, #2a2723) or bone white (#ece3d0) for split layouts.
- text: warm cream on dark (#f4ede0, #ece3d0). Never pure white.
- accent: oxblood (#7a1f1f), deep red, indigo, or brass (#b8935a). One accent only.
- fontHeading: Bebas Neue (street), Fraunces (editorial-craft), or Playfair Display.
- fontBody: Inter, Lora, Roboto.
- Feel: gallery-of-skin, artist-portfolio. NOT biker-cliché.`,
    copy: `Voice: custom-led, artist-specific, consultation-first. Specific services: custom design, walk-in flash (Friday/Saturday), cover-up, fine line, blackwork, traditional / neo-traditional, Japanese, realism, script. Artists' specialties listed. Consultation flow + deposit policy. Healing aftercare overview. Sterile / single-use mentioned. Age policy. Avoid "we bring your vision to life."`,
    variants: { hero: 'image', services: 'list', about: 'text_image', gallery: 'masonry' },
  },

  photographer: {
    style: 'editorial',
    design: `Photography studio — portfolio-led, niche-specific, editorial. Reference: top wedding/brand/family photographers on Squarespace.
- background: warm cream (#faf6ef, #f5ebe0) or off-black (#1a1714) for moody portrait work.
- primary: warm taupe (#5a4a3a) or warm charcoal (#1f1d1b).
- text: warm ink on cream, cream on dark.
- accent: muted gold (#b8935a), dusty sage (#8fa89a), terracotta (#c97c5d), or single muted hue. Editorial-quiet.
- fontHeading: Cormorant Garamond, Fraunces, or Playfair Display. Editorial serif required.
- fontBody: Lora, Inter, Open Sans.
- Feel: gallery wall, generous whitespace, "the work speaks."`,
    copy: `Voice: niche-specific (wedding / family / brand / editorial / real estate / newborn / senior), package-clear, deliverable-honest. Specific services: package name + hours covered + deliverable count + turnaround time + included extras (engagement session, second shooter, prints). Studio vs on-location. Travel fee policy. Booking + retainer flow. Avoid "capturing your special moments."`,
    variants: { hero: 'image', services: 'list', about: 'text_image', gallery: 'masonry' },
  },

  florist: {
    style: 'editorial',
    design: `Florist / floral design — garden-led, seasonal, editorial. Reference: Saipua, Sarah Winward, top boutique florists.
- background: warm cream (#faf3ed, #f7eee8). Cream or soft blush.
- primary: warm taupe (#a8907a) or soft charcoal (#2a2520).
- text: warm ink (#1a1612).
- accent: dusty rose (#d4a5a0), sage (#8fa89a), terracotta (#c97c5d), or aubergine (#5a3a4a). Garden-rooted.
- fontHeading: Cormorant Garamond, Fraunces, or Playfair Display.
- fontBody: Lora, Inter, Open Sans.
- Feel: Vogue-floral, slow garden energy. Avoid grocery-store-bouquet palettes.`,
    copy: `Voice: design-led, seasonal-aware, occasion-specific. Specific services: weekly subscription, weddings + events, sympathy, daily orders for delivery, workshops. Garden-style vs classic vs ikebana-influenced. Seasonal availability + locally-grown if applicable. Lead time + delivery radius. Custom consultation flow for events. Avoid "beautiful arrangements for every occasion."`,
    variants: { hero: 'minimal', services: 'list', about: 'text_image', gallery: 'masonry' },
  },

  bakery: {
    style: 'editorial',
    vertical: 'restaurant',
    design: `Boutique bakery — sourdough / pastry / cake. Reference: Tartine, Levain, top neighborhood bakeries.
- background: warm cream (#faf3ed, #f7f1e8) or soft butter (#f9f5e8).
- primary: warm taupe (#5a4a3a) or warm charcoal (#2d251f).
- text: warm ink (#1a1612).
- accent: terracotta (#c97c5d), mustard (#b8830d), deep berry (#7a1f3a), or cocoa (#6b4423). Warm pantry tones.
- fontHeading: Fraunces, Cormorant Garamond, or Playfair Display.
- fontBody: Lora, Inter, Open Sans.
- Feel: warm bread, butter light, hand-lettered hours card energy.`,
    copy: `Voice: signature-item-specific, baking-method-honest, daily-rhythm-aware. Specific services: daily case items (sourdough, country loaf, croissant, kouign-amann, cookies), custom cakes (lead time + serving tier), pies, pastries, wholesale to local cafes, special diet (gluten-free, vegan) if offered. Baked-fresh-daily vs same-day-only. Pre-order policy. Avoid "delicious treats made with love."`,
    variants: { hero: 'image', services: 'list', about: 'text_image', gallery: 'masonry' },
  },

  coffee_shop: {
    style: 'editorial',
    vertical: 'restaurant',
    design: `Specialty coffee — third-wave, roaster-aware, neighborhood-rooted. Reference: Sey, Sightglass, Onyx-tier independents.
- background: warm cream (#faf3ed, #f5ebe0) or soft off-white (#f7f4ed).
- primary: warm taupe (#5a4a3a), warm charcoal (#2d251f), or deep brown (#3a2820).
- text: warm ink (#1a1612).
- accent: terracotta (#c97c5d), mustard (#b8830d), sage (#7a9489), or rust (#b45309). Earthy, considered.
- fontHeading: Fraunces, Inter, or Cormorant Garamond.
- fontBody: Inter, Lora, Open Sans.
- Feel: morning light, brown sugar, "we know our beans."`,
    copy: `Voice: roaster-named, brew-method-specific, neighborhood-warm. Specific services: in-house roasting OR named partner (e.g., Counter Culture, Onyx), origin/process info, espresso program (drinks + house blend), V60/Chemex/AeroPress on bar, batch brew, retail beans + brew gear, pastries (named local bakery if applicable), lunch program if any, hours. Avoid "perfect cup of coffee experience."`,
    variants: { hero: 'image', services: 'list', about: 'text_image', gallery: 'masonry' },
  },

  wedding_planner: {
    style: 'editorial',
    design: `Wedding planning + design — full vs partial vs day-of. Reference: top editorial wedding planners on The Knot / Brides / Junebug.
- background: warm cream (#faf3ed, #f5ebe0) or soft blush (#f7eee8).
- primary: warm taupe (#a8907a) or soft charcoal (#2a2520).
- text: warm ink (#1a1612).
- accent: dusty sage (#8fa89a), blush (#d4a5a0), warm gold (#b8935a), or deep aubergine (#5a3a4a). Romantic but considered.
- fontHeading: Cormorant Garamond, Playfair Display, or Fraunces.
- fontBody: Lora, Inter, Open Sans.
- Feel: editorial, generous whitespace, "designed by hand."`,
    copy: `Voice: planning-tier specific, design-led, vendor-network-aware. Specific services: full planning, partial planning, month-of/day-of coordination, design + styling, destination weddings, budget tier (if signaled). Vendor relationships + curation. Average client count per year. Geographic range + travel fee. Booking + consultation flow. Avoid "your dream wedding made real."`,
    variants: { hero: 'minimal', services: 'list', about: 'text_image', gallery: 'masonry' },
  },

  tutor: {
    style: 'minimal',
    design: `Academic tutoring — subject-specific, credentialed, outcome-aware. Reference: top independent tutors on Wyzant / Varsity Tutors (boutique end).
- background: cream (#fafaf5, #f7f4ed). Warm-clean.
- primary: warm gray (#3a3a3a) or deep navy (#1e3a8a).
- text: deep ink (#1a1a1a).
- accent: deep blue (#1e40af), warm rust (#b45309), sage (#65a89a), or muted gold (#b8935a). Academic-calm.
- fontHeading: Fraunces (academic), Inter (clean modern), or Cormorant Garamond.
- fontBody: Inter, Lora, Open Sans.
- Feel: bookshelf, clear chalkboard, "I explain things clearly."`,
    copy: `Voice: subject + level specific, credentials-honest, outcome-aware. Specific services: subjects (math: algebra/geometry/precalc/calc, sciences: bio/chem/physics, humanities: writing/history, language), levels (K-12, AP, college), test prep (SAT/ACT/ISEE/SSAT/GRE), 1-on-1 vs small group, in-person vs online, intake/diagnostic. Background (degree, teaching experience, credential). Outcome framing without unverifiable claims (no "we guarantee score increases"). Avoid "unlock your child's potential."`,
    variants: { hero: 'minimal', services: 'list', about: 'text_image', gallery: 'off' },
  },

  med_spa: {
    style: 'luxe',
    design: `Med spa — clinical-luxe, MD/NP-supervised, treatment-specific. Reference: Skin Laundry, Skinney Medspa, top RealSelf-rated med spas.
- background: warm cream (#faf3ed, #f5ebe0) or soft blush (#f7eee8). NEVER pure white.
- primary: warm taupe (#a8907a) or soft charcoal (#2a2520).
- text: warm ink (#1a1612).
- accent: muted rose (#c89898, #d4a5a0), champagne gold (#c9a96e), or soft terracotta (#c97c5d). Editorial-clinical.
- fontHeading: Cormorant Garamond, Fraunces, or Playfair Display.
- fontBody: Lora, Inter, Open Sans.
- Feel: editorial-clinical — Vogue meets exam room. Avoid hot pink and "spa fountain" palettes.`,
    copy: `Voice: clinical credentials first (MD/NP/PA-supervised), treatment-named, consultation-driven. Specific services: neuromodulators (Botox, Dysport, Xeomin) — units pricing or by-area, dermal filler (lips, cheeks, jaw, tear trough) by syringe, microneedling (with/without RF), HydraFacial, IPL/photofacial, laser hair removal, body contouring (CoolSculpting/Emsculpt). Initial consultation + treatment planning. Avoid before/after as headline copy and "rejuvenate yourself."`,
    variants: { hero: 'minimal', services: 'list', about: 'text_image', gallery: 'masonry' },
  },

  pet_boarding: {
    style: 'editorial',
    design: `Pet boarding / dog daycare — calm, supervised, trust-first. Reference: top boutique boarding facilities, NACSW-aware kennels.
- background: warm cream (#faf6ef, #f4ede0). Never harsh white.
- primary: warm charcoal (#2d2a26) or warm taupe (#5a4a3a).
- text: deep warm ink (#1a1612).
- accent: dusty sage (#9bb19a), brass (#b8935a), warm terracotta (#c97c5d), or muted teal (#5a8a8a). Trust-warm.
- fontHeading: Fraunces, Inter, or Poppins. Avoid heavy-display sans.
- fontBody: Lora, Inter, Open Sans.
- Avoid neon paw-print blue/pink and "fur baby" palettes.`,
    copy: `Voice: supervision-led, vaccination-clear, daily-routine specific. Specific services: doggy daycare (full vs half day), overnight boarding (suite tier), cat boarding (separate area), small dog vs large dog separation, supervised play groups by size/temperament, vet on-call, medical/medication boarding, webcam access. Vaccination requirements (DHPP, bordetella, rabies). Trial day requirement. Avoid "home away from home" and "pawsitively perfect."`,
    variants: { hero: 'image', services: 'list', about: 'text_image', gallery: 'masonry' },
  },

  // ── Restaurants ──────────────────────────────────────────────────────────
  // Every profile below carries vertical: 'restaurant'. The route checks this
  // and branches into the menu / reservations / ordering pipeline. The LLM
  // still generates a `services` payload (schema requires it) but it's
  // ignored at render time; the Menu section reads content.menu instead.

  italian_restaurant: {
    style: 'restaurant-trattoria',
    vertical: 'restaurant',
    design: `Neighborhood Italian — warm, family-style, hand-lettered menus. Reference: Lilia (Brooklyn), Misi, Via Carota, Frankies Spuntino.
- background: warm cream (#f4ede0, #f1ead8) or bone (#efe7d3). Never pure white.
- primary: terracotta (#c44e34), oxblood (#7a1f1f), or deep olive (#2c4a2c) — pick ONE that anchors the page.
- text: espresso (#1a1612, #1f1a14). NEVER pure black.
- accent: olive, mustard (#caa84d), or a complementary terracotta when primary is olive.
- fontHeading: Playfair Display or Cormorant Garamond.
- fontBody: Lora or Inter.
- Avoid checkered-tablecloth red, neon, and any pizzeria-cartoon palette.`,
    copy: `Voice: regional-specific (Sicilian, Roman, Tuscan, Neapolitan, Northern), family heritage when real, ingredient-first. Mention pasta-making (hand-rolled / bronze-die / cavatelli), wood-fired oven if relevant, wine list scope, BYOB if applicable, reservation policy, private dining. Avoid "authentic" (overused), "world-class," and "passion for pasta."`,
    variants: { hero: 'image', services: 'list', about: 'text_image', gallery: 'masonry' },
  },

  sushi: {
    style: 'restaurant-omakase',
    vertical: 'restaurant',
    design: `Sushi / omakase — minimalist Japanese ritual aesthetic. Extreme whitespace, single brushstroke accent. Reference: Sushi Nakazawa, Sushi Noz, Atomix, Atelier Crenn.
- background: paper (#f0ece4, #f2ede1) OR ink (#0a0a0a, #0d0d0d). Pick a clear direction.
- primary: ink (#0d0d0d) on paper, paper on ink. NEVER warm beige.
- text: pure or near-pure (#000000, #e8e2d4). High contrast, no half-tones.
- accent: ONE — brushstroke red (#b8312e), gold leaf (#a98a4f), or muted indigo (#2a3a5a).
- fontHeading: Cormorant Garamond, Fraunces, or Playfair Display.
- fontBody: Inter or Lora. Body type stays light, never bold.
- Avoid: cherry blossoms, dragons, brush-script clichés, and saturated red ("Chinatown" cues).`,
    copy: `Voice: chef-led, ingredient-source-led, ritual-aware. Mention omakase course count + price, traditional Edomae if applicable, fish source (Toyosu / Tsukiji-trained chef), nigiri-only vs full menu, sake pairing program, counter seating, reservation lead time, no-photos policy if relevant. Avoid "authentic Japanese experience," "freshness," and dragon-roll aesthetics.`,
    variants: { hero: 'minimal', services: 'list', about: 'text_image', gallery: 'masonry' },
  },

  steakhouse: {
    style: 'restaurant-modern',
    vertical: 'restaurant',
    design: `Steakhouse — dark, premium, occasion-restaurant gravitas. Reference: Crown Shy, The Modern, Cote, St Anselm.
- background: deep ink (#0a0a0a, #14130f). Never charcoal-blue (reads cold).
- primary: warm dark surface (#1f1c19, #181818).
- text: cream (#ede8df, #f0ece4). NEVER pure white.
- accent: brass (#b88e3a), oxblood (#6b1a1a), or deep brick (#9c1f2c). Pick ONE.
- fontHeading: Cormorant Garamond, Playfair Display, or Fraunces. Editorial serif.
- fontBody: DM Sans, Inter, or Lora.
- Avoid: cattle-skull motifs, branding-iron type, "rustic farmhouse" cues.`,
    copy: `Voice: cut-led, dry-aged-aware, sourcing-specific. Mention dry-age program (days, in-house vs sourced), grade (Prime / A5 wagyu / heritage breed), steak weights + cuts (ribeye, NY strip, filet, tomahawk, porterhouse), wood-fire / broiler temp if a signature, raw bar / oysters, wine cellar size + sommelier, private dining. Avoid "world-class," "best in town," "carnivore's paradise."`,
    variants: { hero: 'image', services: 'list', about: 'text_image', gallery: 'masonry' },
  },

  pizzeria: {
    style: 'restaurant-trattoria',
    vertical: 'restaurant',
    design: `Pizzeria — neighborhood, oven-led, dough-craft pride. Reference: Roberta's, Lucali, Una Pizza Napoletana, Pizzeria Bianco.
- background: warm cream (#f4ede0, #f1ead8) OR deep ink for wood-fired-cave aesthetic (#1a1612).
- primary: terracotta (#c44e34), tomato red (#a8312a — NOT #ff0000), or deep olive (#2c4a2c).
- text: espresso (#1a1612) on cream, cream on dark.
- accent: mustard (#caa84d), olive, or warm brick.
- fontHeading: Playfair Display, Cormorant Garamond, or Fraunces.
- fontBody: Lora, Inter, or DM Sans.
- Avoid: cartoon Italian-flag pizza-slice mascots, neon NEW YORK PIZZA signage cues.`,
    copy: `Voice: oven-led, dough-led, style-specific (Neapolitan VPN-certified, NY classic, Detroit, Roman al taglio, Sicilian, Chicago tavern-style). Mention oven (wood-fired temp, brick / dome), dough fermentation time (24/48/72 hours), flour (00, heritage), tomato source (San Marzano DOP), mozzarella (fior di latte, buffalo). Whole pies, by-slice, takeout/delivery, by-the-pound (al taglio). Avoid "authentic Italian" and "best pizza in town."`,
    variants: { hero: 'image', services: 'list', about: 'text_image', gallery: 'masonry' },
  },

  taqueria: {
    style: 'restaurant-cafe',
    vertical: 'restaurant',
    design: `Taqueria — bright, ingredient-led, regional Mexican pride. NOT Tex-Mex chain energy. Reference: Tacos 1986, Taqueria Los Cocuyos, Loncheria El Especialito.
- background: warm cream (#f7f1e3, #faf6ee) or terracotta-tinted bone (#f3ecdb).
- primary: terracotta (#c44e34), saffron (#caa84d), or deep cilantro (#557a4a).
- text: warm ink (#1a1612).
- accent: warm rose (#c98679), turquoise (#3a8a93 — papel-picado quote, not Cancun resort), or bright marigold.
- fontHeading: Fraunces, Cormorant Garamond, or Playfair Display.
- fontBody: DM Sans, Inter, or Lora.
- Avoid: sombrero/cactus/maraca clichés, neon margarita signage cues, chain-restaurant red.`,
    copy: `Voice: regional-specific (Yucateco / Oaxacan / Norteño / Jalisciense / Sonorense), ingredient-honest, masa-led if applicable. Mention nixtamalized corn / heirloom corn, masa made in-house, salsa program (5 daily, mild → habanero), barbacoa overnight cook, agua frescas, no shells / hard tacos / ground beef if you're regional. Avoid "south-of-the-border" and "fiesta."`,
    variants: { hero: 'image', services: 'list', about: 'text_image', gallery: 'masonry' },
  },

  bistro: {
    style: 'restaurant-modern',
    vertical: 'restaurant',
    design: `Modern bistro / brasserie — sleek but unpretentious, neighborhood-second-home. Reference: Le Coucou, Frenchette, Buvette, Chez Ma Tante.
- background: warm cream (#f4ede0, #ede8df) OR ink (#14130f) — pick a clear direction.
- primary: deep oxblood (#6b1a1a), forest (#2c4a2c), or warm charcoal (#1f1c19).
- text: warm ink (#1a1612) on light, cream on dark.
- accent: brass (#b88e3a), garnet (#9c1f2c), or muted teal (#1aa1a1 used sparingly).
- fontHeading: Cormorant Garamond, Playfair Display, or Fraunces.
- fontBody: DM Sans, Inter, or Lora.
- Avoid: bistro-checkered tablecloth, Eiffel-tower clipart, "Parisian" stock-photo cues.`,
    copy: `Voice: technique-aware, ingredient-honest, neighborhood-warm. Mention chef training (CIA, ICC, time at named-kitchen), small-format menu changing weekly/seasonally, raw bar, wine list shape (natural / European / specific region), service style (à la carte vs prix fixe). Avoid "elevated comfort food" and "modern French."`,
    variants: { hero: 'image', services: 'list', about: 'text_image', gallery: 'masonry' },
  },

  thai_restaurant: {
    style: 'restaurant-modern',
    vertical: 'restaurant',
    design: `Thai — regional-specific (Northern, Isan, Southern, Central), market-fresh, herbs-led. Reference: Pok Pok, Soothr, Thip Khao, Khao Kang.
- background: warm cream (#f4ede0) or deep ink (#0a0a0a). Pick a clear direction.
- primary: deep teal (#1aa1a1), saffron (#caa84d), or oxblood (#6b1a1a).
- text: warm ink (#1a1612) on cream, cream on dark.
- accent: chili red (#c44e34), lime green (#7a9381 — botanical, NOT highlighter), or marigold.
- fontHeading: Cormorant Garamond, Fraunces, or Playfair Display.
- fontBody: DM Sans, Inter, or Lora.
- Avoid: gold-temple clichés, faux-Thai-script Latin fonts, neon pad-thai hot-pink.`,
    copy: `Voice: regional-honest, herbs-led, spice-level-aware. Mention region (Northern / Isan / Southern), specific dishes (khao soi, larb, sai oua, gaeng tai pla, pad see ew, boat noodles), spice-level scale, family recipes if real, BYOB / wine list, lunch specials. Avoid "authentic Thai," "exotic flavors," and "fusion."`,
    variants: { hero: 'image', services: 'list', about: 'text_image', gallery: 'masonry' },
  },

  chinese_restaurant: {
    style: 'restaurant-modern',
    vertical: 'restaurant',
    design: `Chinese — regional-specific (Sichuan, Cantonese, Shanghainese, Northern, Hunanese), wok-led. NOT panda-mascot chain energy. Reference: Mission Chinese, Junzi Kitchen, Hwa Yuan, Bonnie's.
- background: warm cream (#f4ede0) or deep ink (#0a0a0a).
- primary: oxblood (#7a1f1f), deep teal (#1aa1a1), or imperial yellow (#caa84d) used sparingly.
- text: warm ink on cream, cream on dark.
- accent: brushstroke red (#b8312e), jade (#557a4a), or gold leaf (#a98a4f).
- fontHeading: Cormorant Garamond, Fraunces, or Playfair Display.
- fontBody: DM Sans, Inter, or Lora.
- Avoid: pagoda clipart, brush-script Latin fonts, "wonton font," and saturated cinnabar reds.`,
    copy: `Voice: regional-specific, technique-led, ingredient-honest. Mention region (Sichuan / Cantonese / Shanghainese / Northern / Hunanese), specific dishes (mapo tofu, char siu, xiaolongbao, dan dan noodles, hot pot), wok-hei if real, dim sum service hours, family recipes if real, lazy susan / private rooms, BYOB. Avoid "authentic," "fusion," and chop-suey-era language.`,
    variants: { hero: 'image', services: 'list', about: 'text_image', gallery: 'masonry' },
  },

  bbq: {
    style: 'restaurant-modern',
    vertical: 'restaurant',
    design: `BBQ — regional-specific (Texas / Carolina / Memphis / Kansas City / Alabama), smokehouse aesthetic, wood-led. Reference: Franklin Barbecue, Lewis Barbecue, Hometown Bar-B-Que.
- background: deep ink (#0a0a0a, #14130f). Smokehouse-dark.
- primary: warm charcoal (#1f1c19, #181818).
- text: cream (#ede8df, #f0ece4). NEVER pure white.
- accent: warm copper (#b87333), oxblood (#6b1a1a), or deep mustard (#caa84d).
- fontHeading: Bebas Neue (signage-bold) or Fraunces (editorial-craft).
- fontBody: DM Sans, Inter, or Lora.
- Avoid: red-and-yellow chain-BBQ palettes, cartoon-pig mascots, "saucy" hot-pink cues.`,
    copy: `Voice: wood-led, brisket-led, line-honest. Mention region (Central Texas, Eastern NC, Memphis), wood (post oak, hickory, pecan), pit (offset stick-burner, J&R, custom), cuts (brisket point/flat, pork belly, beef rib, sausage links house-made), serve-style (by the pound, sandwich, plate), sold-out hours, line policy. Avoid "fall-off-the-bone" and "world-famous."`,
    variants: { hero: 'image', services: 'list', about: 'text_image', gallery: 'masonry' },
  },

  seafood_restaurant: {
    style: 'restaurant-cafe',
    vertical: 'restaurant',
    design: `Seafood / oyster bar — coastal, day-boat, raw-bar-led. Reference: Maison Premiere, Eventide Oyster Co, Saltie Girl, Le Bernardin (lighter end).
- background: warm cream (#faf6ee, #f4ede0) or pale-coastal stone (#f0ece4).
- primary: deep navy (#1a2f4a), warm charcoal (#2a2520), or muted slate (#475569).
- text: warm ink (#1a1612).
- accent: copper (#b87333), pale lemon (#caa84d used soft), or fresh sage (#7a9381).
- fontHeading: Fraunces, Cormorant Garamond, or Playfair Display.
- fontBody: DM Sans, Inter, or Lora.
- Avoid: nautical-rope/anchor clipart, pirate-font cues, captain-D's signage red.`,
    copy: `Voice: source-led, day-boat-honest, oyster-program-aware. Mention boats / suppliers, oyster varieties + provenance, raw-bar selection, daily catch + how it changes, chowder / lobster roll style (CT vs ME), wine list (Muscadet / Sancerre / Chablis), happy-hour oyster pricing if applicable. Avoid "fresh," "world-class," and "ocean-to-table."`,
    variants: { hero: 'image', services: 'list', about: 'text_image', gallery: 'masonry' },
  },

  indian: {
    style: 'restaurant-modern',
    vertical: 'restaurant',
    design: `Indian — regional-specific (North Indian / South Indian / Bengali / Gujarati / Punjabi / Indo-Chinese / coastal Goan or Keralan), spice-forward but never "tandoori-orange" cliché. Reference: Dhamaka, Semma, Adda, Dishoom, Junoon.
- background: warm cream (#f4ede0, #f1ead8) OR deep ink (#0a0a0a, #14130f). Pick a clear direction.
- primary: oxblood (#7a1f1f), deep teal (#1aa1a1), or smoked charcoal (#1f1c19).
- text: warm ink on cream, cream on dark.
- accent: saffron (#caa84d), marigold (#d97706), turmeric-gold (#b88e3a), or chili red (#b8312e). ONE accent.
- fontHeading: Cormorant Garamond, Fraunces, or Playfair Display.
- fontBody: DM Sans, Inter, or Lora.
- Avoid: faux-Devanagari Latin fonts, henna-paisley clipart, neon-orange chain palettes, elephant motifs.`,
    copy: `Voice: regional-specific, technique-led, ingredient-honest. Mention region (Punjabi / South Indian / Bengali / Gujarati / coastal), tandoor (clay vs gas), dosa griddle, biryani style (Hyderabadi / Lucknowi / Kolkata), chaat program, dal varieties, thali offerings, lassi / chai bar. Vegetarian-first vs meat-forward (avoid "veg-friendly"). BYOB or wine list with riesling / gewürz emphasis. Avoid "authentic Indian" and "exotic spices."`,
    variants: { hero: 'image', services: 'list', about: 'text_image', gallery: 'masonry' },
  },

  mediterranean: {
    style: 'restaurant-cafe',
    vertical: 'restaurant',
    design: `Mediterranean — coastal-bright, olive-oil-led, mezze-friendly. Pan-Mediterranean (Greek / Lebanese / Israeli / Turkish / Cypriot / coastal Italian). Reference: Zahav, Bavel, Kismet, Ladybird.
- background: warm cream (#faf6ee, #f4ede0) or sun-bleached stone (#efe7d3). Coastal-light.
- primary: deep olive (#5a6a3a), terracotta (#c44e34), or warm charcoal (#2a2520).
- text: warm ink (#1a1612).
- accent: aegean blue (#3a6a8a), saffron (#caa84d), or fresh oregano (#7a9381). ONE accent.
- fontHeading: Cormorant Garamond, Fraunces, or Playfair Display.
- fontBody: DM Sans, Inter, or Lora.
- Avoid: travel-poster Greek-isle whites, hookah-bar palettes, plaster-Roman-column clipart.`,
    copy: `Voice: olive-oil-source-led, mezze-aware, market-fresh. Mention regional bias (Greek / Lebanese / Israeli / Turkish), wood-fired or charcoal grill, fresh pita / lavash / saj baked in-house, hummus program (chickpea source), tahini brand, mezze for sharing, whole-grilled fish, lamb (slow-roast vs charcoal), wine list (Greek / Lebanese / Israeli — Assyrtiko, Domaine des Tourelles). Avoid "fresh Mediterranean cuisine" and "healthy eating."`,
    variants: { hero: 'image', services: 'list', about: 'text_image', gallery: 'masonry' },
  },

  greek: {
    style: 'restaurant-cafe',
    vertical: 'restaurant',
    design: `Greek — taverna warmth, olive-and-feta directness, NOT travel-brochure blue-and-white. Reference: Kiki's, Periyali, Estia, Avra (lighter end).
- background: warm cream (#faf6ee, #f4ede0) or sun-stone (#efe7d3).
- primary: aegean blue (#1f3a5e — quiet, NOT cyan), deep olive (#5a6a3a), or warm charcoal (#2a2520).
- text: warm ink (#1a1612).
- accent: sun-mustard (#caa84d), terracotta (#c44e34), or fresh oregano (#7a9381). ONE accent.
- fontHeading: Cormorant Garamond, Fraunces, or Playfair Display.
- fontBody: DM Sans, Inter, or Lora.
- Avoid: faux-Greek-letter Latin fonts (no Σ for E), travel-poster cyan, Parthenon clipart.`,
    copy: `Voice: taverna-warm, charcoal-grill-led, ingredient-honest. Mention region (Athenian / Cretan / Cycladic / Pelopponese), whole-fish on the plancha, lamb / pork / souvlaki off the charcoal, spreads (tzatziki, taramosalata, melitzanosalata, htipiti), Greek salad without lettuce (horiatiki), olive oil source, ouzo / tsipouro / wine list (Assyrtiko, Agiorgitiko, Xinomavro). Avoid "best gyro in town" and "opa!"`,
    variants: { hero: 'image', services: 'list', about: 'text_image', gallery: 'masonry' },
  },

  vietnamese: {
    style: 'restaurant-cafe',
    vertical: 'restaurant',
    design: `Vietnamese — herb-led, broth-honest, market-fresh. Regional (Northern / Central / Southern). Reference: Di An Di, Madame Vo, Bep Ga, Hai's, Anchovy Social.
- background: warm cream (#faf6ee, #f4ede0) or deep ink (#0a0a0a) for night-market energy.
- primary: deep teal (#1aa1a1), warm charcoal (#2a2520), or oxblood (#6b1a1a).
- text: warm ink on cream, cream on dark.
- accent: lime green (#7a9381 — botanical, NOT highlighter), saffron (#caa84d), or chili red (#c44e34). ONE accent.
- fontHeading: Cormorant Garamond, Fraunces, or Playfair Display.
- fontBody: DM Sans, Inter, or Lora.
- Avoid: pho-bowl-with-chopsticks logo cliché, conical-hat clipart, neon-yellow-on-red chain palettes.`,
    copy: `Voice: regional-specific, broth-led, herb-honest. Mention region (Hanoi-northern, Hue-central, Saigon-southern), pho broth (24+ hour bone simmer, named-cut beef), banh mi bread (in-house vs named bakery), bun (vermicelli) / com tam (broken rice), spring rolls (fresh vs fried), table herbs (rau ram, perilla, mint, basil), Vietnamese coffee program, beer / wine list. Avoid "authentic Vietnamese cuisine" and "exotic flavors."`,
    variants: { hero: 'image', services: 'list', about: 'text_image', gallery: 'masonry' },
  },

  korean: {
    style: 'restaurant-modern',
    vertical: 'restaurant',
    design: `Korean — modern Seoul-energy, banchan-pride. Covers full-service Korean AND Korean BBQ (table-grill). Reference: Atomix, Cote, Oiji, Atoboy, Anju, Jongro BBQ.
- background: warm cream (#f4ede0) OR deep ink (#0a0a0a, #14130f). Steakhouse-modern energy when KBBQ-led.
- primary: warm charcoal (#1f1c19, #181818), oxblood (#6b1a1a), or deep teal (#1aa1a1).
- text: cream on dark, warm ink on cream.
- accent: brass (#b88e3a), gochujang red (#b8312e), or perilla green (#5a7a4a). ONE accent.
- fontHeading: Cormorant Garamond, Fraunces, or Playfair Display.
- fontBody: DM Sans, Inter, or Lora.
- Avoid: K-pop neon palettes, hangul-as-decoration when content is English-only, brushstroke red over-saturation.`,
    copy: `Voice: banchan-pride, technique-led, AYCE-clear-when-applicable. Distinguish full-service Korean from Korean BBQ. For KBBQ: AYCE vs à la carte, meat tiers (USDA Prime, A5 wagyu, Iberico, marinated bulgogi/galbi vs unmarinated), grill type (gas, charcoal, hardwood), table-side service, soju / makgeolli list, side count. For full-service: bibimbap (stone bowl), guk / jjigae, anju (drinking food), jeon, naengmyeon, banchan rotation. Avoid "Korean fusion" and "all-you-can-eat" as a headline.`,
    variants: { hero: 'image', services: 'list', about: 'text_image', gallery: 'masonry' },
  },

  ramen: {
    style: 'restaurant-omakase',
    vertical: 'restaurant',
    design: `Ramen shop — broth-led, slurp-counter intimacy. Style-specific (tonkotsu / shio / shoyu / miso / tsukemen / mazemen). Reference: Ippudo (refreshed), Ivan Ramen, Totto Ramen, Ramen Ishida.
- background: paper (#f0ece4, #f2ede1) OR ink (#0d0d0d, #0a0a0a). Pick a clear direction.
- primary: ink (#0d0d0d) on paper, paper on ink. Counter-shop minimalism.
- text: pure or near-pure (#000000, #e8e2d4). High contrast.
- accent: brushstroke red (#b8312e), gold leaf (#a98a4f), or scallion green (#7a9381). ONE accent.
- fontHeading: Cormorant Garamond, Fraunces, or Playfair Display.
- fontBody: Inter or Lora.
- Avoid: cartoon-ramen-bowl logo, faux-Japanese Latin fonts, Naruto-fishcake mascot energy.`,
    copy: `Voice: broth-led, noodle-honest, style-specific. Mention broth style (tonkotsu / shio / shoyu / miso / tantanmen), broth simmer hours, noodles (in-house vs named maker — Sun Noodle), tare program, chashu (slow-cooked vs torched), ajitama (marinated egg), counter seating, wait policy, sold-out hours, side menu (gyoza, karaage, takikomi). Avoid "authentic ramen experience" and "best ramen in [city]."`,
    variants: { hero: 'minimal', services: 'list', about: 'text_image', gallery: 'masonry' },
  },

  middle_eastern: {
    style: 'restaurant-cafe',
    vertical: 'restaurant',
    design: `Middle Eastern — Lebanese / Syrian / Palestinian / Jordanian / Egyptian / Iraqi. Mezze-led, charcoal-grill-led, hummus-pride. Reference: Zahav, Ilili, Al Ameer, Tanoreen, Falafel Inc.
- background: warm cream (#f4ede0, #faf6ee) or sun-stone (#efe7d3).
- primary: deep olive (#5a6a3a), oxblood (#6b1a1a), or warm charcoal (#2a2520).
- text: warm ink (#1a1612).
- accent: saffron (#caa84d), terracotta (#c44e34), or fresh za'atar green (#7a9381). ONE accent.
- fontHeading: Cormorant Garamond, Fraunces, or Playfair Display.
- fontBody: DM Sans, Inter, or Lora.
- Avoid: faux-Arabic Latin fonts, hookah-lounge palettes, "exotic-bazaar" clipart, gold-on-black chain palettes.`,
    copy: `Voice: regional-specific, mezze-led, charcoal-honest. Mention region (Lebanese / Syrian / Palestinian / Jordanian / Egyptian / Iraqi), wood-fire / charcoal grill, fresh pita / saj / taboon baked in-house, hummus program (chickpea source, tahini brand), mezze for sharing (mutabbal, baba ghanoush, muhammara, kibbeh, sambousek), shawarma stack vs charcoal kebab, mansaf / kabsa / molokhia if applicable. BYOB or arak / Lebanese wine. Avoid "authentic Mediterranean" (be specific) and "exotic flavors."`,
    variants: { hero: 'image', services: 'list', about: 'text_image', gallery: 'masonry' },
  },

  spanish: {
    style: 'restaurant-modern',
    vertical: 'restaurant',
    design: `Spanish / tapas — wine-bar dark, plancha-and-jamón pride. Covers full-service Spanish AND tapas bars. Reference: Tertulia, Casa Mono, El Quinto Pino, Boqueria, Cúrate.
- background: warm cream (#f4ede0) OR deep ink (#14130f, #0a0a0a). Tapas-bar dark vs sit-down restaurant cream.
- primary: oxblood (#6b1a1a), warm charcoal (#1f1c19), or deep olive (#5a6a3a).
- text: cream on dark, warm ink on cream.
- accent: brass (#b88e3a), saffron (#caa84d), or paprika red (#b8312e). ONE accent.
- fontHeading: Cormorant Garamond, Fraunces, or Playfair Display.
- fontBody: DM Sans, Inter, or Lora.
- Avoid: flamenco-dancer clipart, "olé" signage cues, bullfighter motifs, faux-Spanish Latin fonts.`,
    copy: `Voice: regional-specific, jamón-and-plancha led, sherry-aware. Mention region (Catalan / Basque / Andalusian / Galician), jamón program (Iberico de Bellota, dry-cured years, hand-sliced), plancha vs charcoal, paella (Valencian, mixto, negra) on Saturdays / by reservation, pintxos vs tapas, raciones vs medias, sherry / cava / Spanish wine list (Albariño, Tempranillo, Mencía, Verdejo). Avoid "authentic Spanish cuisine" and "festive" anything.`,
    variants: { hero: 'image', services: 'list', about: 'text_image', gallery: 'masonry' },
  },

  fast_casual: {
    style: 'restaurant-counter',
    vertical: 'restaurant',
    design: `Fast-casual / counter-service — smash burger / wings / chicken sandwich / bowls / fast tacos / poke / sub shop. Bold, ticket-stub graphic, halftone-print energy. Order-at-the-counter clarity. Reference: Hopdoddy, Shake Shack (refreshed boutique end), Sweetgreen (boutique end), Goldbelly indie burger joints, Joe's Steam Rice Roll.
- background: cream (#fafaf5, #f7f4ed) OR deep ink (#0e0d0c, #14110e). High-contrast.
- primary: warm charcoal (#1f1c19), deep red (#b8312e), or warm navy (#1a2f4a).
- text: deep ink (#1a1612) on cream, cream on dark.
- accent: signal yellow (#f59e0b), tomato red (#dc2626 used sparingly), or kelly green (#16a34a). ONE bright, decisive accent.
- fontHeading: Bebas Neue (signage-bold), Space Grotesk (modern), or Inter. NOT a serif.
- fontBody: Inter, DM Sans, Roboto, or Open Sans.
- Feel: ticket / receipt / hand-stamped / numbered. Print-shop energy. NOT McDonald's-corporate, NOT chain-cartoon.
- Avoid: stock-burger photos, cartoon-mascot logos, fake-handwriting fonts, "world's best" signage red-and-yellow combos.`,
    copy: `Voice: format-specific (smash burger / wings / chicken sandwich / bowls / fast tacos / poke / subs), griddle/fryer-honest, order-and-go clear. Mention format (counter-order, walk-up, kiosk, online), smash technique (heavy press, lacy edges, double-stack), wing styles (bone-in / boneless / sauces named), sandwich build (brioche / sesame, pickle, sauce), patty source (grass-fed, dry-aged blend if real), fryer oil (beef tallow / peanut / canola), shake / fountain / canned-craft drinks, side count (fries cut in-house). Speed without sacrificing care. Hours, pickup vs delivery (DoorDash / UberEats), call-ahead. Avoid "fresh ingredients," "made with love," and "best burger in town."`,
    variants: { hero: 'image', services: 'grid', about: 'text', gallery: 'masonry' },
  },

  // Catch-all for industries we haven't pre-profiled. The route requires an
  // industry_label; the prompt builder substitutes it for the niche key so the
  // LLM has a real industry name to anchor copy against. The design/copy here
  // are deliberately neutral — the LLM should research the typed industry's
  // visual conventions rather than over-fit to a generic profile.
  other: {
    style: 'minimal',
    design: `Local small-business landing page — neutral fallback when the niche isn't pre-profiled. Research how this specific industry presents itself online and emulate that visual language; do not default to SaaS-template energy.
- background: warm cream (#fafaf5, #f7f4ed) is a safe default. NEVER pure white.
- primary: warm gray (#3a3a3a) or deep charcoal (#1f2937) is a safe default.
- text: deep ink (#1a1a1a). NEVER pure black.
- accent: pick ONE color appropriate for this specific industry. Archetypes: trades → navy + amber; wellness → cream + sage; creative → cream + terracotta; food → cream + warm rust; auto → charcoal + electric blue.
- fontHeading + fontBody: pick a pairing that matches the industry's visual conventions (see style guide). If unsure, default to: minimal style, cream + warm gray + one tasteful accent, Inter heading + Inter body.`,
    copy: `Voice: appropriate for this specific industry — research how this industry actually talks about its services. Lead with what's actually offered, not adjectives. Be concrete about scope/format/duration/who-serves. Mention any credentials/licenses that build trust in this trade. Avoid platitudes ("we pride ourselves," "your trusted partner," "exceptional service") and unverifiable claims ("best," "#1," "premier").`,
    variants: { hero: 'minimal', services: 'list', about: 'text_image', gallery: 'grid' },
  },
};

// Public lookup so the route can pin section variants to the niche.
export function getNicheProfile(niche: Niche): NicheProfile {
  return NICHE_PROFILES[niche];
}

// Reference notes for each style — the LLM uses these to choose the matching
// `style` value AND to size copy / accent decisions. The style value also
// drives template rendering so it MUST match the niche's profile.
const STYLE_GUIDE = `
- editorial: serif-led, italic accents in headlines, generous whitespace, cream background + ink text. Slow, confident. Often pairs Fraunces / Playfair / Cormorant Garamond + Lora.
- luxe: boutique-feminine, refined serif, soft palette (cream, blush, taupe, warm gold), low contrast, lots of breathing room. Headline_emphasis encouraged.
- premium-dark: dark base (deep ink, charcoal), warm metallic or oxblood accent, ambient feel. Sans display (Bebas, Space Grotesk) or editorial serif (Fraunces) — never a friendly sans.
- bold: high-contrast, big type, single strong accent color used decisively. Often Bebas Neue or Space Grotesk + Inter/Roboto. Confident, transformation-led.
- minimal: restrained palette (cream + one accent), small accents, lots of whitespace. Inter / Poppins / Fraunces with Inter/DM Sans body.
- service-tech: navy / charcoal / cream base + electric accent (blue, teal). Modern sans only (Inter, Space Grotesk, DM Sans). Reads like a tech-platform service product.
- restaurant-trattoria: warm Italian — cream base, terracotta / oxblood / olive accent, hand-lettered menu energy. Playfair Display or Cormorant Garamond + Lora.
- restaurant-modern: dark editorial bistro / steakhouse / cocktail bar — deep ink base, brass / oxblood / saturated single accent, dramatic food photography. Cormorant Garamond + DM Sans or similar.
- restaurant-cafe: bright cafe / brunch / coastal — warm cream + sage / peach / mustard, airy and friendly. Fraunces + DM Sans.
- restaurant-omakase: minimalist Japanese / fine-dining tasting — paper or ink base, single brushstroke accent, extreme whitespace. Cormorant Garamond + Inter, body type stays light.
- restaurant-counter: fast-casual / counter-service — smash burger, wings, chicken sandwich, bowls, fast tacos, poke. High-contrast cream-or-ink base + ONE signal accent (yellow / tomato red / kelly green). Bold sans only — Bebas Neue, Space Grotesk, or Inter. Ticket-stub / hand-stamped / signage energy, never serif.
- playful-pop: joyful boutique brands — chunky display heading + rounded humanist body. Vibrant 2-color palette (hot pink / sunshine yellow / mint / coral). Heading: Bowlby One. Body: Nunito. Reads as friendly, kid-aware, festive — fits bakeries, kids' tutoring, pet boarding, ice-cream shops, party planning. Avoid muted/serious palettes here.
- brutalist: raw editorial / anti-design — oversized condensed display heading + monospaced body. Stark monochrome base (concrete or ink) + ONE electric accent (magenta / volt / cyan). Heading: Anton. Body: Space Mono. Reads as alt-cool, intentional, low-fi — fits indie barbers, tattoo shops, alt cafes, record stores, design studios. Avoid color complexity.
- art-deco: 1920s geometric refinement — Italiana display heading + Lora body. Gold-on-onyx, ivory-on-emerald, or burgundy-cream-gold palettes. Reads as gilded, occasion-restaurant, jewelry-box, cocktail-bar. Heading: Italiana. Body: Lora. Fits cocktail bars, fine-dining alternates, jewelry, formal salons, hotel lobbies.
- retro-90s: arcade / synthwave / vaporwave nostalgia — Audiowide display heading + Space Mono body. Neon-on-black or pastel-vapor palettes (hot pink / cyan / electric purple / sunshine yellow). Reads as out-of-the-ordinary, playful-but-edgy. Heading: Audiowide. Body: Space Mono. Fits record stores, comic shops, alt-pizzerias, gaming cafes, indie streetwear. Use sparingly — strong vibe.`;

export async function generateSiteContent(input: GenerationInput): Promise<GeneratedContent> {
  const filteredReviews = input.reviews ? filterReviews(input.reviews) : [];
  const hasReviews = filteredReviews.length > 0;
  const profile = NICHE_PROFILES[input.niche];

  // For 'other', the user-typed industry is what we anchor copy to. The route
  // is responsible for ensuring industry_label is present + sane.
  if (input.niche === 'other' && !input.industry_label?.trim()) {
    throw new Error("generateSiteContent: niche='other' requires industry_label");
  }
  const industryDisplay =
    input.niche === 'other'
      ? input.industry_label!.trim().toLowerCase()
      : input.niche.replace('_', ' ');

  const systemPrompt = `You are a designer-copywriter generating landing page content for local service businesses. Your output must look like it was made by a boutique agency, not a template generator. Two ${industryDisplay}s on this platform should NEVER look like the same business — the palette, fonts, and voice should reflect the specific shop you're writing about.

Output MUST be valid JSON matching this exact structure — no other text, no markdown fences:
{
  "hero": {
    "headline": "...",
    "headline_emphasis": "...",
    "subheadline": "...",
    "cta_text": "..."
  },
  "about": { "title": "...", "body": "..." },
  "services": [ { "name": "...", "description": "...", "price": "..." } ],
  "theme": {
    "primary": "#hex",
    "background": "#hex",
    "text": "#hex",
    "accent": "#hex",
    "fontHeading": "...",
    "fontBody": "...",
    "style": "..."
  }
}

═══ STYLE — PICK THIS FIRST ═══

For this ${industryDisplay} the canonical style is: "${profile.style}".

Default to "${profile.style}" unless the business signals strongly point another direction (e.g. a barbershop named "The Refined Gent" might lean editorial instead of premium-dark). Whatever you pick, every other choice — palette, fonts, voice, layout density — must match the style.

Style guide:${STYLE_GUIDE}

═══ DESIGN INTENT (niche-specific) ═══

${profile.design}

Color rules that apply across ALL styles:
- Never pure black (#000000) or pure white (#ffffff). Always use off-shades.
- One accent color, used decisively. Two accents = template energy, not boutique.
- background and text must have at least 7:1 contrast.
- primary should harmonize with background (often a darker shade of the same family).

Font rules:
- fontHeading must be exactly one of: Playfair Display, Fraunces, Cormorant Garamond, Inter, Merriweather, Bebas Neue, Poppins, Space Grotesk
- fontBody must be exactly one of: Inter, Lora, Open Sans, Roboto, DM Sans
- Match the font pairing to the style. Editorial/luxe styles MUST use a serif heading. Premium-dark uses display sans (Bebas, Space Grotesk) or editorial serif (Fraunces). Service-tech uses modern sans only (Inter, Space Grotesk, DM Sans) — never a serif.

═══ COPY VOICE ═══

Headlines — short, declarative, specific. Ideal: 4–8 words.
  GOOD: "Sharp Cuts in Bed-Stuy" / "Detailing That Stops Traffic" / "Fresh Sets, Fast"
  BAD: "Welcome to Our Shop" / "Quality You Can Trust" / "Your One-Stop Destination"

headline_emphasis — for editorial/luxe styles especially, pick ONE word from the headline that the template will italicize for editorial flair. The word must literally appear in the headline. For bold / premium-dark / service-tech styles, OMIT the field entirely (do not include the "headline_emphasis" key in the JSON at all — never use an empty string ""). Pick a word that benefits from emphasis: an adjective ("real", "sharp", "refined"), a verb ("transforms", "restores"), or a place ("Brooklyn"). Never the business name.
  Example: headline "Your business deserves a real website." → headline_emphasis: "deserves"
  Example: headline "Detailing that stops traffic." → headline_emphasis: "stops"
  Example (bold/service-tech): no "headline_emphasis" key in the output

Subheadlines — one concrete reason a customer would care. Not a tagline.
  GOOD: "Walk-ins welcome until 8pm. Six chairs, no waiting."
  BAD: "Providing exceptional service to our valued customers."

About body — write like the business owner talking, not a marketing department. Short sentences. Concrete over abstract.
  GOOD: "Three chairs. Cash and card. Walk-ins welcome but appointments cut the line. Open six days, closed Mondays."
  BAD: "We pride ourselves on delivering exceptional barbering services to discerning clients in a welcoming environment."

Service descriptions — tell what's included, not how great it is.
  GOOD: "Cut, hot towel, neck shave. 30 min."
  BAD: "Experience the perfect haircut, tailored to your style."

CTA text — action verbs only. HARD MAX 20 characters including spaces — count before writing.
  GOOD (all ≤20 chars): "Book Now" / "Call Today" / "Get a Quote" / "Book Grooming" / "Schedule Visit" / "Reserve a Spot" / "Book a Cut"
  BAD (too long, will be rejected): "Schedule Appointment" / "Book Your Appointment" / "Schedule Your Pup's Visit"
  BAD (vague): "Learn More" / "Get Started" / "Click Here"
  If a longer phrase is tempting, shorten it: "Schedule Appointment" → "Book Now"; "Book Grooming Appointment" → "Book Grooming".

WHAT MAKES IT LOOK CHEAP (never do this):
- Empty platitudes ("we care about quality," "we pride ourselves")
- Hedge words ("decent," "great," "amazing," "exceptional")
- "Welcome to" anything
- Repeating the business name in every section
- Lorem-ipsum filler ("comprehensive solutions tailored to your needs")

═══ NICHE COPY DIRECTION ═══
${profile.copy}

═══ HARD CONSTRAINTS ═══
- NO HTML tags. Plain text only.
- NO URLs, email addresses, or phone numbers.
- hero.headline: 5–80 characters
- hero.headline_emphasis: when present, 2–30 characters AND must literally appear in hero.headline. For bold/premium-dark/service-tech styles, OMIT the key (do not include it). Empty string "" is invalid.
- hero.subheadline: 10–160 characters
- hero.cta_text: 2–20 characters
- about.body: 50–800 characters. No fake testimonials.
- 2–8 services, each name ≤50 chars, description ≤200 chars, price ≤40 chars
- Price format: terse and scannable. OK: "$99", "From $89", "$50–$120", "$50 sm / $120 lg", "$199/visit", "Starting at $89". NOT OK: long prose, multiple sentences, ranges with caveats. If pricing varies more than a short tier expression can capture, OMIT the price field and explain inclusions in the description instead.
- All color values must be 6-digit hex (#rrggbb)
- theme.style must be exactly one of: editorial, luxe, premium-dark, bold, minimal, service-tech
- NO superlatives: "best," "finest," "premier," "#1," "top-rated"
- NO unverifiable claims: years in business, number of customers, awards
- NO review-derived quotes or paraphrases — reviews are tone signal only
- Write copy a typical ${industryDisplay} owner would approve sight unseen`;

  const reviewSection = hasReviews
    ? `Customer review signals (tone inference only — do not quote or paraphrase):\n${filteredReviews.join(' | ')}`
    : 'No customer reviews provided.';

  const locationLine = formatLocation(input.city, input.state);
  const userPrompt = `Generate landing page content for:
Business: ${input.business_name}
Type: ${industryDisplay}
${locationLine ? `Location: ${locationLine}\n` : ''}${reviewSection}

Output ONLY the JSON object. No prose, no markdown.`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('generateSiteContent: no text in response');
  }

  const raw = textBlock.text
    .trim()
    .replace(/^```(?:json)?\n?/, '')
    .replace(/\n?```$/, '')
    .trim();

  const parsed: unknown = JSON.parse(raw);
  const validated = generatedContentSchema.parse(parsed);
  return sanitizeGeneratedContent(validated);
}

// ============================================================================
// Restaurant menu skeleton — generated post-claim placeholder
//
// Cold-CSV restaurants have no real menu data, so we generate a plausible
// menu skeleton from the niche. Each item gets a UUID server-side; LLM only
// returns titles/descriptions/prices.  The customer replaces this with their
// real menu in the editor — banner stays until they save any change.
// ============================================================================

const menuSkeletonSchema = z.object({
  categories: z
    .array(
      z.object({
        title: z.string().min(2).max(40),
        description: z.string().max(120).optional(),
        items: z
          .array(
            z.object({
              name: z.string().min(2).max(60),
              description: z.string().max(180).default(''),
              price: z.string().max(20).default(''),
              dietary: z
                .array(z.enum(['gf', 'vg', 'v', 'df', 'spicy', 'nf']))
                .optional(),
            }),
          )
          .min(2)
          .max(8),
      }),
    )
    .min(3)
    .max(5),
});

export type MenuSkeletonInput = {
  niche: Niche;
  business_name: string;
  city: string;
  state: string;
  industry_label?: string;
};

export async function generateMenuSkeleton(
  input: MenuSkeletonInput,
): Promise<MenuConfig> {
  const cuisineLabel =
    input.niche === 'other'
      ? input.industry_label?.trim().toLowerCase()
      : input.niche.replace(/_/g, ' ');

  if (!cuisineLabel) {
    throw new Error('generateMenuSkeleton: cuisine label required');
  }

  const systemPrompt = `You are a restaurant menu writer generating a placeholder menu skeleton for a website. The customer will replace this with their real menu when they claim the site, but in the meantime the page must look complete and plausible to anyone viewing it.

Output MUST be valid JSON matching this exact structure — no other text, no markdown fences:
{
  "categories": [
    {
      "title": "...",
      "description": "...",   // OPTIONAL one-line italic subtitle
      "items": [
        {
          "name": "...",
          "description": "...",
          "price": "...",
          "dietary": ["gf"|"vg"|"v"|"df"|"spicy"|"nf"]   // OPTIONAL array
        }
      ]
    }
  ]
}

═══ HARD CONSTRAINTS ═══
- 3 to 5 categories. Order them as a real menu would: starters → mains → sides → dessert (or category equivalents for the cuisine).
- 2 to 5 items per category.
- Item name: 2–60 characters. Use real dish names appropriate for the cuisine. NO made-up "Signature Special" type names.
- Item description: 0–180 characters. Plain language, ingredient-led. NO marketing adjectives ("amazing," "delicious," "world-class"). Empty string if the dish name is self-explanatory.
- Item price: terse string ("18", "$24", "12.5"). Plausible for the cuisine${formatLocation(input.city, input.state) ? ` + locale (${formatLocation(input.city, input.state)})` : ''}. Empty string if pricing varies (rare).
- Dietary tags: only when actually applicable. Don't tag every item.
- Category title: short, traditional. "Antipasti" not "Italian Starters." "Main Plates" not "Entrée Section."
- Category description: optional, 1 line, italic-style ("To start", "From the wood-fired oven"). Use sparingly.
- NO URLs, emails, phone numbers, or HTML.

═══ CUISINE GUIDANCE ═══
This is a ${cuisineLabel}${formatLocation(input.city, input.state) ? ` in ${formatLocation(input.city, input.state)}` : ''}. Generate dishes that a typical ${cuisineLabel} would actually serve. Be regional-appropriate when the cuisine has clear regional traditions (e.g., Italian: Neapolitan vs Roman vs Tuscan; Mexican: Yucatecan vs Norteño; BBQ: Central Texas vs Carolina vs Memphis). When the niche is generic (e.g., "italian restaurant"), default to a balanced cross-section rather than over-specializing.

The business name is "${input.business_name}" — use it ONLY if the name itself implies a specific direction (e.g., "Pizzeria Salvo" → pizza-led; "Carmine's Steakhouse" → steak-led). Otherwise treat the name as neutral.

Write for a customer who will edit this — make it easy for them to skim, recognize "yes that's roughly right for my place," and replace items one at a time.`;

  const menuLocation = formatLocation(input.city, input.state);
  const userPrompt = `Generate a menu skeleton for:
Business: ${input.business_name}
Cuisine: ${cuisineLabel}
${menuLocation ? `Location: ${menuLocation}\n` : ''}
Output ONLY the JSON object. No prose, no markdown.`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('generateMenuSkeleton: no text in response');
  }

  const raw = textBlock.text
    .trim()
    .replace(/^```(?:json)?\n?/, '')
    .replace(/\n?```$/, '')
    .trim();

  const parsed: unknown = JSON.parse(raw);
  const validated = menuSkeletonSchema.parse(parsed);

  // Inject UUIDs for stable identity. The LLM doesn't generate IDs; the
  // editor uses them as React keys and to match items across saves.
  return {
    categories: validated.categories.map((c) => ({
      id: crypto.randomUUID(),
      title: c.title,
      description: c.description,
      items: c.items.map((i) => ({
        id: crypto.randomUUID(),
        name: i.name,
        description: i.description,
        price: i.price,
        ...(i.dietary && i.dietary.length > 0 ? { dietary: i.dietary } : {}),
      })),
    })),
  };
}

// ============================================================================
// Moderation pass — second LLM call (Haiku)
// Strengthened prompt: specific rejection criteria beyond generic profanity check.
// See DECISIONS.md Decision 6.
// ============================================================================

type ModerationResult = { ok: true } | { ok: false; reason: string };

const MODERATION_PROMPT = `Review this auto-generated landing page for a small business.

REJECT if the content:
- Makes specific factual claims that can't be verified (e.g. "Brooklyn's #1", "voted best", "20 years experience" unless explicitly stated in the inputs)
- Contains hedging quality language that implies mediocrity ("decent service," "not bad," "pretty good," "fairly reliable") — note: time-based promises like "usually in the chair within X minutes" are acceptable positive claims, not hedges
- Quotes or paraphrases customer reviews directly
- Mentions parking, location difficulty, or other off-topic concerns
- Uses superlatives without basis ("best," "finest," "premier" without source data)
- Contains anything unprofessional, profane, offensive, or discriminatory
- Contains URLs, email addresses, or phone numbers
- Mentions competitors or other businesses
- Would embarrass a small business owner if they saw it unexpectedly

ACCEPT only if the copy reads like generic professional marketing the business owner would proudly show.

Reply with JSON only: {"ok": true} or {"ok": false, "reason": "brief explanation"}

Content to review:`;

export async function moderateContent(content: GeneratedContent): Promise<ModerationResult> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 200,
    messages: [
      {
        role: 'user',
        content: `${MODERATION_PROMPT}\n${JSON.stringify(content)}`,
      },
    ],
  });

  const text = response.content.find((b) => b.type === 'text');
  if (!text || text.type !== 'text') return { ok: true };

  try {
    const result: unknown = JSON.parse(
      text.text
        .trim()
        .replace(/^```(?:json)?\n?/, '')
        .replace(/\n?```$/, '')
        .trim()
    );

    if (
      typeof result === 'object' &&
      result !== null &&
      'ok' in result &&
      typeof (result as Record<string, unknown>)['ok'] === 'boolean'
    ) {
      const r = result as Record<string, unknown>;
      if (r['ok'] === true) return { ok: true };
      return {
        ok: false,
        reason: typeof r['reason'] === 'string' ? r['reason'] : 'moderation_rejected',
      };
    }

    return { ok: true }; // unparseable → fail open
  } catch {
    return { ok: true }; // unparseable JSON → fail open
  }
}
