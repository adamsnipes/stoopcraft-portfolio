export type { Json, Database, Tables, TablesInsert, TablesUpdate } from './types';

import type { Json, Database } from './types';

// ── Row types ────────────────────────────────────────────────────────────────
export type ClientRow            = Database['public']['Tables']['clients']['Row'];
export type ContentRow           = Database['public']['Tables']['content']['Row'];
export type PhotoRow             = Database['public']['Tables']['photos']['Row'];
export type RequestRow           = Database['public']['Tables']['requests']['Row'];
export type EventRow             = Database['public']['Tables']['events']['Row'];
export type PosCredentialsRow    = Database['public']['Tables']['pos_credentials']['Row'];
export type SalesRepRow          = Database['public']['Tables']['sales_reps']['Row'];
export type CommissionLedgerRow  = Database['public']['Tables']['commission_ledger']['Row'];
export type PayoutRow            = Database['public']['Tables']['payouts']['Row'];
export type RepLeadRow           = Database['public']['Tables']['rep_leads']['Row'];
export type PostRow              = Database['public']['Tables']['posts']['Row'];

// ── Insert types ─────────────────────────────────────────────────────────────
export type ClientInsert            = Database['public']['Tables']['clients']['Insert'];
export type ContentInsert           = Database['public']['Tables']['content']['Insert'];
export type PhotoInsert             = Database['public']['Tables']['photos']['Insert'];
export type EventInsert             = Database['public']['Tables']['events']['Insert'];
export type PosCredentialsInsert    = Database['public']['Tables']['pos_credentials']['Insert'];
export type SalesRepInsert          = Database['public']['Tables']['sales_reps']['Insert'];
export type CommissionLedgerInsert  = Database['public']['Tables']['commission_ledger']['Insert'];
export type PayoutInsert            = Database['public']['Tables']['payouts']['Insert'];
export type RepLeadInsert           = Database['public']['Tables']['rep_leads']['Insert'];
export type PostInsert              = Database['public']['Tables']['posts']['Insert'];

// ── Update types ─────────────────────────────────────────────────────────────
export type ClientUpdate            = Database['public']['Tables']['clients']['Update'];
export type ContentUpdate           = Database['public']['Tables']['content']['Update'];
export type PosCredentialsUpdate    = Database['public']['Tables']['pos_credentials']['Update'];
export type SalesRepUpdate          = Database['public']['Tables']['sales_reps']['Update'];
export type RepLeadUpdate           = Database['public']['Tables']['rep_leads']['Update'];
export type PostUpdate              = Database['public']['Tables']['posts']['Update'];

// ── JSONB field shapes ───────────────────────────────────────────────────────
export type SectionConfig = {
  type:
    | 'hero'
    | 'services'
    | 'gallery'
    | 'about'
    | 'booking'
    | 'contact'
    // Dedicated "Follow us" CTA — high-prominence social block for portfolio-
    // driven service businesses (barbers, salons) where Instagram/TikTok IS
    // the work. Distinct from the muted footer icon row.
    | 'follow'
    // Restaurant-only section types. Existing rows never carry these, so
    // the salon path is unaffected.
    | 'menu'
    | 'reservations'
    | 'ordering'
    // Combined "Dine with us" block — replaces `ordering` + `reservations`
    // as a single two-column section. Admin toggle splits it back into two
    // separate sections (e.g. when embedding OpenTable warrants the room).
    | 'dine'
    | 'hours'
    | 'location'
    // Trades-vertical sections — only emitted on trades clients. Existing
    // salon/restaurant rows never carry these.
    //   top_bar       — utility strip above the nav (license + phone CTA)
    //   trust_bar     — manufacturer/certification badges strip
    //   why_us        — bento: feature list + photo + floating stat card
    //   testimonials  — 3-up review card grid
    //   cta_strip     — full-width color band with phone + estimate CTA
    | 'top_bar'
    | 'trust_bar'
    | 'why_us'
    | 'testimonials'
    | 'cta_strip';
  enabled: boolean;
  // Legacy: 'image' | 'minimal' | 'list' | 'grid' | 'masonry' | etc.
  // Kept for backwards compat — sites generated before the composition system
  // only have this. Templates dispatch on `composition` first, then fall back
  // to `variant`.
  variant: string;
  // New: bespoke composition name (e.g., 'magazine', 'display', 'tech-bar').
  // Optional — older content rows omit it and templates use `variant` instead.
  composition?: string;
};

