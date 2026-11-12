'use client';

// Tawk.to chat widget loader. Renders the embed script via Next's <Script>
// so the CSP nonce flows through correctly and strict-dynamic propagates
// trust to Tawk's downstream chunks.
//
// Conditional mounting:
//   - Skipped when env vars are unset (so dev / preview work unconfigured).
//   - Skipped on the landing page (/) — the chat bubble distracts from the
//     primary "build my site" conversion path.
//   - Skipped on /sites/* — those are customer-generated websites; the
//     customer didn't sign up for our chat widget on their site.
//   - Skipped on /admin/* — admin is the operator's surface; they don't
//     need to chat with themselves.

import Script from 'next/script';
import { usePathname } from 'next/navigation';

// TEMP: Tawk.to chat disabled site-wide (2026-06-22). Flip to true to re-enable.
const CHAT_ENABLED: boolean = false;

export function ChatWidget() {
  const pathname = usePathname();
  const propertyId = process.env.NEXT_PUBLIC_TAWK_PROPERTY_ID;
  const widgetId = process.env.NEXT_PUBLIC_TAWK_WIDGET_ID;

  if (!CHAT_ENABLED) return null;
  if (!propertyId || !widgetId) return null;
  if (pathname === '/') return null;
  if (pathname?.startsWith('/sites/')) return null;
  if (pathname?.startsWith('/admin')) return null;

  // Inline init matches Tawk's canonical snippet. Their loader builds a
  // second <script> tag pointing at embed.tawk.to/<property>/<widget>;
  // strict-dynamic in our CSP trusts that downstream tag because the
  // wrapping inline script is nonced by Next.
  const snippet = `var Tawk_API=Tawk_API||{}, Tawk_LoadStart=new Date();
(function(){
  var s1=document.createElement("script"),s0=document.getElementsByTagName("script")[0];
  s1.async=true;
  s1.src='https://embed.tawk.to/${propertyId}/${widgetId}';
  s1.charset='UTF-8';
  s1.setAttribute('crossorigin','*');
  s0.parentNode.insertBefore(s1,s0);
})();`;

  return (
    <Script
      id="tawk-widget"
      strategy="afterInteractive"
      dangerouslySetInnerHTML={{ __html: snippet }}
    />
  );
}
