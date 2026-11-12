import type { SectionProps } from '../types';
import { renderEmphasized } from '../emphasis';
import { parseTheme, parseSections, parseOrderingLinks } from '@/lib/tenant';
import { HeroLeadFormSplit } from './HeroLeadFormSplit';

// ============================================================================
// Hero composition dispatcher
//
// Reads `composition` first; falls back to `variant` for sites generated
// before the composition system shipped. Every existing site keeps rendering
// identically — only newly generated rows opt into the new compositions.
// ============================================================================

export function Hero(props: SectionProps) {
  const composition = resolveComposition(props.composition, props.variant);

  switch (composition) {
    case 'editorial-portrait':
      return <HeroEditorialPortrait {...props} />;
    case 'magazine':
      return <HeroMagazine {...props} />;
    case 'display':
      return <HeroDisplay {...props} />;
    case 'bold-stripe':
      return <HeroBoldStripe {...props} />;
    case 'tech-bar':
      return <HeroTechBar {...props} />;
    case 'minimal-center':
      return <HeroMinimalCenter {...props} />;
    case 'lead-form-split':
      return <HeroLeadFormSplit {...props} />;
    case 'image-fullbleed':
    default:
      return <HeroImageFullbleed {...props} />;
  }
}

// Maps legacy `variant` strings to composition names. Returns the composition
// if present (preferred), otherwise the variant-derived fallback.
function resolveComposition(
  composition: string | undefined,
  variant: string,
): string {
  if (composition) return composition;
  if (variant === 'minimal') return 'minimal-center';
  return 'image-fullbleed';
}

// ============================================================================
// Shared helpers
// ============================================================================

const SERIF_HEADINGS = new Set([
  'Playfair Display',
  'Fraunces',
  'Cormorant Garamond',
  'Merriweather',
  'Lora',
]);

type HeroData = {
  headline: string;
  emphasis: string | null;
  subheadline: string;
  ctaText: string;
  heroPhoto: SectionProps['photos'][number] | undefined;
  secondPhoto: SectionProps['photos'][number] | undefined;
  r2: string;
  theme: ReturnType<typeof parseTheme>;
  isSerifHeading: boolean;
  isDisplayCondensed: boolean;
  city: string | null;
  // Vertical-aware CTA targets. Salon clients link to #contact + #services
  // (existing behavior). Restaurants don't ship with a Contact form by
  // default and use Menu/Reservations instead — these hrefs reflect that.
  isRestaurant: boolean;
  primaryCtaHref: string;
  secondaryCtaHref: string;
};

function unpack(props: SectionProps): HeroData {
  const theme = parseTheme(props.content.theme);
  const isRestaurant = props.client.business_vertical === 'restaurant';

  // Match the Nav's CTA-anchoring logic so the two stay in sync. Priority for
  // restaurants: ordering (when links are saved) → reservations → menu. The
  // ordering check requires actual saved links because the OrderingLinks
  // section returns null on an empty list and we don't want the CTA to
  // anchor at a no-op.
  const sections = parseSections(props.content.sections);
  const enabledTypes = new Set(
    sections.filter((s) => s.enabled).map((s) => s.type),
  );
  const hasOrderingLinks =
    enabledTypes.has('ordering') &&
    parseOrderingLinks(props.content.ordering_links).length > 0;
  const primaryCtaHref = isRestaurant
    ? hasOrderingLinks
      ? '#order'
      : enabledTypes.has('reservations')
        ? '#reservations'
        : '#menu'
    : '#contact';
  const secondaryCtaHref = isRestaurant ? '#menu' : '#services';

  return {
    headline: props.content.hero_headline ?? props.client.business_name,
    emphasis: props.content.hero_headline_emphasis ?? null,
    subheadline: props.content.hero_subheadline ?? '',
    ctaText: props.content.hero_cta_text ?? 'Get in Touch',
    heroPhoto: props.photos[0],
    secondPhoto: props.photos[1] ?? props.photos[0],
    r2: process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? '',
    theme,
    isSerifHeading: SERIF_HEADINGS.has(theme.fontHeading),
    isDisplayCondensed: theme.fontHeading === 'Bebas Neue',
    city: props.client.city ?? null,
    isRestaurant,
    primaryCtaHref,
    secondaryCtaHref,
  };
}

