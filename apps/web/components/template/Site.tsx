import type { PublicClientContext } from '@/lib/tenant';
import { parseSections, parseTheme, isDarkBackground } from '@/lib/tenant';
import { composeBackground } from '@/lib/theme/background';
import { Nav } from './Nav';
import { Footer } from './Footer';
import { Hero } from './sections/Hero';
import { Services } from './sections/Services';
import { Gallery } from './sections/Gallery';
import { About } from './sections/About';
import { Booking } from './sections/Booking';
import { Contact } from './sections/Contact';
import { Follow } from './sections/Follow';
import { Menu } from './sections/Menu';
import { Reservations } from './sections/Reservations';
import { OrderingLinks } from './sections/OrderingLinks';
import { DineWithUs } from './sections/DineWithUs';
import { Hours } from './sections/Hours';
import { Location } from './sections/Location';
import { TopBar } from './sections/TopBar';
import { TrustBar } from './sections/TrustBar';
import { WhyUs } from './sections/WhyUs';
import { Testimonials } from './sections/Testimonials';
import { CtaStrip } from './sections/CtaStrip';
import { deriveAltBg } from '@/lib/theme/altBg';
import { PreviewBridge } from './PreviewBridge';
import { FloatingBookingPill } from './FloatingBookingPill';
import { ClaimBanner } from './ClaimBanner';
import type { SectionProps } from './types';

type SectionComponent = (props: SectionProps) => React.ReactElement | null;

const SECTION_REGISTRY: Record<string, SectionComponent> = {
  hero: Hero,
  services: Services,
  gallery: Gallery,
  about: About,
  booking: Booking,
  contact: Contact,
  follow: Follow,
  // Restaurant sections — only emitted on restaurant clients (vertical
  // determined server-side by isRestaurantStyle in the generator route).
  menu: Menu,
  reservations: Reservations,
  ordering: OrderingLinks,
  dine: DineWithUs,
  hours: Hours,
  location: Location,
  // Trades-vertical sections — only emitted on trades clients.
  top_bar: TopBar,
  trust_bar: TrustBar,
  why_us: WhyUs,
  testimonials: Testimonials,
  cta_strip: CtaStrip,
};

const FONT_SPECS: Record<string, string> = {
  'Playfair Display': 'Playfair+Display:ital,wght@0,400;0,600;0,700;1,400;1,600',
  Fraunces: 'Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,400;1,9..144,500',
  'Cormorant Garamond': 'Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500',
  Inter: 'Inter:wght@400;500;600;700',
  Merriweather: 'Merriweather:ital,wght@0,400;0,700;1,400',
  'Bebas Neue': 'Bebas+Neue',
  Poppins: 'Poppins:wght@400;500;600;700',
  'Space Grotesk': 'Space+Grotesk:wght@400;500;600;700',
  Lora: 'Lora:ital,wght@0,400;0,500;0,600;1,400',
  'Open Sans': 'Open+Sans:wght@400;600;700',
  Roboto: 'Roboto:wght@400;500;700',
  'DM Sans': 'DM+Sans:wght@400;500;600;700',
  // Personality fonts — single weight each since these are display/character
  // fonts that don't ship multiple useful weights on Google Fonts.
  'Bowlby One': 'Bowlby+One',
  Anton: 'Anton',
  Italiana: 'Italiana',
  Audiowide: 'Audiowide',
  Nunito: 'Nunito:wght@400;500;600;700',
  'Space Mono': 'Space+Mono:wght@400;700',
};

function buildFontsUrl(heading: string, body: string): string | null {
  const families = Array.from(new Set([heading, body]))
    .map((f) => FONT_SPECS[f])
    .filter((f): f is string => f != null);
  if (families.length === 0) return null;
  return `https://fonts.googleapis.com/css2?${families.map((f) => `family=${f}`).join('&')}&display=swap`;
}

