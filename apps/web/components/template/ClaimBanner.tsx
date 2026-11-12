import type { CSSProperties } from 'react';
import { CHEAP_BRAND, cheapBrandOrigin, isCheapBrandClient } from '@/lib/marketing-brand';

// Sticky "claim this site" bar shown on unclaimed (status='live') template
// sites — i.e. the tokenized preview link we hand to a prospect. The whole bar
// is one big tap target that links straight to the branded checkout page
// (/pay/<clientId>), so the prospect can claim + pay from the preview itself
// instead of us copy-pasting the payment link to them. It disappears on its own
// once the site is claimed: claimed sites render via a different code path where
// this never mounts (see Site.tsx + lib/tenant getClaimedClientByHost).
//
// Chrome is intentionally NOT theme-derived — it's our sales UI, not the
// client's brand, so colors/fonts are hard-coded and self-contained. Height is
// fixed (--claim-banner-h in Site.tsx) so the sticky <Nav> can pin right below
// it; keep the layout single-line so it never grows past that height on mobile.

// The pay page lives on the platform domain, but the site is served on the
// client's own subdomain / custom domain — so the link must be absolute.
// Mirrors the origin logic in app/api/pay/[id]/route.ts.
// Stupid Cheap Websites clients get that brand's bar and its own pay page.
function payUrlFor(clientId: string, cheapBrand: boolean): string {
  if (cheapBrand) return `${cheapBrandOrigin()}/pay/${clientId}`;
  const platformDomain = process.env.PLATFORM_DOMAIN ?? 'localhost:3000';
  const proto = platformDomain.startsWith('localhost') ? 'http' : 'https';
  return `${proto}://${platformDomain}/pay/${clientId}`;
}

const barStyle: CSSProperties = {
  position: 'sticky',
  top: 0,
  zIndex: 60,
  height: 'var(--claim-banner-h)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.75rem',
  padding: '0 1rem',
  background: '#0f172a',
  color: '#ffffff',
  textDecoration: 'none',
  fontFamily:
    'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  fontSize: '0.875rem',
  lineHeight: 1.2,
  boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
};

const labelStyle: CSSProperties = {
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontWeight: 500,
};

const ctaStyle: CSSProperties = {
  flexShrink: 0,
  background: '#f59e0b',
  color: '#0f172a',
  padding: '0.35rem 0.9rem',
  borderRadius: '999px',
  fontWeight: 600,
  fontSize: '0.8125rem',
  whiteSpace: 'nowrap',
};

const cheapBarStyle: CSSProperties = { ...barStyle, background: '#171717' };
const cheapCtaStyle: CSSProperties = { ...ctaStyle, background: '#f5ff3b', color: '#171717', borderRadius: '4px' };

export function ClaimBanner({ clientId, brand }: { clientId: string; brand?: string | null }) {
  if (isCheapBrandClient(brand)) {
    return (
      <a href={payUrlFor(clientId, true)} style={cheapBarStyle} data-claim-banner-bar>
        <span style={labelStyle}>
          This is your free preview. Launch it for ${CHEAP_BRAND.monthly}/month.
        </span>
        <span style={cheapCtaStyle}>Launch my site →</span>
      </a>
    );
  }
  return (
    <a href={payUrlFor(clientId, false)} style={barStyle} data-claim-banner-bar>
      <span style={labelStyle}>
        🚀 This is your free preview — claim it to take your site live.
      </span>
      <span style={ctaStyle}>Claim this site →</span>
    </a>
  );
}