function Arrow() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M3 8h10m0 0L8.5 3.5M13 8l-4.5 4.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function AmbientGlow() {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 pointer-events-none"
      style={{
        backgroundImage:
          'radial-gradient(60% 60% at 25% 25%, color-mix(in srgb, var(--color-accent) 22%, transparent) 0%, transparent 60%), radial-gradient(50% 50% at 80% 85%, color-mix(in srgb, var(--color-accent) 14%, transparent) 0%, transparent 60%)',
      }}
    />
  );
}

function BlueprintGrid() {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 pointer-events-none"
      style={{
        backgroundImage:
          'linear-gradient(to right, rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.04) 1px, transparent 1px)',
        backgroundSize: '64px 64px',
        maskImage:
          'radial-gradient(ellipse 75% 60% at 50% 50%, black 30%, transparent 80%)',
        WebkitMaskImage:
          'radial-gradient(ellipse 75% 60% at 50% 50%, black 30%, transparent 80%)',
      }}
    />
  );
}

function HeroAnim() {
  return (
    <style>{`
      @keyframes dfyHeroIn {
        from { opacity: 0; transform: translateY(24px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      .dfy-hero__eyebrow  { animation: dfyHeroIn 0.6s ease-out both; }
      .dfy-hero__headline { animation: dfyHeroIn 0.65s 0.05s ease-out both; }
      .dfy-hero__sub      { animation: dfyHeroIn 0.65s 0.18s ease-out both; }
      .dfy-hero__cta      { animation: dfyHeroIn 0.65s 0.30s ease-out both; }
    `}</style>
  );
}

function overlayForStyle(style: ReturnType<typeof parseTheme>['style']): string {
  if (style === 'premium-dark') {
    return 'linear-gradient(180deg, rgba(0,0,0,0.10) 0%, rgba(14,13,12,0.55) 50%, rgba(14,13,12,0.92) 100%)';
  }
  if (style === 'service-tech') {
    return 'linear-gradient(180deg, rgba(15,23,42,0.10) 0%, rgba(15,23,42,0.55) 50%, rgba(15,23,42,0.92) 100%)';
  }
  if (style === 'bold') {
    return 'linear-gradient(180deg, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.50) 50%, rgba(0,0,0,0.88) 100%)';
  }
  return 'linear-gradient(180deg, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.40) 50%, rgba(0,0,0,0.85) 100%)';
}

// ============================================================================
// Composition: image-fullbleed (legacy "image" variant — preserved)
// ============================================================================

