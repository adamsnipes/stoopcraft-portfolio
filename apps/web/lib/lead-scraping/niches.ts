// Niche registry — each preset has a Google Places search query, a chain
// blacklist, and an adjacency filter that drops false-positive categories.
//
// Free-text niches (any string not in this registry) fall through to a
// no-op filter: only the universal filters (no-website, mobile-only,
// dedupe) apply.

export type NicheConfig = {
  key: string;
  displayName: string;
  query: string;
  chainKeywords: string[];
  // Returns true to REJECT — name is already lowercased
  adjacencyFilter?: (nameLower: string) => boolean;
};

// Drop pure salons from barbershop results (no barber signal in the name)
const isPureSalon = (n: string): boolean => {
  const salonSignals = ['salon', 'beauty', 'hair studio', 'hairstudio', 'hair stylists'];
  const barberSignals = ['barber', 'barbershop', 'barbers', 'cuts', 'cutz', 'kutz', 'clippers'];
  if (!salonSignals.some((kw) => n.includes(kw))) return false;
  return !barberSignals.some((kw) => n.includes(kw));
};

const isBarberNotSalon = (n: string): boolean => {
  const barberOnly = ['barbershop', 'barber shop', 'barbers'];
  if (barberOnly.some((kw) => n.includes(kw))) {
    return !(n.includes('salon') || n.includes('spa'));
  }
  const nonHair = ['nail salon', 'nails', 'beauty supply', 'beauty store'];
  if (nonHair.some((kw) => n.includes(kw))) {
    return !(n.includes('hair') || n.includes('salon'));
  }
  return false;
};

const isNonMassage = (n: string): boolean => {
  const signals = [
    'chiropract',
    'physical therapy',
    'pt clinic',
    'physiotherapy',
    'acupuncture clinic',
    'nail salon',
    'nails',
    'barbershop',
  ];
  if (signals.some((kw) => n.includes(kw))) {
    return !(n.includes('massage') || n.includes('spa'));
  }
  return false;
};

const isNonGrooming = (n: string): boolean => {
  const non = [
    'vet',
    'veterinary',
    'veterinarian',
    'animal hospital',
    'boarding',
    'kennel',
    'training',
    'trainer',
    'daycare',
    'day care',
    'walker',
    'walking',
    'sitter',
    'sitting',
    'supplies',
    'pet store',
    'pet shop',
    'rescue',
    'shelter',
    'adoption',
  ];
  if (!non.some((kw) => n.includes(kw))) return false;
  const grooming = [
    'groom',
    'groomer',
    'grooming',
    'spa',
    'salon',
    'wash',
    'bath',
    'bathing',
    'clipper',
    'shear',
    'fluff',
    'tub',
  ];
  return !grooming.some((kw) => n.includes(kw));
};

// Trade adjacency filter — drops supply houses, wholesalers, distributors,
// rentals, and parts shops that come up alongside contractor results.
const tradeAdjacencyFilter = (n: string): boolean => {
  const non = [
    'supply',
    'wholesale',
    'distributor',
    'distribution',
    'parts',
    'rental',
    'equipment rental',
    'manufacturer',
    'fabrication',
  ];
  return non.some((kw) => n.includes(kw));
};