export type ServiceItem = {
  name: string;
  description: string;
  price: string;
};

// Business vertical drives section selection, theme pool, and composition
// allow-lists. Persisted on `clients.business_vertical`. NULL = the original
// (beauty / appointment-based) template path runs unchanged.
// - 'restaurant': menu / reservations / ordering family
// - 'trades':     lead-gen family (top utility bar, hero with inline lead
//                 form, trust badges, why-us bento, testimonials, CTA strip).
//                 Used for HVAC / plumbing / roofing / electrician / etc.
export type BusinessVertical = 'restaurant' | 'trades';

// ── Restaurant menu shape ────────────────────────────────────────────────────
// Stored as content.menu (jsonb). Salons leave this null and use `services`
// instead — the two never coexist on the same content row.
export type MenuDietaryTag = 'gf' | 'vg' | 'v' | 'df' | 'spicy' | 'nf';

export type MenuItem = {
  id: string;
  // POS-side identifier (Square catalog object id, Toast item GUID, etc.).
  // Populated when a menu is synced from a POS; null for hand-entered items.
  external_id?: string;
  name: string;
  description: string;
  price: string;
  dietary?: MenuDietaryTag[];
  // FK into the photos table (photos.id), where photo.purpose === 'menu_item'.
  // Customer-uploaded image, served from R2.
  photo_id?: string;
  // External image URL (whitelisted hosts only — see lib/photos/url-whitelist).
  // Used when seeding from scraped data (e.g. Uber Eats CDN). The renderer
  // prefers photo_id when both are set.
  photo_url?: string;
  // True = managed by POS sync (cron will overwrite). False = customer has
  // hand-edited this item, sync must skip it. Null/undefined for hand-entered.
  is_synced?: boolean;
};

export type MenuCategory = {
  id: string;
  external_id?: string;
  title: string;
  description?: string;
  items: MenuItem[];
};

export type MenuConfig = {
  categories: MenuCategory[];
  // Section-level toggle. Default true (treat undefined as true). When false,
  // all menu compositions hide item images even if individual items have one.
  show_images?: boolean;
};

// ── Ordering links (delivery / takeout platforms) ────────────────────────────
// True iframe embedding doesn't work for these (X-Frame-Options: DENY), so we
// render them as branded link-out buttons. Stored as content.ordering_links.
export type OrderingPlatform =
  | 'doordash'
  | 'ubereats'
  | 'grubhub'
  | 'postmates'
  | 'chownow'
  | 'toast'
  | 'square'
  | 'direct';

export type OrderingLink = {
  platform: OrderingPlatform;
  url: string;
  // Optional override for 'direct' (the restaurant's own ordering page).
  label?: string;
};

// ── Social links ─────────────────────────────────────────────────────────────
// Footer-rendered social icons. Same shape as OrderingLink so the editor +
// parser stay symmetric. Empty url = placeholder seeded by the generator —
// the renderer skips those so the icon row hides until at least one is filled.
export type SocialPlatform =
  | 'facebook'
  | 'instagram'
  | 'tiktok'
  | 'youtube'
  | 'twitter'
  | 'linkedin';

export type SocialLink = {
  platform: SocialPlatform;
  url: string;
};

// ── Reservations ─────────────────────────────────────────────────────────────
// Mirrors BookingMethod's pattern. Each method has a real iframe widget
// available (OpenTable/Resy/Tock); 'phone' falls back to tel: link; 'walkin'
// renders a "no reservations needed" notice.
export type ReservationsMethod = 'opentable' | 'resy' | 'tock' | 'phone' | 'walkin';
export const RESERVATIONS_METHODS: readonly ReservationsMethod[] = [
  'opentable',
  'resy',
  'tock',
  'phone',
  'walkin',
];