function HeroImageFullbleed(props: SectionProps) {
  const d = unpack(props);
  return (
    <section
      id="home"
      className="dfy-hero dfy-hero--image relative min-h-screen flex items-end overflow-hidden"
      style={!d.heroPhoto ? { background: 'var(--color-primary)' } : undefined}
    >
      <HeroAnim />

      {d.heroPhoto && (
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${d.r2}/${d.heroPhoto.r2_key})` }}
          aria-hidden="true"
        >
          <div className="absolute inset-0" style={{ background: overlayForStyle(d.theme.style) }} />
          {d.theme.style === 'premium-dark' && <AmbientGlow />}
          {d.theme.style === 'service-tech' && <BlueprintGrid />}
        </div>
      )}

      <div className="dfy-hero__content relative z-10 w-full max-w-6xl mx-auto px-8 pb-28 pt-8 text-white">
        {(d.theme.style === 'editorial' || d.theme.style === 'luxe' || d.theme.style === 'premium-dark') && (
          <div className="dfy-hero__eyebrow inline-flex items-center gap-3 mb-7">
            <span className="block w-10 h-px" style={{ background: 'var(--color-accent)' }} />
            <span
              className="text-[11px] uppercase tracking-[0.28em] font-medium"
              style={{ color: 'rgba(255,255,255,0.85)' }}
            >
              {d.city ?? 'Local'}
            </span>
          </div>
        )}

        <h1
          className="dfy-hero__headline mb-5 leading-[1.02]"
          style={{
            fontFamily: 'var(--font-heading)',
            fontWeight: d.isDisplayCondensed ? 400 : d.isSerifHeading ? 400 : 600,
            fontSize: 'clamp(2.75rem, 6.5vw, 5.5rem)',
            letterSpacing: d.isSerifHeading ? '-0.02em' : '-0.03em',
            maxWidth: '14ch',
          }}
        >
          {renderEmphasized(d.headline, d.emphasis, { italic: true })}
        </h1>

        <p
          className="dfy-hero__sub text-lg md:text-xl mb-10 max-w-xl leading-relaxed"
          style={{
            color: 'rgba(255,255,255,0.84)',
            letterSpacing: '0.005em',
            fontFamily: 'var(--font-body)',
          }}
        >
          {d.subheadline}
        </p>

        <div className="dfy-hero__cta flex flex-wrap gap-3 items-center">
          <a
            href={d.primaryCtaHref}
            className="inline-flex items-center gap-2 px-8 py-3.5 font-semibold text-sm transition-all hover:-translate-y-0.5"
            style={{
              background: 'var(--color-accent)',
              color: '#fff',
              borderRadius: 'var(--radius)',
              boxShadow:
                '0 12px 40px -10px color-mix(in srgb, var(--color-accent) 60%, transparent), 0 4px 16px rgba(0,0,0,0.3)',
              letterSpacing: '0.02em',
            }}
          >
            {d.ctaText}
            <Arrow />
          </a>
          <a
            href={d.secondaryCtaHref}
            className="inline-flex items-center px-7 py-3.5 font-medium text-sm border text-white/90 hover:text-white hover:bg-white/10 transition-all"
            style={{ borderRadius: 'var(--radius)', borderColor: 'rgba(255,255,255,0.30)' }}
          >
            {d.isRestaurant ? 'View Menu' : 'Our Services'}
          </a>
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// Composition: minimal-center (legacy "minimal" variant — preserved)
// ============================================================================

function HeroMinimalCenter(props: SectionProps) {
  const d = unpack(props);
  const onDark = d.theme.style === 'premium-dark';
  const minimalBg = onDark ? 'var(--color-primary)' : 'var(--color-background)';
  const textColor = 'var(--color-text)';
  const subdued = onDark
    ? 'rgba(255,255,255,0.65)'
    : 'color-mix(in srgb, var(--color-text) 65%, transparent)';

  return (
    <section
      id="home"
      className="dfy-hero dfy-hero--minimal relative overflow-hidden px-6 pt-32 pb-24 md:pt-40 md:pb-32"
      style={{ background: minimalBg, color: textColor }}
    >
      {onDark && <AmbientGlow />}
      <HeroAnim />

      <div className="relative z-10 max-w-4xl mx-auto text-center">
        {(d.theme.style === 'editorial' || d.theme.style === 'luxe') && (
          <div className="dfy-hero__eyebrow inline-flex items-center gap-3 mb-8">
            <span className="block w-10 h-px" style={{ background: 'var(--color-accent)' }} />
            <span
              className="text-[11px] uppercase tracking-[0.28em]"
              style={{ color: 'var(--color-accent)' }}
            >
              {d.city ?? 'Local'}
            </span>
            <span className="block w-10 h-px" style={{ background: 'var(--color-accent)' }} />
          </div>
        )}

        <h1
          className="dfy-hero__headline mb-6 leading-[0.98]"
          style={{
            fontFamily: 'var(--font-heading)',
            fontWeight: d.isDisplayCondensed ? 400 : d.isSerifHeading ? 400 : 600,
            fontSize: 'clamp(2.5rem, 7vw, 5.5rem)',
            letterSpacing: d.isSerifHeading ? '-0.02em' : '-0.03em',
            color: textColor,
          }}
        >
          {renderEmphasized(d.headline, d.emphasis, { italic: true })}
        </h1>

        <p
          className="dfy-hero__sub text-lg md:text-xl mb-10 max-w-xl mx-auto leading-relaxed"
          style={{ color: subdued, fontFamily: 'var(--font-body)' }}
        >
          {d.subheadline}
        </p>

        <a
          href={d.primaryCtaHref}
          className="dfy-hero__cta inline-flex items-center gap-2 px-8 py-3.5 font-semibold text-sm tracking-wide transition-all hover:-translate-y-0.5"
          style={{
            background: 'var(--color-accent)',
            color: onDark ? 'var(--color-background)' : '#fff',
            borderRadius: 'var(--radius)',
            boxShadow: onDark
              ? '0 12px 40px -10px color-mix(in srgb, var(--color-accent) 50%, transparent)'
              : '0 8px 28px -10px color-mix(in srgb, var(--color-accent) 60%, transparent)',
            letterSpacing: '0.02em',
          }}
        >
          {d.ctaText}
          <Arrow />
        </a>
      </div>
    </section>
  );
}

// ============================================================================
// Composition: magazine — editorial / luxe heroes
// 2-column: oversized serif headline + caption block left, photo card right
// ============================================================================

function HeroMagazine(props: SectionProps) {
  const d = unpack(props);

  return (
    <section
      id="home"
      className="dfy-hero dfy-hero--magazine relative overflow-hidden"
      style={{ background: 'var(--section-bg, var(--color-background))', color: 'var(--color-text)' }}
    >
      <HeroAnim />

      <div className="relative max-w-7xl mx-auto px-6 lg:px-10 pt-24 lg:pt-32 pb-20 lg:pb-28 grid lg:grid-cols-12 gap-10 lg:gap-16 items-center">
        <div className="lg:col-span-7 order-2 lg:order-1">
          <div className="dfy-hero__eyebrow inline-flex items-center gap-3 mb-7">
            <span className="block w-10 h-px" style={{ background: 'var(--color-accent)' }} />
            <span
              className="text-[11px] uppercase tracking-[0.28em] font-medium"
              style={{ color: 'var(--color-accent)' }}
            >
              {d.city ?? 'Studio'}
            </span>
          </div>

          <h1
            className="dfy-hero__headline mb-7 leading-[0.98]"
            style={{
              fontFamily: 'var(--font-heading)',
              fontWeight: d.isSerifHeading ? 400 : 600,
              fontSize: 'clamp(2.75rem, 6vw, 5.5rem)',
              letterSpacing: '-0.02em',
            }}
          >
            {renderEmphasized(d.headline, d.emphasis, { italic: true })}
          </h1>

          <p
            className="dfy-hero__sub text-lg lg:text-xl mb-10 max-w-lg leading-relaxed"
            style={{
              color: 'color-mix(in srgb, var(--color-text) 70%, transparent)',
              fontFamily: 'var(--font-body)',
            }}
          >
            {d.subheadline}
          </p>

          <div className="dfy-hero__cta flex flex-wrap gap-3 items-center">
            <a
              href={d.primaryCtaHref}
              className="inline-flex items-center gap-2 px-8 py-3.5 font-semibold text-sm transition-all hover:-translate-y-0.5"
              style={{
                background: 'var(--color-accent)',
                color: '#fff',
                borderRadius: 'var(--radius)',
                boxShadow: '0 10px 30px -10px color-mix(in srgb, var(--color-accent) 55%, transparent)',
                letterSpacing: '0.02em',
              }}
            >
              {d.ctaText}
              <Arrow />
            </a>
            <a
              href={d.secondaryCtaHref}
              className="inline-flex items-center px-7 py-3.5 font-medium text-sm transition-all hover:opacity-70"
              style={{
                color: 'var(--color-text)',
                borderRadius: 'var(--radius)',
                borderBottom: '1px solid color-mix(in srgb, var(--color-text) 30%, transparent)',
                paddingBottom: '0.55rem',
              }}
            >
              {d.isRestaurant ? 'View Menu' : 'View services'}
            </a>
          </div>
        </div>

        {/* Photo card — offset rule frame for editorial flair */}
        <div className="lg:col-span-5 order-1 lg:order-2 relative">
          {d.heroPhoto && (
            <div
              className="relative overflow-hidden"
              style={{
                aspectRatio: '4/5',
                borderRadius: 'var(--radius)',
                boxShadow: '0 30px 60px -30px rgba(0,0,0,0.25)',
              }}
            >
              <img
                src={`${d.r2}/${d.heroPhoto.r2_key}`}
                alt={d.heroPhoto.alt_text ?? d.headline}
                className="w-full h-full object-cover"
                loading="eager"
                width={d.heroPhoto.width ?? 800}
                height={d.heroPhoto.height ?? 1000}
              />
            </div>
          )}
          <span
            aria-hidden="true"
            className="absolute -bottom-4 -right-4 lg:-bottom-6 lg:-right-6 hidden md:block pointer-events-none"
            style={{
              width: '60%',
              aspectRatio: '4/5',
              border: '1px solid var(--color-accent)',
              borderRadius: 'var(--radius)',
              opacity: 0.45,
              zIndex: -1,
            }}
          />
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// Composition: editorial-portrait — flagship-atelier signature hero
// Full-bleed portrait photo on left, oversized italic-serif headline on right,
// numbered eyebrow + volume bookend + scroll cue. Atelier / boutique energy.
// ============================================================================

function HeroEditorialPortrait(props: SectionProps) {
  const d = unpack(props);
  // Prefer a portrait-orientation shot for the left column. Fall back to
  // first photo if our portrait detection missed.
  const portraitPhoto =
    props.photos.find((p) => (p.height ?? 0) > (p.width ?? 0)) ?? d.heroPhoto;

  return (
    <section
      id="home"
      className="dfy-hero dfy-hero--editorial-portrait relative overflow-hidden"
      style={{ background: 'var(--section-bg, var(--color-background))', color: 'var(--color-text)' }}
    >
      <HeroAnim />

      <div className="relative grid lg:grid-cols-12 min-h-[92vh]">
        {/* Left: full-bleed portrait */}
        <div className="lg:col-span-6 relative order-2 lg:order-1 min-h-[60vh] lg:min-h-[92vh]">
          {portraitPhoto ? (
            <img
              src={`${d.r2}/${portraitPhoto.r2_key}`}
              alt={portraitPhoto.alt_text ?? d.headline}
              className="absolute inset-0 w-full h-full object-cover"
              loading="eager"
              width={portraitPhoto.width ?? 900}
              height={portraitPhoto.height ?? 1200}
            />
          ) : (
            <div className="absolute inset-0" style={{ background: 'var(--color-primary)' }} />
          )}
          {/* Soft gradient at bottom for the volume bookend to sit on */}
          <div
            aria-hidden="true"
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(180deg, rgba(0,0,0,0) 60%, rgba(0,0,0,0.35) 100%)',
            }}
          />
          <span
            aria-hidden="true"
            className="absolute bottom-6 left-6 lg:bottom-10 lg:left-10 text-[10px] uppercase tracking-[0.32em] font-medium"
            style={{ color: 'rgba(255,255,255,0.85)' }}
          >
            Vol. 01 — {d.city ?? 'Studio'}
          </span>
        </div>

        {/* Right: editorial type */}
        <div className="lg:col-span-6 order-1 lg:order-2 relative flex items-center px-8 lg:px-16 py-20 lg:py-24">
          {/* Vertical hairline between columns */}
          <span
            aria-hidden="true"
            className="hidden lg:block absolute top-12 bottom-12 left-0 w-px"
            style={{ background: 'color-mix(in srgb, var(--color-text) 18%, transparent)' }}
          />

          <div className="w-full max-w-xl">
            <div className="dfy-hero__eyebrow flex items-baseline gap-4 mb-10">
              <span
                className="text-[11px] uppercase tracking-[0.32em] font-medium tabular-nums"
                style={{ color: 'var(--color-accent)' }}
              >
                01
              </span>
              <span
                className="block w-10 h-px"
                style={{ background: 'color-mix(in srgb, var(--color-text) 30%, transparent)' }}
              />
              <span
                className="text-[11px] uppercase tracking-[0.32em] font-medium"
                style={{ color: 'color-mix(in srgb, var(--color-text) 70%, transparent)' }}
              >
                {d.city ? `Studio · ${d.city}` : 'The Studio'}
              </span>
            </div>

            <h1
              className="dfy-hero__headline mb-10 leading-[0.92]"
              style={{
                fontFamily: 'var(--font-heading)',
                fontWeight: d.isSerifHeading ? 400 : 500,
                fontSize: 'clamp(2.75rem, 7.5vw, 6.5rem)',
                letterSpacing: '-0.025em',
              }}
            >
              {renderEmphasized(d.headline, d.emphasis, { italic: true })}
            </h1>

            <p
              className="dfy-hero__sub text-lg lg:text-xl mb-12 max-w-md leading-relaxed"
              style={{
                color: 'color-mix(in srgb, var(--color-text) 70%, transparent)',
                fontFamily: 'var(--font-body)',
                fontStyle: d.isSerifHeading ? 'italic' : 'normal',
              }}
            >
              {d.subheadline}
            </p>

            <div className="dfy-hero__cta flex flex-wrap gap-6 items-center">
              <a
                href={d.isRestaurant ? d.primaryCtaHref : '#booking'}
                className="inline-flex items-center gap-2 pb-2 text-sm font-medium uppercase tracking-[0.18em] transition-all hover:gap-3"
                style={{
                  color: 'var(--color-text)',
                  borderBottom: '1px solid var(--color-text)',
                }}
              >
                {d.ctaText}
                <Arrow />
              </a>
              <a
                href={d.secondaryCtaHref}
                className="inline-flex items-center text-sm uppercase tracking-[0.18em] transition-opacity hover:opacity-60"
                style={{ color: 'color-mix(in srgb, var(--color-text) 60%, transparent)' }}
              >
                The Menu
              </a>
            </div>
          </div>

          {/* Scroll cue — tucked to the bottom-right of the right column */}
          <span
            aria-hidden="true"
            className="hidden lg:flex items-center gap-3 absolute bottom-10 right-16 text-[10px] uppercase tracking-[0.32em]"
            style={{ color: 'color-mix(in srgb, var(--color-text) 50%, transparent)' }}
          >
            <span className="block w-8 h-px" style={{ background: 'currentColor' }} />
            Scroll
          </span>
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// Composition: display — typography-led (works without strong photos)
// ============================================================================

function HeroDisplay(props: SectionProps) {
  const d = unpack(props);
  const onDark = d.theme.style === 'premium-dark';
  const bg = onDark ? 'var(--color-primary)' : 'var(--color-background)';
  const textColor = 'var(--color-text)';
  const subdued = onDark
    ? 'rgba(255,255,255,0.70)'
    : 'color-mix(in srgb, var(--color-text) 70%, transparent)';

  return (
    <section
      id="home"
      className="dfy-hero dfy-hero--display relative overflow-hidden px-6 pt-28 lg:pt-36 pb-24 lg:pb-32"
      style={{ background: bg, color: textColor }}
    >
      {onDark && <AmbientGlow />}
      <HeroAnim />

      <div className="relative z-10 max-w-6xl mx-auto">
        <div className="dfy-hero__eyebrow inline-flex items-center gap-3 mb-8">
          <span className="block w-10 h-px" style={{ background: 'var(--color-accent)' }} />
          <span
            className="text-[11px] uppercase tracking-[0.28em] font-medium"
            style={{ color: 'var(--color-accent)' }}
          >
            {d.city ?? 'Local'}
          </span>
        </div>

        <h1
          className="dfy-hero__headline mb-8"
          style={{
            fontFamily: 'var(--font-heading)',
            fontWeight: d.isDisplayCondensed ? 400 : d.isSerifHeading ? 400 : 600,
            fontSize: 'clamp(3rem, 9vw, 8rem)',
            lineHeight: 0.95,
            letterSpacing: d.isSerifHeading ? '-0.025em' : '-0.035em',
            color: textColor,
          }}
        >
          {renderEmphasized(d.headline, d.emphasis, { italic: true })}
        </h1>

        <div className="grid lg:grid-cols-2 gap-10 items-end">
          <p
            className="dfy-hero__sub text-lg lg:text-xl leading-relaxed max-w-xl"
            style={{ color: subdued, fontFamily: 'var(--font-body)' }}
          >
            {d.subheadline}
          </p>
          <div className="dfy-hero__cta flex flex-wrap gap-3 lg:justify-end">
            <a
              href={d.primaryCtaHref}
              className="inline-flex items-center gap-2 px-8 py-3.5 font-semibold text-sm transition-all hover:-translate-y-0.5"
              style={{
                background: 'var(--color-accent)',
                color: onDark ? 'var(--color-background)' : '#fff',
                borderRadius: 'var(--radius)',
                boxShadow: '0 10px 30px -10px color-mix(in srgb, var(--color-accent) 55%, transparent)',
                letterSpacing: '0.02em',
              }}
            >
              {d.ctaText}
              <Arrow />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// Composition: bold-stripe — full-bleed photo + accent stripe + big sans
// ============================================================================

function HeroBoldStripe(props: SectionProps) {
  const d = unpack(props);
  return (
    <section
      id="home"
      className="dfy-hero dfy-hero--bold-stripe relative min-h-[88vh] flex items-end overflow-hidden"
      style={!d.heroPhoto ? { background: 'var(--color-primary)' } : undefined}
    >
      <HeroAnim />

      {d.heroPhoto && (
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${d.r2}/${d.heroPhoto.r2_key})` }}
          aria-hidden="true"
        >
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(115deg, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.45) 45%, rgba(0,0,0,0.15) 100%)',
            }}
          />
        </div>
      )}

      {/* Vertical accent stripe — bold style signature */}
      <span
        aria-hidden="true"
        className="absolute top-0 bottom-0 left-6 lg:left-10 w-1"
        style={{ background: 'var(--color-accent)' }}
      />

      <div className="dfy-hero__content relative z-10 w-full max-w-6xl mx-auto px-12 lg:px-16 pb-24 lg:pb-28 pt-8 text-white">
        <span
          className="dfy-hero__eyebrow inline-block text-[11px] uppercase tracking-[0.32em] mb-6 font-semibold"
          style={{ color: 'var(--color-accent)' }}
        >
          {d.city ?? 'Local'} · Now booking
        </span>

        <h1
          className="dfy-hero__headline mb-6"
          style={{
            fontFamily: 'var(--font-heading)',
            fontWeight: d.isDisplayCondensed ? 400 : 700,
            fontSize: 'clamp(3rem, 8vw, 7rem)',
            lineHeight: 0.92,
            letterSpacing: d.isDisplayCondensed ? '0' : '-0.035em',
            textTransform: d.isDisplayCondensed ? 'uppercase' : 'none',
            maxWidth: '16ch',
          }}
        >
          {renderEmphasized(d.headline, d.emphasis, { italic: true })}
        </h1>

        <p
          className="dfy-hero__sub text-lg lg:text-xl mb-9 max-w-xl leading-relaxed"
          style={{ color: 'rgba(255,255,255,0.82)', fontFamily: 'var(--font-body)' }}
        >
          {d.subheadline}
        </p>

        <div className="dfy-hero__cta flex flex-wrap gap-3 items-center">
          <a
            href={d.primaryCtaHref}
            className="inline-flex items-center gap-2 px-8 py-3.5 font-semibold text-sm transition-all hover:-translate-y-0.5"
            style={{
              background: 'var(--color-accent)',
              color: '#fff',
              borderRadius: 'var(--radius)',
              boxShadow:
                '0 12px 36px -10px color-mix(in srgb, var(--color-accent) 65%, transparent), 0 4px 16px rgba(0,0,0,0.35)',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            {d.ctaText}
            <Arrow />
          </a>
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// Composition: tech-bar — clean photo + horizontal stat band below
// ============================================================================

function HeroTechBar(props: SectionProps) {
  const d = unpack(props);
  return (
    <section
      id="home"
      className="dfy-hero dfy-hero--tech-bar relative overflow-hidden"
      style={{ background: 'var(--section-bg, var(--color-background))', color: 'var(--color-text)' }}
    >
      <HeroAnim />

      <div className="relative max-w-7xl mx-auto px-6 lg:px-10 pt-20 lg:pt-28 pb-10">
        <div className="grid lg:grid-cols-12 gap-10 lg:gap-14 items-center">
          <div className="lg:col-span-7">
            <span
              className="dfy-hero__eyebrow inline-flex items-center gap-2 text-xs uppercase tracking-widest font-semibold mb-6"
              style={{ color: 'var(--color-accent)' }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--color-accent)' }} />
              {d.city ? `Serving ${d.city}` : 'Now serving'}
            </span>

            <h1
              className="dfy-hero__headline mb-6 leading-[1.0]"
              style={{
                fontFamily: 'var(--font-heading)',
                fontWeight: 600,
                fontSize: 'clamp(2.5rem, 6vw, 4.75rem)',
                letterSpacing: '-0.025em',
              }}
            >
              {renderEmphasized(d.headline, d.emphasis, { italic: false })}
            </h1>

            <p
              className="dfy-hero__sub text-lg lg:text-xl mb-9 max-w-xl leading-relaxed"
              style={{
                color: 'color-mix(in srgb, var(--color-text) 70%, transparent)',
                fontFamily: 'var(--font-body)',
              }}
            >
              {d.subheadline}
            </p>

            <div className="dfy-hero__cta flex flex-wrap gap-3 items-center">
              <a
                href={d.primaryCtaHref}
                className="inline-flex items-center gap-2 px-7 py-3 font-semibold text-sm transition-all hover:-translate-y-0.5"
                style={{
                  background: 'var(--color-accent)',
                  color: '#fff',
                  borderRadius: 'var(--radius)',
                  boxShadow: '0 10px 30px -10px color-mix(in srgb, var(--color-accent) 55%, transparent)',
                }}
              >
                {d.ctaText}
                <Arrow />
              </a>
              <a
                href={d.secondaryCtaHref}
                className="inline-flex items-center px-6 py-3 font-medium text-sm transition-all"
                style={{
                  color: 'var(--color-text)',
                  borderRadius: 'var(--radius)',
                  border: '1px solid color-mix(in srgb, var(--color-text) 18%, transparent)',
                }}
              >
                {d.isRestaurant ? 'View Menu' : 'View services'}
              </a>
            </div>
          </div>

          <div className="lg:col-span-5">
            {d.heroPhoto ? (
              <div
                className="relative overflow-hidden"
                style={{
                  aspectRatio: '4/3',
                  borderRadius: 'var(--radius)',
                  boxShadow: '0 30px 60px -30px rgba(0,0,0,0.20)',
                }}
              >
                <img
                  src={`${d.r2}/${d.heroPhoto.r2_key}`}
                  alt={d.heroPhoto.alt_text ?? d.headline}
                  className="w-full h-full object-cover"
                  loading="eager"
                  width={d.heroPhoto.width ?? 800}
                  height={d.heroPhoto.height ?? 600}
                />
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Stat band — service-tech signature */}
      <div
        className="border-y"
        style={{
          background: 'color-mix(in srgb, var(--color-accent) 6%, var(--color-background))',
          borderColor: 'color-mix(in srgb, var(--color-text) 8%, transparent)',
        }}
      >
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-5 grid grid-cols-2 md:grid-cols-3 gap-6 text-center md:text-left">
          {[
            { label: 'Service area', value: d.city ?? 'Local' },
            { label: 'Booking', value: 'Online · 24hr response' },
            { label: 'Estimate', value: 'Free · No obligation' },
          ].map((s) => (
            <div key={s.label}>
              <p
                className="text-[10px] uppercase tracking-widest font-semibold mb-1"
                style={{ color: 'color-mix(in srgb, var(--color-text) 55%, transparent)' }}
              >
                {s.label}
              </p>
              <p
                className="text-sm font-medium"
                style={{ color: 'var(--color-text)', fontFamily: 'var(--font-heading)' }}
              >
                {s.value}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