export function Site({ context }: { context: PublicClientContext }) {
  const { content, client, photos, menuPhotos } = context;
  const sections = parseSections(content.sections);
  const theme = parseTheme(content.theme);
  const fontsUrl = buildFontsUrl(theme.fontHeading, theme.fontBody);
  // Card-surface vars — set once here based on bg luminance, kept in sync at
  // runtime by PreviewBridge when admins switch palettes. Without this, dark
  // palettes (e.g. service-tech "Navy / Electric") render solid-white cards
  // with white text because the JS branch was style-gated to premium-dark.
  const onDark = isDarkBackground(theme.background);

  // --color-background carries an optional treatment overlay layered atop
  // the solid color. Sections read this var for their own bg, so a single
  // composition here propagates the treatment everywhere without per-section
  // edits. Treatment changes still require a save+reload (the data-attr is
  // the runtime read site for PreviewBridge's bg recomposition).
  const bgValue = composeBackground(theme.background, theme.background_treatment);

  // Alternating section bg: every other section reads --color-background-alt
  // instead of --color-background. Default on; admin can disable or override
  // the alt color from the editor. Auto-derived ~4% darker shade unless set
  // explicitly. Sections read via --section-bg (set on the wrapper below).
  const altBgEnabled = theme.alt_bg_enabled !== false;
  const altBgValue =
    theme.background_alt ?? deriveAltBg(theme.background) ?? theme.background;

  // Pre-sale claim banner: only on unclaimed ('live') sites the operator hasn't
  // opted out of (demos set hide_claim_banner). Claimed sites render via a
  // different tenant path and never carry status 'live', so the banner removes
  // itself automatically once the customer pays. When shown, the sticky <Nav>
  // is pushed down by --claim-banner-h (see globals.css) so both stay visible.
  const showClaimBanner = client.status === 'live' && !client.hide_claim_banner;

  return (
    <>
      {fontsUrl && (
        <>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link rel="stylesheet" href={fontsUrl} />
        </>
      )}
      <main
        className={`dfy-site dfy-style--${theme.style}`}
        data-style={theme.style}
        data-bg-treatment={theme.background_treatment ?? ''}
        data-bg-color={theme.background}
        data-bg-alt-explicit={theme.background_alt ? '1' : '0'}
        data-alt-bg-enabled={theme.alt_bg_enabled !== false ? '1' : '0'}
        data-claim-banner={showClaimBanner ? '1' : '0'}
        style={
          {
            '--claim-banner-h': '2.75rem',
            '--color-primary': theme.primary,
            '--color-background': bgValue,
            '--color-background-alt': altBgValue,
            '--color-text': theme.text,
            '--color-accent': theme.accent,
            '--font-heading': theme.fontHeading,
            '--font-body': theme.fontBody,
            '--radius': theme.borderRadius,
            '--card-surface': onDark
              ? 'color-mix(in srgb, var(--color-text) 5%, transparent)'
              : '#ffffff',
            '--card-ring': onDark
              ? 'color-mix(in srgb, var(--color-text) 12%, transparent)'
              : 'rgba(0,0,0,0.06)',
            // Reference vars (not literals) so the PreviewBridge can swap
            // them at runtime when the admin tweaks colors/fonts.
            background: 'var(--color-background)',
            color: 'var(--color-text)',
            fontFamily: 'var(--font-body)',
          } as React.CSSProperties
        }
      >
        <PreviewBridge />
        {showClaimBanner && <ClaimBanner clientId={client.id} brand={client.brand} />}
        <Nav content={content} client={client} />

        {theme.style.startsWith('flagship-') && (
          <FloatingBookingPill client={client} content={content} />
        )}

        {sections
          .filter((s) => s.enabled)
          .map((section, i) => {
            const Component = SECTION_REGISTRY[section.type];
            if (!Component) return null;
            // Hero (index 0) uses its own bg treatment (full-bleed image /
            // gradient) — never alt-tinted. From index 1, alternate every
            // other section. We tag the "alt slot" wrappers regardless of
            // whether alt-bg is currently enabled, so PreviewBridge can flip
            // them on/off live without losing the every-other rhythm.
            const isAltSlot = i % 2 === 1 && section.type !== 'hero';
            const useAlt = altBgEnabled && isAltSlot;
            return (
              <div
                key={`${section.type}-${i}`}
                style={
                  useAlt
                    ? ({ '--section-bg': 'var(--color-background-alt)' } as React.CSSProperties)
                    : undefined
                }
                data-section-alt={isAltSlot ? '1' : '0'}
              >
                <Component
                  variant={section.variant}
                  composition={section.composition}
                  content={content}
                  client={client}
                  photos={photos}
                  menuPhotos={menuPhotos}
                />
              </div>
            );
          })}

        <Footer client={client} content={content} />
      </main>
    </>
  );
}
