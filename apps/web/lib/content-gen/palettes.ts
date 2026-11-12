import type { ThemeStyle } from '@dfy/db';

// ============================================================================
// Curated palette presets — one-click "I don't love this color" fix.
// 3 presets per style, hand-picked to look intentional. The first preset is
// the canonical default for that style; the others are valid alternates.
// ============================================================================

export type PalettePreset = {
  id: string;
  label: string;
  primary: string;
  background: string;
  text: string;
  accent: string;
};

export const PALETTE_PRESETS: Record<ThemeStyle, PalettePreset[]> = {
  editorial: [
    { id: 'editorial-cream-brass',
      label: 'Cream / Brass',
      background: '#faf6ef', primary: '#2d2a26', text: '#1a1612', accent: '#b8935a' },
    { id: 'editorial-cream-sage',
      label: 'Cream / Sage',
      background: '#faf6ef', primary: '#2d2a26', text: '#1a1612', accent: '#9bb19a' },
    { id: 'editorial-cream-terracotta',
      label: 'Cream / Terracotta',
      background: '#f5ebe0', primary: '#2d2a26', text: '#1a1612', accent: '#c97c5d' },
  ],
  luxe: [
    { id: 'luxe-cream-blush',
      label: 'Cream / Blush',
      background: '#faf3ed', primary: '#a8907a', text: '#1a1612', accent: '#d4a5a0' },
    { id: 'luxe-cream-champagne',
      label: 'Cream / Champagne',
      background: '#faf6f0', primary: '#a8907a', text: '#1a1612', accent: '#c9a96e' },
    { id: 'luxe-blush-mauve',
      label: 'Blush / Mauve',
      background: '#f7eee8', primary: '#a8868a', text: '#2a221c', accent: '#c89898' },
    // Aesop-esque — refined herb-green on warm pearl. Med-spa friendly.
    { id: 'luxe-pearl-jade',
      label: 'Pearl / Jade',
      background: '#f7f4ed', primary: '#b09a85', text: '#1f1814', accent: '#7d9b88' },
    // Modern boutique — dusty lilac is unusual but reads luxe, not dated.
    { id: 'luxe-cream-lilac',
      label: 'Cream / Lilac',
      background: '#faf6f0', primary: '#a89a8b', text: '#1a1612', accent: '#b8a4c4' },
    // Editorial luxe — dusty plum reads as quiet, elevated, lash-bar-ish.
    { id: 'luxe-pearl-plum',
      label: 'Pearl / Plum',
      background: '#faf3ed', primary: '#998475', text: '#2a221c', accent: '#6b4e58' },
  ],
  'premium-dark': [
    { id: 'pd-ink-brass',
      label: 'Ink / Brass',
      background: '#0e0d0c', primary: '#1c1a17', text: '#f4ede0', accent: '#b8935a' },
    { id: 'pd-ink-oxblood',
      label: 'Ink / Oxblood',
      background: '#0e0d0c', primary: '#1c1a17', text: '#f4ede0', accent: '#7a1f1f' },
    { id: 'pd-ink-electric',
      label: 'Ink / Electric Blue',
      background: '#0a0a0a', primary: '#1e1e1e', text: '#fafafa', accent: '#2563eb' },
    // Murdock London / Frank's-style — heritage-shop with a deep forest accent.
    { id: 'pd-ink-forest',
      label: 'Ink / Forest',
      background: '#0e0d0c', primary: '#1c1a17', text: '#f4ede0', accent: '#4a6b50' },
    // Warmer than brass — copper reads rosy/aged-metal under cream.
    { id: 'pd-charcoal-copper',
      label: 'Charcoal / Copper',
      background: '#14110e', primary: '#1f1c19', text: '#f0e8da', accent: '#b87333' },
    // Cool slate dark with a dusty sage accent — quieter than the warm options.
    { id: 'pd-midnight-sage',
      label: 'Midnight / Sage',
      background: '#0a0e10', primary: '#181c1f', text: '#ebe5d7', accent: '#8aa39a' },
  ],
  bold: [
    { id: 'bold-navy-orange',
      label: 'Navy / Orange',
      background: '#fafaf5', primary: '#0f1f3d', text: '#0f1a0c', accent: '#ea580c' },
    { id: 'bold-cream-rust',
      label: 'Cream / Rust',
      background: '#fafaf5', primary: '#1f2937', text: '#1a1a1a', accent: '#b45309' },
    { id: 'bold-forest-amber',
      label: 'Forest / Amber',
      background: '#fafaf5', primary: '#15803d', text: '#0f1a0c', accent: '#f59e0b' },
  ],
  minimal: [
    { id: 'min-cream-sage',
      label: 'Cream / Sage',
      background: '#fafaf5', primary: '#3a3a3a', text: '#1a1a1a', accent: '#8fa89a' },
    { id: 'min-cream-navy',
      label: 'Cream / Navy',
      background: '#fafaf5', primary: '#475569', text: '#1a1a1a', accent: '#1a2f4a' },
    { id: 'min-cream-rust',
      label: 'Cream / Rust',
      background: '#f7f4ed', primary: '#3a3a3a', text: '#1a1a1a', accent: '#b45309' },
  ],
  'service-tech': [
    { id: 'st-cream-blue',
      label: 'Cream / Blue',
      background: '#fafafa', primary: '#0f172a', text: '#0a1628', accent: '#2563eb' },
    { id: 'st-cream-teal',
      label: 'Cream / Teal',
      background: '#f7f9fb', primary: '#1f2937', text: '#0a1628', accent: '#0891b2' },
    { id: 'st-navy-electric',
      label: 'Navy / Electric',
      background: '#0f172a', primary: '#0a1628', text: '#fafafa', accent: '#3b82f6' },
  ],
  'flagship-atelier': [
    { id: 'atelier-bone-ink',
      label: 'Bone / Ink',
      background: '#f3ede2', primary: '#1c1a17', text: '#14110e', accent: '#1c1a17' },
    { id: 'atelier-cream-oxblood',
      label: 'Cream / Oxblood',
      background: '#f6f0e6', primary: '#2a221c', text: '#1a1612', accent: '#7a1f1f' },
    { id: 'atelier-bone-brass',
      label: 'Bone / Brass',
      background: '#efe8db', primary: '#2d2a26', text: '#14110e', accent: '#a07a3a' },
    // Editorial-forest — Le Labo / apothecary energy. Deep moss accent.
    { id: 'atelier-linen-forest',
      label: 'Linen / Forest',
      background: '#f0e9dc', primary: '#2d2a26', text: '#14110e', accent: '#2d4a3a' },
    // Cobalt as accent reads museum/gallery — strong, unusual, not corporate.
    { id: 'atelier-cream-cobalt',
      label: 'Cream / Cobalt',
      background: '#f6f0e6', primary: '#2a221c', text: '#1a1612', accent: '#1e3a8a' },
    // Quietest of the set — sand bg + plum accent reads as gallery wall text.
    { id: 'atelier-sand-plum',
      label: 'Sand / Plum',
      background: '#ede5d6', primary: '#2d2a26', text: '#14110e', accent: '#6b4e58' },
  ],

  // ── Restaurant palettes ────────────────────────────────────────────────────
  // Trattoria: warm cream base, terracotta or oxblood lead, olive/mustard
  // accents. Reference: Lilia, Misi, Via Carota.
  'restaurant-trattoria': [
    { id: 'trattoria-cream-terracotta',
      label: 'Cream / Terracotta',
      background: '#f4ede0', primary: '#c44e34', text: '#1a1612', accent: '#2c4a2c' },
    { id: 'trattoria-cream-oxblood',
      label: 'Cream / Oxblood',
      background: '#f1ead8', primary: '#7a1f1f', text: '#1f1a14', accent: '#caa84d' },
    { id: 'trattoria-bone-olive',
      label: 'Bone / Olive',
      background: '#efe7d3', primary: '#2c4a2c', text: '#1a1612', accent: '#c44e34' },
  ],
  // Modern bistro / cocktail bar: dark base, single saturated accent.
  // Reference: Atomix, Crown Shy, Eleven Madison Park.
  'restaurant-modern': [
    { id: 'modern-noir-brass',
      label: 'Noir / Brass',
      background: '#14130f', primary: '#1f1c19', text: '#ede8df', accent: '#b88e3a' },
    { id: 'modern-oxblood',
      label: 'Oxblood / Cream',
      background: '#0e0d0c', primary: '#6b1a1a', text: '#f0ece4', accent: '#b88e3a' },
    { id: 'modern-emerald',
      label: 'Emerald / Cream',
      background: '#0a0a0a', primary: '#1a3d2e', text: '#f0ece4', accent: '#c9a96e' },
    // Garnet pop on near-black; trendy cocktail-bar energy.
    { id: 'modern-noir-garnet',
      label: 'Noir / Garnet',
      background: '#0a0a0a', primary: '#181818', text: '#ede8df', accent: '#9c1f2c' },
    // Saturated teal accent reads cinematic/editorial against ink.
    { id: 'modern-noir-teal',
      label: 'Noir / Electric Teal',
      background: '#0a0a0a', primary: '#181818', text: '#f0ece4', accent: '#1aa1a1' },
  ],
  // Cafe / brunch / bakery: airy cream + warm earth accent.
  // Reference: Sqirl, Friends & Family, Kettlehead.
  'restaurant-cafe': [
    { id: 'cafe-cream-sage',
      label: 'Cream / Sage',
      background: '#f7f1e3', primary: '#8a9a76', text: '#2a2520', accent: '#e6a684' },
    { id: 'cafe-cream-peach',
      label: 'Cream / Peach',
      background: '#faf6ee', primary: '#c98679', text: '#202020', accent: '#7a9381' },
    { id: 'cafe-bone-mustard',
      label: 'Bone / Mustard',
      background: '#f3ecdb', primary: '#caa84d', text: '#1f1a14', accent: '#7a9381' },
  ],
  // Omakase / minimalist Japanese / fine-dining tasting menu:
  // extreme whitespace, single brushstroke accent. Reference: Atomix,
  // Atelier Crenn, Sushi Nakazawa.
  'restaurant-omakase': [
    { id: 'omakase-paper-ink',
      label: 'Paper / Ink',
      background: '#f0ece4', primary: '#0d0d0d', text: '#000000', accent: '#b8312e' },
    { id: 'omakase-ink-gold',
      label: 'Ink / Gold Leaf',
      background: '#0a0a0a', primary: '#181818', text: '#e8e2d4', accent: '#a98a4f' },
    // Sumi-e: paper bg with a single muted gold accent — quiet, ritualistic.
    { id: 'omakase-paper-gold',
      label: 'Paper / Gold',
      background: '#f2ede1', primary: '#0d0d0d', text: '#000000', accent: '#a98a4f' },
  ],
  // Fast-casual / counter-service — smash burger, wings, bowls. High-contrast
  // cream-or-ink base + ONE signal accent. Bold sans typography upstream.
  'restaurant-counter': [
    { id: 'counter-cream-tomato',
      label: 'Cream / Tomato',
      background: '#fafaf5', primary: '#1f1c19', text: '#1a1612', accent: '#dc2626' },
    { id: 'counter-cream-yellow',
      label: 'Cream / Signal Yellow',
      background: '#f7f4ed', primary: '#1f1c19', text: '#1a1612', accent: '#f59e0b' },
    { id: 'counter-ink-yellow',
      label: 'Ink / Signal Yellow',
      background: '#0e0d0c', primary: '#181818', text: '#f0ece4', accent: '#f59e0b' },
    { id: 'counter-ink-tomato',
      label: 'Ink / Tomato',
      background: '#14110e', primary: '#1f1c19', text: '#f0ece4', accent: '#dc2626' },
    { id: 'counter-cream-green',
      label: 'Cream / Kelly Green',
      background: '#fafaf5', primary: '#1f1c19', text: '#1a1612', accent: '#16a34a' },
  ],

  // ── Personality palettes ───────────────────────────────────────────────────
  // playful-pop: vibrant 2-color combos. The accent is allowed to be loud
  // (hot pink / coral / sunshine) because the typographic signature carries
  // the playfulness — a quiet palette would fight the chunky display heading.
  'playful-pop': [
    { id: 'pop-cream-pink',
      label: 'Cream / Hot Pink',
      background: '#fff7ed', primary: '#1a1a1a', text: '#1a1a1a', accent: '#ec4899' },
    { id: 'pop-mint-coral',
      label: 'Mint / Coral',
      background: '#ecfdf5', primary: '#0c4a3e', text: '#0c4a3e', accent: '#fb7185' },
    { id: 'pop-sunshine-blue',
      label: 'Sunshine / Sky Blue',
      background: '#fef9c3', primary: '#1e3a8a', text: '#1e3a8a', accent: '#0ea5e9' },
    { id: 'pop-cream-lavender',
      label: 'Cream / Lavender',
      background: '#fff7ed', primary: '#1a1a1a', text: '#1a1a1a', accent: '#a855f7' },
  ],
  // brutalist: stark monochrome + ONE electric. Concrete (off-white) or ink
  // base, no warmth. Accent is jarring on purpose — the design grammar wants
  // the eye to flinch at first read.
  brutalist: [
    { id: 'brut-concrete-magenta',
      label: 'Concrete / Magenta',
      background: '#f5f5f5', primary: '#0a0a0a', text: '#0a0a0a', accent: '#ec4899' },
    { id: 'brut-concrete-volt',
      label: 'Concrete / Volt',
      background: '#fafafa', primary: '#0a0a0a', text: '#0a0a0a', accent: '#facc15' },
    { id: 'brut-ink-cyan',
      label: 'Ink / Cyan',
      background: '#0a0a0a', primary: '#1a1a1a', text: '#fafafa', accent: '#22d3ee' },
    { id: 'brut-ink-magenta',
      label: 'Ink / Magenta',
      background: '#0a0a0a', primary: '#1a1a1a', text: '#fafafa', accent: '#ec4899' },
  ],
  // art-deco: gilded, occasion-restaurant, jewelry-box. Gold (or warm brass)
  // is the through-line; bg / primary set the mood (onyx, ivory, emerald,
  // burgundy). Avoid pastel — deco wants saturation.
  'art-deco': [
    { id: 'deco-onyx-gold',
      label: 'Onyx / Gold',
      background: '#0a0a0a', primary: '#1c1818', text: '#ede4c8', accent: '#c8a04a' },
    { id: 'deco-ivory-emerald',
      label: 'Ivory / Emerald',
      background: '#f8f4e9', primary: '#0c4a3e', text: '#1a1a1a', accent: '#c8a04a' },
    { id: 'deco-burgundy-cream',
      label: 'Burgundy / Cream',
      background: '#f8f4e9', primary: '#5d1f1f', text: '#1a1a1a', accent: '#c8a04a' },
    { id: 'deco-onyx-rose',
      label: 'Onyx / Rose Gold',
      background: '#0e0d0c', primary: '#1c1818', text: '#f0e7d8', accent: '#b88e7a' },
  ],
  // ── Trades palettes ────────────────────────────────────────────────────────
  // Two complementary families. trades-classic = high-trust slate + warm
  // signal accent (the GAF/contractor reference template). trades-bold =
  // near-black base + brighter accent — sits closer to solar / pest / siding
  // territory where conversion energy outweighs warmth.
  'trades-classic': [
    { id: 'trades-slate-orange',
      label: 'Slate / Orange',
      background: '#ffffff', primary: '#0f172a', text: '#0f172a', accent: '#ea580c' },
    { id: 'trades-slate-blue',
      label: 'Slate / Steel Blue',
      background: '#ffffff', primary: '#0f172a', text: '#0f172a', accent: '#1e40af' },
    { id: 'trades-slate-red',
      label: 'Slate / Brick Red',
      background: '#ffffff', primary: '#1e293b', text: '#0f172a', accent: '#b91c1c' },
    { id: 'trades-slate-green',
      label: 'Slate / Forest',
      background: '#ffffff', primary: '#1e293b', text: '#0f172a', accent: '#15803d' },
  ],
  'trades-bold': [
    { id: 'trades-onyx-amber',
      label: 'Onyx / Amber',
      background: '#fafafa', primary: '#0a0a0a', text: '#0a0a0a', accent: '#f59e0b' },
    { id: 'trades-onyx-electric',
      label: 'Onyx / Electric',
      background: '#fafafa', primary: '#0a0a0a', text: '#0a0a0a', accent: '#2563eb' },
    { id: 'trades-onyx-volt',
      label: 'Onyx / Volt',
      background: '#0a0a0a', primary: '#171717', text: '#fafafa', accent: '#84cc16' },
  ],

  // retro-90s: arcade neon-on-black or vapor pastel. Use sparingly — strong
  // vibe. The synthwave option is the canonical default.
  'retro-90s': [
    { id: 'retro-synthwave',
      label: 'Synthwave',
      background: '#1a0d2e', primary: '#2a1a4a', text: '#f0e7ff', accent: '#ec4899' },
    { id: 'retro-vapor-teal',
      label: 'Vapor / Teal',
      background: '#0e1a2a', primary: '#1a3a4a', text: '#a4f0d0', accent: '#fb7185' },
    { id: 'retro-neon-volt',
      label: 'Neon / Volt',
      background: '#0a0a0a', primary: '#1a1a1a', text: '#fafafa', accent: '#facc15' },
    { id: 'retro-geocities',
      label: 'Geocities',
      background: '#fef3c7', primary: '#7c2d12', text: '#171717', accent: '#16a34a' },
  ],
};
