import type { ThemeStyle } from '@dfy/db';

// ============================================================================
// Composition catalog
//
// Each section can render multiple bespoke compositions. The picker below
// chooses one per section based on the site's style + signals (photo count,
// orientations, content density, business id hash) — deterministic and
// server-side, so no LLM tokens are spent on layout selection.
//
// Adding a new composition: register it here AND add the matching React
// component in components/template/sections/<Section>/compositions/.
// ============================================================================

export type HeroComposition =
  | 'image-fullbleed'    // legacy: full-bleed photo + bottom-anchored text
  | 'minimal-center'     // legacy: typography-led, no/small photo, centered
  | 'magazine'           // 2-col: oversized serif headline left, photo right
  | 'display'            // typography-led, oversized display, optional small photo
  | 'bold-stripe'        // full-bleed photo + accent stripe + big sans
  | 'tech-bar'           // clean photo + horizontal stat band below
  | 'editorial-portrait' // flagship-atelier: split-screen full-bleed portrait + numbered eyebrow + oversized italic-serif headline
  | 'lead-form-split';   // trades: dark slate hero, copy + dual CTAs left, inline lead-capture form right (LeadForm component)

export type ServicesComposition =
  | 'list'               // legacy: divided rows with prices
  | 'grid'               // legacy: cards in 1/2/3 col grid
  | 'menu-card'          // restaurant menu with dotted leaders
  | 'tier-cards'         // 3/4-up cards with hero price + inclusions
  | 'numbered'           // editorial numbered list 01/02/03
  | 'large-cards'        // 2-up roomy cards with accent rule + price callout
  | 'split-card'         // full-width cards w/ content panel + accent price panel
  | 'stacked-cards'      // vertical full-width portfolio-style cards
  | 'printed-menu'       // flagship-atelier: numbered, dotted leaders, italic descriptions, two-column on desktop
  | 'icon-cards';        // trades: hover-lifting cards with a colored icon square at the top of each (Lucide icon, brand-accent surface, hover restores to brand fill)

export type AboutComposition =
  | 'text'               // legacy: text-only, narrow column
  | 'text_image';        // legacy: 2-col text + photo

export type GalleryComposition =
  | 'masonry'            // legacy
  | 'grid'               // legacy
  | 'film-strip'         // flagship-tier: horizontal scroll-snap, portrait cards
  | 'off';

// Menu compositions — restaurant-only. Salon clients never render this section.
export type MenuComposition =
  | 'printed-menu-categorized'  // dotted leaders, italic descriptions, two-column desktop; small thumbnail prepended when item has a photo
  | 'modern-stacked'             // clean single-column stack, no dotted leaders, small thumbnail to the left
  | 'photo-grid-menu'            // Uber-Eats-style cards: image + name + price + description, two-up grid
  // Compact / category-filter compositions — only one category visible at a
  // time, ideal for menus >40 items where stacking everything bloats the page.
  | 'tabbed-menu'                // sticky category tabs at top, single category renders below
  | 'accordion-menu'             // collapsible categories, first expanded; mobile-first
  | 'sidebar-nav'                // left rail with category names, right pane shows selected category
  // Aesthetic alternates — full menu rendered, but visually distinct.
  | 'chalkboard'                 // chalk-textured dark surface, hand-script category headers
  | 'magazine-spread';           // editorial: alternating featured-photo + tight typeset list per category

export type SectionCompositions = {
  hero: HeroComposition;
  services: ServicesComposition;
  about: AboutComposition;
  gallery: GalleryComposition;
  // Restaurant clients populate `menu`; salon clients leave it undefined and
  // render `services` instead. The two are mutually exclusive at section level
  // but both live on the same picker output to keep the picker contract small.
  menu?: MenuComposition;
};