// ── Photo purposes ───────────────────────────────────────────────────────────
// Photo limits scope per purpose: gallery is capped (display constraint),
// menu_item is per-item (one photo per menu item, soft cap on total),
// hero / logo are 1 each.
export type PhotoPurpose = 'gallery' | 'menu_item' | 'hero' | 'logo';

// ── POS providers ────────────────────────────────────────────────────────────
// v1 ships the columns + table empty; v2 wires Square first, then Toast.
export type PosProvider = 'square' | 'toast' | 'clover' | 'lightspeed';

export type ThemeStyle =
  | 'editorial'
  | 'luxe'
  | 'premium-dark'
  | 'bold'
  | 'minimal'
  | 'service-tech'
  | 'flagship-atelier'
  // Restaurant styles. Each ships with its own palette + font defaults and
  // its own composition allow-lists for hero / menu / gallery.
  | 'restaurant-trattoria'
  | 'restaurant-modern'
  | 'restaurant-cafe'
  | 'restaurant-omakase'
  // Fast-casual / counter-service — smash burger, wings, bowls, etc.
  // Bold high-contrast base + ONE signal accent. Sans-only typography.
  | 'restaurant-counter'
  // Trades styles — contractor / home-services family. High-trust, conversion-
  // led layout: dark utility bar, hero with inline lead form, badge strip,
  // bento why-us, review grid, color CTA band.
  //   trades-classic — slate base + warm orange accent (Summit Peak / GAF feel)
  //   trades-bold    — near-black base + electric accent (pest / solar / siding)
  | 'trades-classic'
  | 'trades-bold'
  // Personality styles. Admin-pickable alternates with distinctive
  // typographic signatures. No niche profile points here by default — these
  // are reach-for-when-the-default-is-too-quiet styles that admins promote
  // via the editor's style picker.
  | 'playful-pop'
  | 'brutalist'
  | 'art-deco'
  | 'retro-90s';

// Booking destination type. DB column is plain text + check constraint;
// this union is the canonical surface for app code.
export type BookingMethod = 'calendly' | 'booksy' | 'phone' | 'cuts';
export const BOOKING_METHODS: readonly BookingMethod[] = ['calendly', 'booksy', 'phone', 'cuts'];

// Optional decorative overlay layered on top of the solid background color.
// Composed into the `--color-background` CSS variable at render time, so
// every section that reads that variable picks up the treatment automatically
// — no per-section background changes required. When unset, the page renders
// against the solid hex color exactly as it did pre-treatment-feature.
export type BackgroundTreatment = 'mesh' | 'blobs' | 'dotgrid' | 'grain';

export type ThemeConfig = {
  primary: string;
  background: string;
  text: string;
  accent: string;
  fontHeading: string;
  fontBody: string;
  borderRadius: string;
  style: ThemeStyle;
  // Optional palette key from PALETTES (lib/theme/palettes.ts). When present,
  // the renderer reads colors from that preset; when absent, it falls back to
  // the explicit primary/background/text/accent fields. 'custom' = user
  // overrode via the palette picker.
  palette_preset?: string;
  // Optional decorative overlay layered atop the bg color. Off when undefined.
  background_treatment?: BackgroundTreatment;
  // Alternate background color applied to every other section. Defaults to
  // an auto-derived shade (~4% darker than `background`) when undefined and
  // `alt_bg_enabled` is on. Setting this lets admins override the auto shade.
  background_alt?: string;
  // Master switch for the alternating-section-bg effect. Treat undefined as
  // `true` (legacy rows opt in by default) — explicit false disables.
  alt_bg_enabled?: boolean;
};

export type HoursConfig = {
  [day: string]: { open: string; close: string } | null;
};
