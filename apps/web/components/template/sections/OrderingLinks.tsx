import { parseOrderingLinks } from '@/lib/tenant';
import type { SectionProps } from '../types';
import type { OrderingLink, OrderingPlatform } from '@dfy/db';

// ============================================================================
// Ordering links — branded button row for delivery/takeout platforms.
//
// Iframe embedding doesn't work for these (X-Frame-Options: DENY), so we
// render link-out buttons in each platform's brand color. Only platforms
// the customer has set a URL for render — the section returns null when
// no links are configured.
//
// Logos come from Brandfetch's free CDN. Requires NEXT_PUBLIC_BRANDFETCH_CLIENT_ID
// to be set in env — when missing, the buttons fall back to text-only and the
// section still renders cleanly. The CDN is keyed by the platform's domain so
// rebrands are picked up automatically without us shipping new asset URLs.
// ============================================================================

const PLATFORM_LABELS: Record<OrderingPlatform, string> = {
  doordash: 'DoorDash',
  ubereats: 'Uber Eats',
  grubhub: 'Grubhub',
  postmates: 'Postmates',
  chownow: 'ChowNow',
  toast: 'Toast',
  square: 'Square',
  direct: 'Order direct',
};

const PLATFORM_COLORS: Record<OrderingPlatform, { bg: string; text: string }> = {
  // DoorDash: white button so the red brand-mark in the logo lockup pops.
  // theme/light Brandfetch variant gives us the red-on-transparent SVG that
  // reads correctly here. Border added so the button has an edge against
  // cream page backgrounds (which are also off-white).
  doordash: { bg: '#ffffff', text: '#1a1a1a' },
  ubereats: { bg: '#06c167', text: '#ffffff' },
  // Grubhub: white button so the brand red in the logo lockup pops. theme/light
  // Brandfetch variant gives us the colored-on-transparent SVG.
  grubhub: { bg: '#ffffff', text: '#1a1a1a' },
  postmates: { bg: '#000000', text: '#ffffff' },
  chownow: { bg: '#ff6900', text: '#ffffff' },
  toast: { bg: '#ff4c00', text: '#ffffff' },
  square: { bg: '#000000', text: '#ffffff' },
  direct: { bg: 'var(--color-accent)', text: 'var(--color-background)' },
};

// Per-platform CDN overrides. The path/asset format here was hand-picked
// from Brandfetch's catalog (theme/dark variant = white logo on a dark/colored
// button) because the auto domain-keyed asset returned a stylized "B" for
// Grubhub and a generic icon for DoorDash. Asset paths are stable per brand
// — only the client-id query needs to come from env. Platforms NOT listed
// here fall back to the domain-keyed default below and render in chip+label
// mode; platforms listed here are full brand lockups and render as the
// entire button content (no text label, no chip).
// `height` overrides the default lockup-mode logo size when a brand's asset
// renders too small at the default height (e.g. wide wordmarks like Uber Eats
// look thin at 24px even though squarer marks read fine).
const PLATFORM_LOGO: Partial<
  Record<OrderingPlatform, { path: string; height?: number }>
> = {
  doordash: { path: 'idrVhdDocf/theme/dark/logo.svg?t=1700164243015' },
  ubereats: {
    path: 'idIjpcD2zP/w/406/h/162/theme/dark/idRPY9jadJ.png?t=1775791857570',
    height: 48,
  },
  grubhub: { path: 'idtctBUT8X/theme/dark/logo.svg?t=1755335880075' },
};

// Domain Brandfetch keys each logo on (fallback for platforms without an
// explicit asset path above). Square's checkout product runs on squareup.com;
// toasttab.com is Toast's restaurant domain (not toast.com, which is squatted).
const PLATFORM_DOMAINS: Record<Exclude<OrderingPlatform, 'direct'>, string> = {
  doordash: 'doordash.com',
  ubereats: 'ubereats.com',
  grubhub: 'grubhub.com',
  postmates: 'postmates.com',
  chownow: 'chownow.com',
  toast: 'toasttab.com',
  square: 'squareup.com',
};

function brandLogoUrl(platform: OrderingPlatform): string | null {
  if (platform === 'direct') return null;
  const clientId = process.env.NEXT_PUBLIC_BRANDFETCH_CLIENT_ID;
  if (!clientId) return null;
  // Paths in PLATFORM_LOGO already include their own ?t=… cache-bust, so the
  // client id rides on & instead of ?.
  const override = PLATFORM_LOGO[platform];
  if (override) {
    const sep = override.path.includes('?') ? '&' : '?';
    return `https://cdn.brandfetch.io/${override.path}${sep}c=${clientId}`;
  }
  const domain = PLATFORM_DOMAINS[platform];
  return `https://cdn.brandfetch.io/${domain}/w/64/h/64?c=${clientId}`;
}

