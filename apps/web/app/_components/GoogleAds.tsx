// Google Ads tag (gtag.js). Rendered from layout.tsx and gated server-side on
// non-customer sites — same rule as MetaPixel/PostHog: a customer's
// published-site visitors must never land in our ad-tracking under our tag.
//
// Server component (no 'use client'): both the external gtag/js loader and the
// inline bootstrap are emitted with the per-request CSP nonce so the strict
// script-src lets them run. gtag.js then pulls further Google chunks at runtime,
// which strict-dynamic covers (the nonced loader vouches for them); the explicit
// www.googletagmanager.com host in script-src is the fallback for older browsers
// that ignore strict-dynamic. See proxy.ts for the matching img-src / connect-src
// / frame-src entries (google.com, googleads.g.doubleclick.net, etc.) the
// conversion pixels and linker need to phone home.

const GOOGLE_ADS_ID = 'AW-11386315496';
// GA4 for stoopcraft.com itself. One gtag.js instance feeds both destinations,
// so this needs no extra loader and no CSP change — just a second config call.
// (Client static sites each get their OWN property, tagged in their bundle.)
const GA4_ID = 'G-1P2FK7WCMP';

export function GoogleAds({ nonce }: { nonce?: string }) {
  return (
    <>
      <script
        async
        nonce={nonce}
        src={`https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ADS_ID}`}
      />
      <script
        nonce={nonce}
        dangerouslySetInnerHTML={{
          __html: `window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GOOGLE_ADS_ID}');
gtag('config', '${GA4_ID}');`,
        }}
      />
    </>
  );
}
