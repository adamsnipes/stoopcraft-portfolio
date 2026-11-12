// Meta (Facebook) Pixel. Rendered from layout.tsx and gated server-side on
// non-customer sites — same rule as PostHog: a customer's published-site
// visitors must never land in our ad-tracking under our pixel.
//
// Server component (no 'use client'): the inline bootstrap is emitted with the
// per-request CSP nonce so the strict script-src lets it run. The external
// fbevents.js it injects is trusted via 'strict-dynamic' (the nonced script
// vouches for the script it loads), so it doesn't need its own allowlist entry
// on modern browsers — connect.facebook.net is still listed in script-src for
// older browsers that ignore strict-dynamic. See proxy.ts for the matching
// connect-src / img-src entries (www.facebook.com) the pixel needs to phone home.

import { META_PIXEL_ID as PIXEL_ID } from '@/lib/meta';

export function MetaPixel({ nonce }: { nonce?: string }) {
  return (
    <>
      <script
        nonce={nonce}
        dangerouslySetInnerHTML={{
          __html: `!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${PIXEL_ID}');
fbq('track', 'PageView');`,
        }}
      />
      <noscript>
        <img
          height="1"
          width="1"
          style={{ display: 'none' }}
          alt=""
          src={`https://www.facebook.com/tr?id=${PIXEL_ID}&ev=PageView&noscript=1`}
        />
      </noscript>
    </>
  );
}