export const NICHE_PRESETS: Record<string, NicheConfig> = {
  dog_grooming: {
    key: 'dog_grooming',
    displayName: 'Dog Grooming',
    query: 'dog groomer',
    chainKeywords: [
      'petsmart',
      'petco',
      'pet supplies plus',
      'pet valu',
      'camp bow wow',
      'dogtopia',
      'scenthound',
      'splash and dash',
      'aussie pet mobile',
      'the dog wash',
      'petsuites',
      'best friends pet care',
      'pet paradise',
      "wag n' wash",
      'wag n wash',
      'barkbus',
    ],
    adjacencyFilter: isNonGrooming,
  },
  barbershop: {
    key: 'barbershop',
    displayName: 'Barbershop',
    query: 'barbershop',
    chainKeywords: [
      'supercuts',
      'great clips',
      'sport clips',
      'fantastic sams',
      'cost cutters',
      'hair cuttery',
      "floyd's 99",
      'floyds 99',
      'roosters',
      "v's barbershop",
      'vs barbershop',
      "sharkey's",
      'first choice haircutters',
      'regis',
      'smartstyle',
    ],
    adjacencyFilter: isPureSalon,
  },
  hair_salon: {
    key: 'hair_salon',
    displayName: 'Hair Salon',
    query: 'hair salon',
    chainKeywords: [
      'regis',
      'smartstyle',
      'fantastic sams',
      'cost cutters',
      'hair cuttery',
      'supercuts',
      'great clips',
      'drybar',
      'madison reed',
      'jcpenney salon',
      'ulta salon',
      'blo blow dry bar',
    ],
    adjacencyFilter: isBarberNotSalon,
  },
  massage: {
    key: 'massage',
    displayName: 'Massage / Spa',
    query: 'massage spa',
    chainKeywords: [
      'massage envy',
      'hand and stone',
      'hand & stone',
      'elements massage',
      'massage heights',
      'woodhouse spa',
      'spa sydell',
      'the now massage',
      'massage luxe',
    ],
    adjacencyFilter: isNonMassage,
  },
  roofers: {
    key: 'roofers',
    displayName: 'Roofers',
    query: 'roofing contractor roofer',
    chainKeywords: [
      'power home remodeling',
      'erie home',
      'erie construction',
      'home depot',
      'lowes',
      "lowe's",
      'sears home services',
      'leafguard',
      'leaffilter',
      'gutter helmet',
      'beldon',
      'long roofing',
      'long home',
      'baker roofing',
    ],
    adjacencyFilter: tradeAdjacencyFilter,
  },
  hvac: {
    key: 'hvac',
    displayName: 'HVAC',
    query: 'hvac contractor heating cooling',
    chainKeywords: [
      'one hour heating',
      'service experts',
      'ars/rescue rooter',
      'ars rescue rooter',
      'aire serv',
      'horizon services',
      'sila',
      'lennox',
      'trane',
      'goodman',
      'carrier',
      'home depot',
      'lowes',
      "lowe's",
      'sears home services',
      'mister sparky',
    ],
    adjacencyFilter: tradeAdjacencyFilter,
  },
  plumbers: {
    key: 'plumbers',
    displayName: 'Plumbers',
    query: 'plumber plumbing contractor',
    chainKeywords: [
      'roto-rooter',
      'roto rooter',
      'mr. rooter',
      'mr rooter',
      'benjamin franklin',
      'len the plumber',
      'horizon services',
      'ars/rescue rooter',
      'ars rescue rooter',
      'pipe doctor',
      "michael & son",
      'michael and son',
      'home depot',
      'lowes',
      "lowe's",
      'sears home services',
      'big blue',
    ],
    adjacencyFilter: tradeAdjacencyFilter,
  },
};

export const NICHE_PRESET_KEYS = Object.keys(NICHE_PRESETS);

// Resolve a free-text or preset niche into a config. If the input doesn't
// match a preset, return a stub config with the input as the query and no
// niche-specific filters — universal filters still apply.
export function resolveNiche(input: string): NicheConfig & { isPreset: boolean } {
  const trimmed = input.trim();
  const key = trimmed.toLowerCase().replace(/[\s-]+/g, '_');
  const preset = NICHE_PRESETS[key];
  if (preset) return { ...preset, isPreset: true };
  return {
    key: trimmed,
    displayName: trimmed,
    query: trimmed,
    chainKeywords: [],
    isPreset: false,
  };
}

// CPaaS / MVNE carriers that issue fake mobile numbers. These come back
// with line_type=mobile from Twilio LTI but the numbers are throwaway —
// can't reliably reach a human there.
export const BLOCKED_CARRIERS = [
  'onvoy',
  'sinch',
  'bandwidth',
  'syniverse',
  'zipwhip',
  'twilio',
];

// Treat these as "no real website" — shop is reachable only via socials,
// still qualifies as a pitch target.
export const SOCIAL_AS_WEBSITE_DOMAINS = [
  'facebook.com',
  'fb.com',
  'fb.me',
  'instagram.com',
  'instagr.am',
  'linktr.ee',
  'linktree.com',
  'yelp.com',
  'yelp.to',
];

// Lowercase, trim, collapse whitespace, strip ", usa" suffix. Used as the
// dedupe key so "Brooklyn, NY" and "brooklyn ny" resolve to the same city.
export function canonicalizeCity(input: string): string {
  return input
    .toLowerCase()
    .replace(/,?\s*usa\s*$/i, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*,\s*/g, ', ')
    .trim();
}
