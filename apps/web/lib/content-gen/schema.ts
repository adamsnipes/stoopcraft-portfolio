import { z } from 'zod';

// ============================================================================
// Schema Claude must conform to — validated before any content hits the DB
// ============================================================================

const ALLOWED_HEADING_FONTS = [
  'Playfair Display',
  'Fraunces',
  'Inter',
  'Merriweather',
  'Bebas Neue',
  'Poppins',
  'Cormorant Garamond',
  'Space Grotesk',
  // Personality fonts — mapped to specific ThemeStyles below. The LLM should
  // only pick these when the niche profile points at the matching style; admins
  // can override via the editor's style picker independently of generation.
  'Bowlby One',     // playful-pop heading: chunky display, friendly-pop energy
  'Anton',          // brutalist heading: condensed-bold, oversized
  'Italiana',       // art-deco heading: 1920s geometric serif
  'Audiowide',      // retro-90s heading: arcade / synthwave display
] as const;

const ALLOWED_BODY_FONTS = [
  'Inter',
  'Lora',
  'Open Sans',
  'Roboto',
  'DM Sans',
  'Nunito',         // playful-pop body: rounded, friendly humanist sans
  'Space Mono',     // brutalist + retro-90s body: monospaced
] as const;

const ALLOWED_STYLES = [
  'editorial',     // serif-led, italic accents, generous whitespace, cream+ink
  'luxe',          // boutique-feminine, soft palette, refined serif, slow tempo
  'premium-dark',  // dark base, ambient glow, warm metallic accent
  'bold',          // high-contrast, big type, energy + accent stripe
  'minimal',       // restrained, lots of whitespace, single accent
  'service-tech',  // app/platform feel, navy + electric, clean + trustworthy
  // Restaurant styles — only emitted when the niche profile is in the
  // restaurant vertical. The LLM is hinted to pick the right one via the
  // niche profile, and the route overrides server-side as a safety net.
  'restaurant-trattoria',
  'restaurant-modern',
  'restaurant-cafe',
  'restaurant-omakase',
  'restaurant-counter',
  // Trades styles — emitted by trade-niche profiles (roofer, hvac, plumber,
  // etc.). Route overrides theme.style server-side as a safety net so
  // accidentally-picked aesthetic styles get coerced to trades-classic.
  'trades-classic',
  'trades-bold',
  // Personality styles — admin-pickable alternates. Each ships with its own
  // typography signature + palette presets. No niche profile points here by
  // default; admins switch into them via the editor when a client wants more
  // flair than the niche default delivers.
  'playful-pop',     // joyful chunky display + rounded body, vibrant accents
  'brutalist',       // raw oversized condensed display + mono body, stark
  'art-deco',        // geometric 1920s serif + classic body, gilded palettes
  'retro-90s',       // arcade/synthwave display + mono body, neon accents
] as const;

export const generatedContentSchema = z.object({
  hero: z.object({
    headline: z.string().min(5).max(80),
    headline_emphasis: z.preprocess(
      (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
      z.string().min(2).max(30).optional(),
    ),
    subheadline: z.string().min(10).max(160),
    cta_text: z.string().min(2).max(20),
  }),
  about: z.object({
    title: z.string().min(3).max(60),
    body: z.string().min(50).max(800),
  }),
  services: z
    .array(
      z.object({
        name: z.string().min(2).max(50),
        description: z.string().max(200),
        // 40 fits tier pricing (e.g., "$50 small / $120 large") without
        // letting the LLM cram a paragraph in here.
        price: z.string().max(40).optional(),
      })
    )
    .min(2)
    .max(8),
  theme: z.object({
    primary: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be hex color'),
    background: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be hex color'),
    text: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be hex color'),
    accent: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be hex color'),
    fontHeading: z.enum(ALLOWED_HEADING_FONTS),
    fontBody: z.enum(ALLOWED_BODY_FONTS),
    style: z.enum(ALLOWED_STYLES),
  }),
});

export type GeneratedContent = z.infer<typeof generatedContentSchema>;

// Copy-only subset for tone-hint regenerations from the admin dashboard.
// Theme is NOT regenerated — the existing palette/style/fonts stay locked so
// a "different tone" doesn't repaint the whole site.
export const regeneratedCopySchema = generatedContentSchema.pick({
  hero: true,
  about: true,
  services: true,
});

export type RegeneratedCopy = z.infer<typeof regeneratedCopySchema>;

export function sanitizeRegeneratedCopy(copy: RegeneratedCopy): RegeneratedCopy {
  assertClean(copy.hero.headline, 'hero.headline');
  if (copy.hero.headline_emphasis) {
    assertClean(copy.hero.headline_emphasis, 'hero.headline_emphasis');
  }
  assertClean(copy.hero.subheadline, 'hero.subheadline');
  assertClean(copy.hero.cta_text, 'hero.cta_text');
  assertClean(copy.about.title, 'about.title');
  assertClean(copy.about.body, 'about.body');
  copy.services.forEach((s, i) => {
    assertClean(s.name, `services[${i}].name`);
    assertClean(s.description, `services[${i}].description`);
    if (s.price) assertClean(s.price, `services[${i}].price`);
  });
  return copy;
}

// ============================================================================
// Sanitizer — rejects any HTML/JS/URLs that slip past the LLM prompt
// ============================================================================

const HTML_PATTERN = /<[^>]+>/;
const SUSPICIOUS_URI_PATTERN = /javascript:|data:/i;
const URL_PATTERN = /https?:\/\/\S+/i;
const EMAIL_PATTERN = /\S+@\S+\.\S+/;

function assertClean(value: string, field: string): void {
  if (HTML_PATTERN.test(value)) throw new Error(`HTML tag in ${field}`);
  if (SUSPICIOUS_URI_PATTERN.test(value)) throw new Error(`Suspicious URI in ${field}`);
  if (URL_PATTERN.test(value)) throw new Error(`URL in ${field}`);
  if (EMAIL_PATTERN.test(value)) throw new Error(`Email in ${field}`);
}

export function sanitizeGeneratedContent(content: GeneratedContent): GeneratedContent {
  assertClean(content.hero.headline, 'hero.headline');
  if (content.hero.headline_emphasis) {
    assertClean(content.hero.headline_emphasis, 'hero.headline_emphasis');
  }
  assertClean(content.hero.subheadline, 'hero.subheadline');
  assertClean(content.hero.cta_text, 'hero.cta_text');
  assertClean(content.about.title, 'about.title');
  assertClean(content.about.body, 'about.body');
  content.services.forEach((s, i) => {
    assertClean(s.name, `services[${i}].name`);
    assertClean(s.description, `services[${i}].description`);
    if (s.price) assertClean(s.price, `services[${i}].price`);
  });
  return content;
}
