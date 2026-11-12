import type { Metadata } from "next";
import { headers } from "next/headers";
import { Bricolage_Grotesque, Geist, Geist_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { ChatWidget } from "./_components/ChatWidget";
import { PostHogProvider } from "./_components/PostHogProvider";
import { MetaPixel } from "./_components/MetaPixel";
import { GoogleAds } from "./_components/GoogleAds";
import { CHEAP_BRAND } from "@/lib/marketing-brand";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Display face — geometric sans with character (distinctive 'a', looped 'g',
// wide proportions). Lighter than Geist's pure geometry so it stands out at
// hero sizes while still reading "modern tech product" alongside the body.
const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

// Landing display face — Bricolage Grotesque, a contemporary grotesque with
// intentional warmth and character (a fresher, less "geometric tech" feel than
// Space Grotesk). Variable font, so light hero weights + italics both work.
// Scoped to the marketing homepage via `.landing-gold` in globals.css; the rest
// of the platform keeps Space Grotesk as its display face.
const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
});

const SITE_URL = "https://stoopcraft.com";
const SITE_DESCRIPTION =
  "StoopCraft builds professional websites for local service businesses before you pay a cent. Claim yours and go live in minutes.";
// 1200x630 social card. Must be a real file (not the 1254px square app icon) —
// a square image on a summary_large_image card gets cropped.
const OG_IMAGE = "/og-image.png";
const OG_ALT =
  "StoopCraft — done-for-you websites for local businesses. We build it first; you pay only if you love it.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "StoopCraft — Done-For-You Websites for Local Businesses",
    template: "%s — StoopCraft",
  },
  description: SITE_DESCRIPTION,
  applicationName: "StoopCraft",
  // NO `alternates.canonical` here. Next merges metadata layout -> page, so a
  // canonical set on the root layout is INHERITED by every page that doesn't
  // override it — which pointed /affiliates, /landscapers, /sales-reps, /terms,
  // /privacy and /cancellation at the homepage, telling Google they were
  // duplicates of "/". Each page declares its own canonical instead. A missing
  // canonical is harmless (Google self-canonicalises); a wrong one is not.
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "StoopCraft",
    title: "StoopCraft — Done-For-You Websites for Local Businesses",
    description: SITE_DESCRIPTION,
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: OG_ALT }],
  },
  twitter: {
    card: "summary_large_image",
    title: "StoopCraft — Done-For-You Websites for Local Businesses",
    description: SITE_DESCRIPTION,
    images: [{ url: OG_IMAGE, alt: OG_ALT }],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Force dynamic rendering — required for nonce-based CSP. Without this,
  // pages get statically optimized at build time and the per-request nonce
  // from proxy.ts never reaches the inline scripts Next.js injects, so all
  // hydration is blocked by CSP in production.
  const h = await headers();

  // Customer-served sites (subdomain or custom domain) get a header from
  // the proxy. The URL bar stays at the customer host even though the
  // server resolves to /sites/[host], so the ChatWidget's client-side
  // pathname check can't see this on its own.
  const isCustomerSite = h.get('x-is-customer-site') === '1';
  const isCheapBrand = h.get('x-marketing-brand') === CHEAP_BRAND.id;

  // Inline JSON-LD needs the per-request nonce; without it the strict CSP
  // drops the script (even though it isn't executable JS).
  const nonce = h.get('x-nonce') ?? undefined;

  const organizationLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: isCheapBrand ? CHEAP_BRAND.name : "StoopCraft",
    alternateName: isCheapBrand ? "Stupid Cheap Websites" : "Stoopcraft",
    url: isCheapBrand ? CHEAP_BRAND.url : SITE_URL,
    logo: isCheapBrand ? `${CHEAP_BRAND.url}/cheap-websites/logo.svg` : `${SITE_URL}/icon.png`,
    description: isCheapBrand ? "Done-for-you business websites for $40/month. Free design and preview." : SITE_DESCRIPTION,
    email: isCheapBrand ? CHEAP_BRAND.email : "hello@stoopcraft.com",
  };

  const websiteLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: isCheapBrand ? CHEAP_BRAND.name : "StoopCraft",
    url: isCheapBrand ? CHEAP_BRAND.url : SITE_URL,
  };

  return (
    <html
      lang="en"
      // `overflow-x-hidden` on the root scroller kills horizontal page swipe on
      // our platform pages. It's the one clip WebKit/iOS Safari reliably honors:
      // decorative blur elements that combine `transform` + `filter` escape a
      // section's `overflow-hidden` on iOS (a long-standing WebKit bug) and add
      // scroll width, even though Blink clips them. Scoped off customer sites so
      // their own layouts are untouched.
      className={`${geistSans.variable} ${geistMono.variable} ${spaceGrotesk.variable} ${bricolage.variable} h-full antialiased${
        isCustomerSite ? '' : ' overflow-x-hidden'
      }`}
    >
      <body className="min-h-full flex flex-col">
        {/* JSON-LD: anchors the apex to the StoopCraft brand entity for
            Google's Knowledge Graph. Skipped on customer-served sites so
            we don't claim their pages are ours. */}
        {!isCustomerSite && (
          <>
            <script
              type="application/ld+json"
              nonce={nonce}
              dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationLd) }}
            />
            <script
              type="application/ld+json"
              nonce={nonce}
              dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteLd) }}
            />
          </>
        )}
        {/* Meta Pixel — platform pages only, same reasoning as PostHog:
            a customer's site visitors must not land in our ad tracking. */}
        {!isCustomerSite && <MetaPixel nonce={nonce} />}
        {/* Google Ads (gtag.js) — platform pages only, same reasoning as the
            Meta Pixel: a customer's site visitors must not land in our ad
            tracking / conversion reporting. */}
        {!isCustomerSite && <GoogleAds nonce={nonce} />}
        {/* PostHog — only on platform pages, never on customer-served
            sites (their visitors shouldn't end up in our analytics under
            our project). Falls back to a passthrough when no API key is
            configured. */}
        {isCustomerSite ? (
          children
        ) : (
          <PostHogProvider>{children}</PostHogProvider>
        )}
        {/* Tawk.to chat — suppressed on customer sites (set server-side
            from the proxy) and on /sites/* + /admin/* (client-side, for
            the localhost dev path that uses /sites/[host] directly). */}
        {!isCustomerSite && !isCheapBrand && <ChatWidget />}
      </body>
    </html>
  );
}