// Which hero compositions are valid for each style.  Order = priority; the
// picker chooses the first one whose photo/content preconditions are met.
const HERO_VALID_BY_STYLE: Record<ThemeStyle, HeroComposition[]> = {
  editorial:     ['magazine', 'display', 'minimal-center'],
  luxe:          ['magazine', 'minimal-center', 'display'],
  'premium-dark': ['image-fullbleed', 'bold-stripe', 'display'],
  bold:          ['bold-stripe', 'image-fullbleed', 'tech-bar'],
  minimal:       ['minimal-center', 'display', 'magazine'],
  'service-tech': ['tech-bar', 'image-fullbleed', 'display'],
  // Flagship: editorial-portrait is the signature; magazine is the graceful
  // degrade when the portrait precondition fails (see heroFitsSignals).
  'flagship-atelier': ['editorial-portrait', 'magazine', 'display'],
  // Restaurant heroes lean food-photo-led for trattoria/cafe/modern;
  // omakase is typography-led with single-image accent.
  'restaurant-trattoria': ['magazine', 'image-fullbleed', 'display'],
  'restaurant-modern':    ['image-fullbleed', 'bold-stripe', 'display'],
  'restaurant-cafe':      ['magazine', 'image-fullbleed', 'minimal-center'],
  'restaurant-omakase':   ['minimal-center', 'display', 'magazine'],
  // Counter / fast-casual leans on a strong food shot + bold-stripe energy.
  'restaurant-counter':   ['bold-stripe', 'image-fullbleed', 'tech-bar', 'display'],
  // Trades — lead-form-split is the signature; the other photo-led options are
  // graceful degrades when an admin manually swaps composition via the editor.
  'trades-classic':       ['lead-form-split', 'image-fullbleed', 'bold-stripe', 'display'],
  'trades-bold':          ['lead-form-split', 'bold-stripe', 'image-fullbleed', 'display'],
  // Personality styles — each leans on its typographic signature, so display
  // (typography-led) is the natural default. Photo-led options stay valid
  // alternates when the client has strong photography.
  'playful-pop':          ['display', 'magazine', 'minimal-center'],
  brutalist:              ['display', 'minimal-center', 'bold-stripe'],
  'art-deco':             ['magazine', 'display', 'minimal-center'],
  'retro-90s':            ['display', 'bold-stripe', 'minimal-center'],
};

// Which Services compositions are valid for each style.
// `menu-card`     — printed-menu feel, fits editorial / luxe / minimal.
// `tier-cards`    — packaged offerings, fits service-tech / bold / premium-dark.
// `numbered`      — editorial sequence, fits editorial / luxe / minimal.
// `large-cards`   — premium roomy cards, broadly applicable.
// `split-card`    — magazine spread, fits editorial / luxe / service-tech.
// `stacked-cards` — portfolio energy, fits bold / premium-dark / minimal.
const SERVICES_VALID_BY_STYLE: Record<ThemeStyle, ServicesComposition[]> = {
  editorial:     ['menu-card', 'numbered', 'large-cards', 'split-card', 'list'],
  luxe:          ['menu-card', 'split-card', 'large-cards', 'list', 'numbered'],
  'premium-dark': ['large-cards', 'tier-cards', 'stacked-cards', 'list', 'grid'],
  bold:          ['tier-cards', 'stacked-cards', 'large-cards', 'grid', 'list'],
  minimal:       ['large-cards', 'list', 'numbered', 'stacked-cards', 'menu-card'],
  'service-tech': ['tier-cards', 'large-cards', 'split-card', 'grid', 'list'],
  'flagship-atelier': ['printed-menu', 'menu-card', 'numbered', 'split-card'],
  // Restaurant clients render the Menu section, not Services. These entries
  // exist for type exhaustiveness; pickCompositions branches on vertical and
  // never reads them for a restaurant client. If a salon-style client somehow
  // lands on a restaurant style, fall back to safe printed-menu/list.
  'restaurant-trattoria': ['printed-menu', 'menu-card', 'list'],
  'restaurant-modern':    ['printed-menu', 'menu-card', 'large-cards', 'list'],
  'restaurant-cafe':      ['printed-menu', 'menu-card', 'list'],
  'restaurant-omakase':   ['printed-menu', 'numbered', 'list'],
  'restaurant-counter':   ['tier-cards', 'grid', 'large-cards', 'list'],
  // Trades — icon-cards is the signature (orange-square Lucide icon on each
  // card, hover lift). Grid + tier-cards are graceful degrades.
  'trades-classic':       ['icon-cards', 'grid', 'tier-cards', 'large-cards', 'list'],
  'trades-bold':          ['icon-cards', 'tier-cards', 'grid', 'large-cards', 'list'],
  // Personality styles. Pick services compositions that match the type
  // signature: chunky display → tier/large cards; condensed display → numbered;
  // deco serif → menu-card / numbered; arcade display → tier cards.
  'playful-pop':          ['large-cards', 'tier-cards', 'grid', 'list'],
  brutalist:              ['numbered', 'list', 'large-cards', 'stacked-cards'],
  'art-deco':             ['menu-card', 'numbered', 'split-card', 'list'],
  'retro-90s':            ['tier-cards', 'large-cards', 'grid', 'list'],
};