export function OrderingLinks(props: SectionProps) {
  // Empty-URL entries are placeholder buttons — the generator seeds DoorDash
  // and Uber Eats by default so the section shows up on every restaurant site
  // out of the box. The customer fills the URLs in via the editor; until then
  // the buttons render as visual presence but don't navigate (see
  // OrderingButton). Only hide the section when there are zero entries at all.
  const links = parseOrderingLinks(props.content.ordering_links);
  if (links.length === 0) return null;

  return (
    <section
      id="order"
      className="dfy-section dfy-ordering"
      style={{
        padding: '4rem 1.5rem',
        background: 'var(--section-bg, var(--color-background))',
      }}
    >
      <div style={{ maxWidth: '900px', margin: '0 auto', textAlign: 'center' }}>
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '0.75rem',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            opacity: 0.65,
            marginBottom: '0.75rem',
          }}
        >
          Order online
        </p>
        <h2
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: 'clamp(1.75rem, 4vw, 2.75rem)',
            marginBottom: '2.5rem',
          }}
        >
          Delivery &amp; takeout
        </h2>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: '0.75rem',
          }}
        >
          {links.map((link, i) => (
            <OrderingButton key={`${link.platform}-${i}`} link={link} />
          ))}
        </div>
      </div>
    </section>
  );
}

function OrderingButton({ link }: { link: OrderingLink }) {
  const colors = PLATFORM_COLORS[link.platform];
  const label = link.label ?? PLATFORM_LABELS[link.platform];
  const logo = brandLogoUrl(link.platform);
  // Placeholder buttons (no URL yet) render the brand button but as a
  // non-interactive span — they still communicate "we're on this platform"
  // without producing a dead link.
  const isPlaceholder = link.url.trim() === '';

  // Lockup mode: when a hand-picked Brandfetch asset is registered for this
  // platform (DoorDash, Uber Eats, Grubhub), the asset IS the brand lockup —
  // render it as the entire button content. No text label, no chip — the logo
  // already includes the brand name. aria-label keeps the link accessible
  // since there's no visible text.
  if (logo && PLATFORM_LOGO[link.platform]) {
    const logoHeight = PLATFORM_LOGO[link.platform]?.height ?? 24;
    const lockupStyle = {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '0.625rem 1.5rem',
      color: colors.text,
      borderRadius: 'var(--radius)',
      textDecoration: 'none',
      minWidth: '160px',
      minHeight: '52px',
      opacity: isPlaceholder ? 0.55 : 1,
    } as const;
    const lockupChildren = (
      <img
        src={logo}
        alt={label}
        loading="lazy"
        style={{
          height: `${logoHeight}px`,
          width: 'auto',
          maxWidth: '160px',
          objectFit: 'contain',
          display: 'block',
        }}
      />
    );
    if (isPlaceholder) {
      return (
        <span role="img" aria-label={label} style={lockupStyle}>
          {lockupChildren}
        </span>
      );
    }
    return (
      <a
        href={link.url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={label}
        style={lockupStyle}
      >
        {lockupChildren}
      </a>
    );
  }

  // Default: text label, optional small chip for platforms that fall back to
  // the domain-keyed Brandfetch asset (Postmates, ChowNow, Toast, Square).
  const defaultStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.625rem',
    padding: '0.875rem 1.5rem',
    background: colors.bg,
    color: colors.text,
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    borderRadius: 'var(--radius)',
    textDecoration: 'none',
    letterSpacing: '0.03em',
    minWidth: '160px',
    opacity: isPlaceholder ? 0.55 : 1,
  } as const;
  const defaultChildren = (
    <>
      {logo && (
        <span
          style={{
            display: 'inline-block',
            width: '28px',
            height: '28px',
            borderRadius: '999px',
            overflow: 'hidden',
            background: '#ffffff',
            flexShrink: 0,
          }}
        >
          <img
            src={logo}
            alt=""
            width={28}
            height={28}
            loading="lazy"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        </span>
      )}
      {label}
    </>
  );
  if (isPlaceholder) {
    return <span style={defaultStyle}>{defaultChildren}</span>;
  }
  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      style={defaultStyle}
    >
      {defaultChildren}
    </a>
  );
}