// Which Menu compositions are valid for each restaurant style. Order =
// priority; the picker chooses the first eligible option, but admins can
// override via the editor's Menu composition dropdown. All styles can opt
// into photo-grid-menu — the toggle is in the editor, not the picker.
const MENU_VALID_BY_STYLE: Partial<Record<ThemeStyle, MenuComposition[]>> = {
  // Order matters for the picker — first eligible wins. The compact options
  // (tabbed/accordion/sidebar-nav) sit lower so the "default" picks for a
  // small-menu restaurant stay visually rich; admins can promote them via the
  // editor when their menu grows past ~40 items.
  'restaurant-trattoria': [
    'printed-menu-categorized', 'modern-stacked', 'photo-grid-menu',
    'magazine-spread', 'sidebar-nav', 'tabbed-menu', 'accordion-menu',
  ],
  'restaurant-modern':    [
    'photo-grid-menu', 'modern-stacked', 'printed-menu-categorized',
    'magazine-spread', 'sidebar-nav', 'tabbed-menu', 'accordion-menu',
  ],
  'restaurant-cafe':      [
    'photo-grid-menu', 'modern-stacked', 'printed-menu-categorized',
    'magazine-spread', 'sidebar-nav', 'tabbed-menu', 'accordion-menu',
    'chalkboard',
  ],
  // Omakase keeps it minimal — chalkboard / magazine-spread feel wrong here.
  'restaurant-omakase':   [
    'printed-menu-categorized', 'modern-stacked', 'photo-grid-menu',
    'sidebar-nav', 'tabbed-menu', 'accordion-menu',
  ],
  // Counter shops: photo-led + chalkboard + the compact options. Chalkboard
  // is signature counter / smash-burger / counter-cafe energy.
  'restaurant-counter':   [
    'photo-grid-menu', 'modern-stacked', 'printed-menu-categorized',
    'chalkboard', 'magazine-spread', 'tabbed-menu', 'accordion-menu',
    'sidebar-nav',
  ],
};

// Which Gallery compositions are valid for each style. Order = priority used
// by the picker; first entry that fits the signals wins.
//   `film-strip` — horizontal contact-sheet feel; flagship signature.
//   `masonry`    — long-form photo wall (mixed orientations).
//   `grid`       — uniform tile grid (square crop).
//   `off`        — suppressed (used when photoCount is too small).
const GALLERY_VALID_BY_STYLE: Record<ThemeStyle, GalleryComposition[]> = {
  editorial:     ['masonry', 'film-strip', 'grid'],
  luxe:          ['masonry', 'film-strip', 'grid'],
  'premium-dark': ['masonry', 'grid', 'film-strip'],
  bold:          ['grid', 'masonry', 'film-strip'],
  minimal:       ['masonry', 'grid', 'film-strip'],
  'service-tech': ['grid', 'masonry'],
  'flagship-atelier': ['film-strip', 'masonry', 'grid'],
  // Food photography reads best in mixed-orientation masonry or
  // contact-sheet film-strip; uniform grid is a fallback.
  'restaurant-trattoria': ['masonry', 'grid', 'film-strip'],
  'restaurant-modern':    ['film-strip', 'masonry', 'grid'],
  'restaurant-cafe':      ['masonry', 'grid', 'film-strip'],
  'restaurant-omakase':   ['film-strip', 'masonry', 'grid'],
  'restaurant-counter':   ['grid', 'masonry', 'film-strip'],
  // Trades — galleries optional; when present they're before/after or
  // completed-project photos, best in a uniform grid.
  'trades-classic':       ['grid', 'masonry'],
  'trades-bold':          ['grid', 'masonry'],
  'playful-pop':          ['grid', 'masonry', 'film-strip'],
  brutalist:              ['grid', 'film-strip', 'masonry'],
  'art-deco':             ['masonry', 'film-strip', 'grid'],
  'retro-90s':            ['grid', 'film-strip', 'masonry'],
};

// Photo / content signals the picker uses.
export type PickerSignals = {
  photoCount: number;
  hasLandscape: boolean;     // any photo with width >= height
  hasPortrait: boolean;      // any photo with height > width
  headlineWords: number;
  serviceCount: number;
  hash: number;              // stable 32-bit hash of business id
};

// Hero preconditions — return false to skip this composition for these signals.
function heroFitsSignals(
  comp: HeroComposition,
  s: PickerSignals,
): boolean {
  switch (comp) {
    case 'magazine':
      // Needs at least one photo for the right column.
      return s.photoCount >= 1;
    case 'image-fullbleed':
      // Any photo works — CSS object-fit covers portrait shots into the
      // landscape hero frame. Google Places often returns portrait-only
      // photos for local businesses (patron phone uploads), and we still
      // want image-fullbleed as the default in that case.
      return s.photoCount >= 1;
    case 'bold-stripe':
    case 'tech-bar':
      // Stripe + stat band layouts assume a wide photo; portrait crops
      // badly under the overlay.
      return s.photoCount >= 1 && s.hasLandscape;
    case 'editorial-portrait':
      // Flagship hero is portrait-led; we want a vertical-leaning shot to
      // anchor the split-screen. Without it, the layout looks broken.
      return s.photoCount >= 1 && s.hasPortrait;
    case 'display':
    case 'minimal-center':
      // Typography-led — never fail.
      return true;
    case 'lead-form-split':
      // The form is always available; the optional background photo is
      // handled by the LeadHero component (falls back to a slate gradient).
      return true;
  }
}

// Gallery preconditions — minimum photo bar per layout.
function galleryFitsSignals(comp: GalleryComposition, s: PickerSignals): boolean {
  switch (comp) {
    case 'film-strip':
      // Horizontal scroll-snap needs enough cards to feel like a strip.
      return s.photoCount >= 4;
    case 'masonry':
      return s.photoCount >= 5;
    case 'grid':
      return s.photoCount >= 2;
    case 'off':
      return true;
  }
}

// Flagship styles set a higher minimum bar for usable signals. When a site
// doesn't meet it, we degrade to a non-flagship style rather than render a
// hollow flagship layout.  Returns the style to actually pick from.
const FLAGSHIP_PHOTO_MIN = 4;

function effectiveStyle(style: ThemeStyle, signals: PickerSignals): ThemeStyle {
  if (style === 'flagship-atelier') {
    if (signals.photoCount < FLAGSHIP_PHOTO_MIN || !signals.hasPortrait) {
      return 'editorial';
    }
  }
  return style;
}

// Cheap, stable string hash → uint32. Same input → same output forever, which
// is the property we want for "this business always picks composition X."
export function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function pickCompositions(
  style: ThemeStyle,
  signals: PickerSignals,
): SectionCompositions {
  // Flagship styles degrade their composition pool to a non-flagship style
  // when signals don't meet flagship's bar — palette/fonts still render as
  // flagship, but compositions stay safe.
  const pickStyle = effectiveStyle(style, signals);

  const heroCandidates = HERO_VALID_BY_STYLE[pickStyle];
  const heroEligible = heroCandidates.filter((c) => heroFitsSignals(c, signals));
  // If nothing fits (e.g., zero photos with a photo-required style), fall
  // through to the typography-led options that always work.
  const heroPool = heroEligible.length > 0 ? heroEligible : ['display', 'minimal-center'] as HeroComposition[];
  // Trades styles ALWAYS lead with the inline lead form — the form IS the
  // conversion event for this vertical, and a photo-only hero would bury it.
  // Admins can switch to image-fullbleed via the editor composition dropdown.
  // For non-trades styles, default to image-fullbleed when signals support it
  // (≥1 photo) — photo-led heroes convert better in this market. Falls
  // through to the style-curated hash pick when signals don't allow it
  // (typography-led styles with no photos).
  let hero: HeroComposition;
  if (isTradesStyle(pickStyle)) {
    hero = 'lead-form-split';
  } else if (heroFitsSignals('image-fullbleed', signals)) {
    hero = 'image-fullbleed';
  } else {
    hero = heroPool[signals.hash % heroPool.length] as HeroComposition;
  }

  // Services: pick the first style-appropriate composition that fits the
  // service count. tier-cards needs <=4 services; everything else handles
  // any count.
  const servicesPool = SERVICES_VALID_BY_STYLE[pickStyle].filter((c) =>
    c === 'tier-cards' ? signals.serviceCount <= 4 : true,
  );
  const services: ServicesComposition =
    servicesPool[signals.hash % servicesPool.length] ??
    SERVICES_VALID_BY_STYLE[pickStyle][0] ??
    'list';

  // About: text+image when we have photos, text-only otherwise.
  const about: AboutComposition = signals.photoCount >= 2 ? 'text_image' : 'text';

  // Gallery: walk the per-style allow-list, take the first composition whose
  // photo bar is met. Falls back to 'off' so a sparse site doesn't render an
  // empty gallery.
  const galleryPool = GALLERY_VALID_BY_STYLE[pickStyle].filter((c) =>
    galleryFitsSignals(c, signals),
  );
  const gallery: GalleryComposition = galleryPool[0] ?? 'off';

  // Menu: only restaurant styles populate this. Salons leave it undefined and
  // render `services` instead — the dispatcher in Site.tsx checks which is
  // present per section type. Restaurants default to accordion-menu — compact
  // and mobile-first; admins can swap via the editor's composition dropdown.
  const menuPool = MENU_VALID_BY_STYLE[pickStyle];
  const menu: MenuComposition | undefined = menuPool
    ? (menuPool.includes('accordion-menu') ? 'accordion-menu' : menuPool[0])
    : undefined;

  return { hero, services, about, gallery, menu };
}

// True when a style uses the restaurant template family. The route uses this
// to decide which sections to emit (menu / reservations / ordering vs
// services / booking) instead of carrying a separate vertical parameter
// through the composition layer.
export function isRestaurantStyle(style: ThemeStyle): boolean {
  return style.startsWith('restaurant-');
}

// True when a style uses the trades / contractor template family. The route
// uses this to emit the lead-gen section list (top_bar, lead hero, trust_bar,
// why_us, testimonials, cta_strip).
export function isTradesStyle(style: ThemeStyle): boolean {
  return style.startsWith('trades-');
}

// All hero compositions, in the order: this style's curated pool first
// (so [0] stays the style's signature pick on style-change), then everything
// else appended so admins can manually opt into a layout that isn't part of
// the style's default mix. The auto-picker still only draws from
// HERO_VALID_BY_STYLE — this widening is admin-only.
const ALL_HERO_COMPOSITIONS: HeroComposition[] = [
  'image-fullbleed',
  'minimal-center',
  'magazine',
  'display',
  'bold-stripe',
  'tech-bar',
  'editorial-portrait',
  'lead-form-split',
];

export function listValidHeroCompositions(style: ThemeStyle): HeroComposition[] {
  const pool = HERO_VALID_BY_STYLE[style];
  const extras = ALL_HERO_COMPOSITIONS.filter((c) => !pool.includes(c));
  return [...pool, ...extras];
}

export function listValidMenuCompositions(style: ThemeStyle): MenuComposition[] {
  return MENU_VALID_BY_STYLE[style] ?? [];
}

export function listValidServicesCompositions(style: ThemeStyle): ServicesComposition[] {
  return SERVICES_VALID_BY_STYLE[style];
}

export function listValidGalleryCompositions(style: ThemeStyle): GalleryComposition[] {
  return GALLERY_VALID_BY_STYLE[style];
}
