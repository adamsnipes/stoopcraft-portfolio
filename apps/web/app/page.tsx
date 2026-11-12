import type { Metadata } from 'next';
import Link from 'next/link';
import { Archivo, Source_Sans_3 } from 'next/font/google';
import { ClaimSuccessModal } from './_components/ClaimSuccessModal';
import { ApplyForm } from './_components/free/ApplyForm';
import { FreeNav } from './_components/free/FreeNav';
import { FreeFaq } from './_components/free/FreeFaq';
import { FreeStickyCta } from './_components/free/FreeStickyCta';

// ============================================================================
// Homepage (/). The free-website funnel, promoted from /free-website on
// 2026-08-21 after it beat the previous dark landing page's structure. The page
// it replaced now lives at /free-website as the control.
// ----------------------------------------------------------------------------
// Same offer as the previous landing page, restructured. Four deliberate
// differences from it (that page is still live at /free-website as the control):
//
//   1. Free design and preview lead, with the optional monthly launch plan
//      explained in the hero and both forms before visitors share details.
//      The monthly plan funds hosting, the domain, security, and edits.
//   2. Two-step form with an optional phone number (see ApplyForm) instead of
//      four required fields including a "we'll text you" phone.
//   3. Light palette (`.landing-light` in globals.css) — white and warm white
//      with gold reserved for CTAs. The dark/gold original reads agency; a
//      small-business owner arriving from an ad tends to trust white.
//   4. One repeated CTA ("Apply in 2 minutes") every two sections, and a nav
//      stripped of exits.
//
// Tracking is unchanged: ApplyForm posts the same body to /api/agency-inquiry,
// with the same Meta Pixel + CAPI dedupe id and Google Ads conversion, so leads
// from `/` and `/free-website` stay directly comparable in the ad accounts.
// ============================================================================

// ---------------------------------------------------------------------------
// Type system for this funnel, deliberately outside the
// Inter / Geist / Space Grotesk / Bricolage set that every generated landing
// page reaches for.
//
// Archivo is an American gothic in the Franklin lineage: square, tightly
// spaced, and strong enough to carry BOLD headlines. That matters, because the
// oversized-thin-weight headline with one italic word is the single loudest
// "made by a machine" tell in this layout, and a face that only works at 300
// forces you into it. Archivo works at 700.
//
// Source Sans 3 is the text face: humanist, warm, and built for long-form
// reading, so it stays comfortable under a headline face this square.
//
// Declared in this route rather than the root layout so the font files preload
// for the homepage only and no other page pays for them.
// ---------------------------------------------------------------------------
const archivo = Archivo({
  variable: '--font-archivo',
  subsets: ['latin'],
  axes: ['wdth'],
});

const sourceSans = Source_Sans_3({
  variable: '--font-source-sans',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  alternates: { canonical: '/' },
  title: {
    absolute: 'Get a Professional Website for Your Business, Free | StoopCraft',
  },
  description:
    'We design, write, and build your business website for free, then show you the finished site before you pay anything. Apply in 2 minutes. Love it? Keep it live for $99/month, hosting, domain, and unlimited edits included.',
  // Bing Webmaster Tools site verification. Scoped to the landing page only:
  // on the root layout it would be inherited by customer-served sites
  // (app/sites/[host]), since Next.js merges metadata down the chain.
  verification: {
    other: { 'msvalidate.01': 'C256A0D43F2DA038C01C3D33B3734CBE' },
  },
};

// ---------------------------------------------------------------------------
// PLACEHOLDER FIGURES — review before scaling ad spend.
//
// `sitesBuilt` is real: 13 claimed clients + 8 in active build + 38 archived
// builds under websites/ at the time of writing, rounded DOWN to 55.
// `agencyCostLow/High` is a market range for a custom small-business site, not
// a quote we sourced — keep it as a range and it stays defensible.
// `slotsPerWeek` is an operating policy (how many free builds the studio takes
// on), so set it to whatever is actually true and it stays true. `slotsLeft`
// is the same deal and it is the one figure here that goes stale on its own:
// it is how many of this week's builds are still open, so it needs bumping as
// the week fills. Set it back to `slotsPerWeek` when the week resets. If it
// stops being maintained, drop it and put `slotsPerWeek` back in the badge —
// a counter frozen at "2 left" for a month is worse than no counter. `monthly`
// is display copy only and must match PRICING.starter in lib/pricing.ts (what
// Stripe actually bills, and what /reps and /affiliates quote).
// Deliberately NOT here: invented review scores, invented client counts, or an
// invented acceptance rate. Those are what the reference funnel leans on and
// they are not ours to claim.
// ---------------------------------------------------------------------------
const STATS = {
  sitesBuilt: '55+',
  agencyCostLow: '$3,000',
  agencyCostHigh: '$8,000',
  slotsPerWeek: 13,
  slotsLeft: 7,
  previewHours: 2,
  monthly: '$99',
};

// Real industries from the client book (websites/claimed + websites/active_build).
// Verifiable, and it does the job invented testimonials would do.
const INDUSTRIES = [
  'Pest control',
  'Landscaping',
  'Construction',
  'Auto detailing',
  'Commercial cleaning',
  'Catering',
  'Photography',
  'Mobile bar & events',
  'Property upkeep',
  'Insurance',
  'Childcare',
  'Churches & nonprofits',
];

// Anonymized demo builds of real client work — branding, names, and contact
// details are fictional stand-ins so the work can be shown publicly. Also used
// by app/free-website; screenshots live in public/work/clients/.
const CLIENT_WORK = [
  {
    name: 'Nimbus Pest Defense',
    type: 'Pest Control',
    city: 'Fairmont, AZ',
    img: '/work/clients/nimbus-pest.jpg',
    href: 'https://nimbus.stoopcraft.com/',
    domain: 'nimbus.stoopcraft.com',
  },
  {
    name: 'Vista',
    type: 'Mobile Bar & Events',
    city: 'Fairview, CO',
    img: '/work/clients/vista.jpg',
    href: 'https://vista.stoopcraft.com/',
    domain: 'vista.stoopcraft.com',
  },
  {
    name: 'Willow & Wave Laundry Co.',
    type: 'Laundry Pickup & Delivery',
    city: 'Alder Grove, VT',
    img: '/work/clients/willow-wave.jpg',
    href: 'https://willow-wave.stoopcraft.com/',
    domain: 'willow-wave.stoopcraft.com',
  },
  {
    name: 'Meridian Labor Services',
    type: 'Commercial Cleaning',
    city: 'Millbrook, SC',
    img: '/work/clients/meridian.jpg',
    href: 'https://meridian.stoopcraft.com/',
    domain: 'meridian.stoopcraft.com',
  },
  {
    name: 'Havenwood Community Outreach',
    type: 'Nonprofit · Community Support',
    city: 'Havenwood, PA',
    img: '/work/clients/havenwood.jpg',
    href: 'https://havenwood.stoopcraft.com/',
    domain: 'havenwood.stoopcraft.com',
  },
  {
    name: 'Firebird Wings & Catering',
    type: 'Catering · Wings',
    city: 'Cedarville, GA',
    img: '/work/clients/firebird.jpg',
    href: 'https://firebird.stoopcraft.com/',
    domain: 'firebird.stoopcraft.com',
  },
];

const FEATURES = [
  {
    t: 'Built for phones first',
    d: 'Most people who look you up are on a phone. Your site is designed for that screen first and scaled up, not squeezed down.',
    icon: 'phone',
  },
  {
    t: 'Designed, not templated',
    d: 'A layout, palette, and typeface chosen for your trade. Nobody else gets handed the same site with their logo dropped in.',
    icon: 'design',
  },
  {
    t: 'Copy written for you',
    d: "You don't have to write a word. We research what you do and write the headlines, service descriptions, and calls to action.",
    icon: 'pen',
  },
  {
    t: 'Findable on Google',
    d: 'Page titles, descriptions, headings, image alt text, and a sitemap set up properly from day one so search engines can read you.',
    icon: 'search',
  },
  {
    t: 'Loads fast, stays up',
    d: 'Served from a global CDN with SSL and automatic backups. Slow sites lose visitors before the page finishes drawing.',
    icon: 'bolt',
  },
  {
    t: 'Edits handled for you',
    d: "New photos, a price change, updated hours. Email us and it's done. No dashboard to learn, no developer to hire.",
    icon: 'chat',
  },
];

const INCLUDED = [
  'Hosting, SSL & daily backups',
  'Your own custom domain',
  'Unlimited text & photo edits',
  'Ongoing design updates',
  'Contact & quote forms that email you',
  'Basic on-page SEO',
  'A real person to email, not a ticket queue',
  'No contract, cancel any time',
];

// ---------------------------------------------------------------------------
// Section surfaces, set as inline custom properties on the page root rather
// than in globals.css.
//
// Not a style preference — a workaround. Turbopack in this setup does not
// re-emit the compiled globals.css chunk when only a custom property value
// changes, so every tweak to these three needed a dev-server restart with the
// cache cleared, and several rounds of tuning silently showed the old colour.
// Declared here they hot-reload like any other TSX edit. The
// `bg-[var(--surface-band)]` / `text-[var(--on-band)]` utilities are still
// generated from the class names in the normal way; only the VALUES live here.
//
// `band`   the alternating charcoal section background
// `onBand` primary text on that background
// `inset`  subtle tint for chips and hovers INSIDE a white card, which would
//          look muddy at band strength
//
// Anything on a white card sitting inside a band section must pin its own text
// colour (`text-[#15120c]` on the card), or it inherits `onBand` and renders
// white on white.
// ---------------------------------------------------------------------------
const SURFACES = {
  '--surface-band': '#26211a',
  '--on-band': '#f6f3ec',
  '--surface-inset': '#f6f2e7',
} as React.CSSProperties;

// --- small shared bits -----------------------------------------------------

const Arrow = () => (
  <svg className="h-4 w-4 transition-transform group-hover:translate-x-0.5" viewBox="0 0 16 16" fill="none">
    <path d="M3 8h10m0 0L8.5 3.5M13 8l-4.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const Check = ({ className = 'h-3.5 w-3.5' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 16 16" fill="none">
    <path d="m3 8.5 3 3 7-8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ICONS: Record<string, React.ReactNode> = {
  phone: <path d="M8 3h8a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm3 15h2" strokeWidth="1.6" strokeLinecap="round" />,
  design: <path d="M4 7a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V7Zm0 4h16M10 11v9" strokeWidth="1.6" strokeLinecap="round" />,
  pen: <path d="m4 20 1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19l-4 1Z" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />,
  search: <path d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm6-2 4 4" strokeWidth="1.6" strokeLinecap="round" />,
  bolt: <path d="M13 3 5 14h6l-1 7 8-11h-6l1-7Z" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />,
  chat: <path d="M21 12a8 8 0 0 1-8 8H5l-2 2V12a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8Z" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />,
};

// Gold pill button — gold is the fill, near-black is the label. Gold as *text*
// on white would fail contrast; see the note in globals.css `.landing-light`.
const goldBtn =
  'group inline-flex items-center justify-center gap-2 rounded-full bg-amber-accent px-8 py-4 text-[15px] font-semibold text-[var(--accent-ink)] shadow-[0_14px_30px_-12px_rgba(125,86,7,0.55),0_2px_6px_-2px_rgba(21,18,12,0.28)] transition-colors hover:bg-[var(--accent-hover)]';

function Eyebrow({ children, onBand = false }: { children: React.ReactNode; onBand?: boolean }) {
  return (
    <p
      className={`mb-4 text-xs font-semibold uppercase tracking-[0.2em] ${
        onBand ? 'text-amber-accent-soft' : 'text-[var(--accent-strong)]'
      }`}
    >
      {children}
    </p>
  );
}

// Repeating CTA band. The reference funnel puts a CTA every two or three
// sections and never changes the wording — same idea here.
function CtaRow({ note, href = '#apply', onBand = false }: { note?: string; href?: string; onBand?: boolean }) {
  return (
    <div className="mt-14 text-center">
      <a href={href} className={goldBtn}>
        Apply in 2 minutes. Get your free website.
        <Arrow />
      </a>
      {note && (
        <p className={`mt-4 text-sm ${onBand ? 'text-white/55' : 'text-[#15120c]/50'}`}>{note}</p>
      )}
    </div>
  );
}

export default function FreeWebsite() {
  return (
    <div
      style={SURFACES}
      className={`${archivo.variable} ${sourceSans.variable} landing-light min-h-screen overflow-x-clip bg-white font-sans text-[#15120c] selection:bg-amber-accent/25`}
    >
      <ClaimSuccessModal />
      <FreeNav />
      <FreeStickyCta />

      {/* ===================================================================
          1 · HERO — free preview and optional launch price; form is the CTA
          =================================================================== */}
      <section className="relative overflow-hidden">
        <div className="glow-amber pointer-events-none absolute inset-0" />

        <div className="relative mx-auto max-w-7xl px-6 pt-28 pb-16 lg:pt-36 lg:pb-24">
          <div className="grid items-start gap-14 lg:grid-cols-[1.05fr_1fr]">
            <div className="text-center lg:pt-6 lg:text-left">
              {/* Scarcity badge — current weekly build availability. */}
              <div className="mb-6 flex flex-col items-center gap-2.5 lg:items-start">
                <span className="inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-1.5 rounded-full bg-[#15120c] py-1.5 pl-4 pr-1.5 text-[13px] font-semibold uppercase tracking-[0.12em] shadow-[0_12px_28px_-14px_rgba(21,18,12,0.8)] ring-1 ring-amber-accent/40">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-accent" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-accent" />
                  </span>
                  <span className="font-bold text-amber-accent-soft">
                    {`Only ${STATS.slotsLeft} build${STATS.slotsLeft === 1 ? '' : 's'} left this week`}
                  </span>
                  <span className="text-white/45">of {STATS.slotsPerWeek}</span>
                </span>
              </div>

              <h1 className="font-display text-[2.6rem] font-bold leading-[1.03] tracking-[-0.03em] sm:text-[3.6rem] lg:text-[4rem]">
                Get a professional
                <br />
                website for your
                <br />
                business, <span className="text-[var(--accent-strong)]">free.</span>
              </h1>

              <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-[#15120c]/65 lg:mx-0 lg:text-xl">
                We design, write, and build your website for free. See the finished preview before
                you decide. Choose to launch? It&rsquo;s {STATS.monthly}/month for hosting, your
                domain, security, and unlimited edits. Pass on the preview and you owe nothing.
              </p>

              <div className="mt-8 grid gap-2.5 text-left sm:mx-auto sm:max-w-md lg:mx-0">
                {[
                  'Free to design, write, and build. No card, ever, to apply.',
                  `Your finished site, live to look at, in about ${STATS.previewHours} hours`,
                  'Takes 2 minutes to apply and nothing more from you',
                ].map((b) => (
                  <span key={b} className="flex items-start gap-2.5 text-[15px] text-[#15120c]/75">
                    <span className="mt-[3px] inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-accent/20 text-[var(--accent-strong)]">
                      <Check className="h-3 w-3" />
                    </span>
                    {b}
                  </span>
                ))}
              </div>

              <p className="mt-8 text-sm text-[#15120c]/45">
                {STATS.sitesBuilt} websites designed and launched for small businesses across the US.
              </p>
            </div>

            {/* Application form — the only conversion point above the fold. */}
            <div id="apply" className="mx-auto w-full max-w-md scroll-mt-24">
              <ApplyForm formLocation="hero" />
            </div>
          </div>
        </div>
      </section>

      {/* ===================================================================
          2 · INDUSTRY STRIP — real client book, doing social-proof duty
          =================================================================== */}
      <section className="bg-[var(--surface-band)] text-[var(--on-band)] py-8">
        <div className="mx-auto max-w-6xl px-6">
          <p className="mb-5 text-center text-xs font-semibold uppercase tracking-[0.18em] text-white/45">
            Websites we&rsquo;ve built, by trade
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {INDUSTRIES.map((i) => (
              <span
                key={i}
                className="rounded-full border border-white/12 bg-white/[0.06] px-3.5 py-1.5 text-sm text-white/80"
              >
                {i}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ===================================================================
          3 · THE MATH — free build vs. what it normally costs
          =================================================================== */}
      <section className="mx-auto max-w-6xl px-6 py-20 lg:py-28">
        <div className="mx-auto mb-14 max-w-2xl text-center">
          <Eyebrow>The short version</Eyebrow>
          <h2 className="font-display text-[2.15rem] font-bold leading-[1.08] tracking-[-0.03em] sm:text-[2.9rem]">
            A website is the cheapest thing you can do
            <br className="hidden sm:block" /> to look like a{' '}
            <span className="text-[var(--accent-strong)]">real business.</span>
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-[#15120c]/60">
            People check you online before they call. Stanford&rsquo;s Web Credibility Research found
            roughly three quarters of people judge a company&rsquo;s credibility on its website
            design alone. A business with no site, or a site from 2011, gets judged too.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-3">
          {[
            { k: STATS.sitesBuilt, v: 'Websites we’ve designed and launched', tone: 'plain' },
            { k: `${STATS.agencyCostLow}–${STATS.agencyCostHigh}`, v: 'What an agency typically charges to build one', tone: 'plain' },
            { k: '$0', v: 'What we charge you to build yours', tone: 'gold' },
          ].map((s) => (
            <div
              key={s.v}
              className={`rounded-2xl border p-7 text-center ${
                s.tone === 'gold'
                  ? 'border-amber-accent/40 bg-amber-accent/10'
                  : 'border-black/[0.07] bg-[var(--surface-inset)]'
              }`}
            >
              <p
                className={`font-display text-[2.15rem] font-bold leading-[1.08] tracking-[-0.03em] sm:text-[2.9rem] ${
                  s.tone === 'gold' ? 'text-[var(--accent-strong)]' : 'text-[#15120c]'
                }`}
              >
                {s.k}
              </p>
              <p className="mt-3 text-sm leading-relaxed text-[#15120c]/60">{s.v}</p>
            </div>
          ))}
        </div>

        <CtaRow note="No card required. Nothing owed if you pass on the finished site." />
      </section>

      {/* ===================================================================
          4 · OUR WORK — real builds, the proof the reference funnel fakes
          =================================================================== */}
      <section id="work" className="bg-[var(--surface-band)] text-[var(--on-band)] py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto mb-14 max-w-2xl text-center">
            <Eyebrow onBand>Our work</Eyebrow>
            <h2 className="font-display text-[2.15rem] font-bold leading-[1.08] tracking-[-0.03em] sm:text-[2.9rem]">
              This is what <span className="text-amber-accent-soft">free</span> looks
              like.
            </h2>
            <p className="mt-5 text-lg text-white/65">
              Live sites we designed, wrote, and launched end to end. Open any of them. They work
              the same on your phone.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {CLIENT_WORK.map((p) => (
              <a
                key={p.domain}
                href={p.href}
                target="_blank"
                rel="noopener noreferrer"
                className="group block overflow-hidden rounded-2xl border border-black/[0.07] bg-white text-[#15120c] shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
              >
                <div className="flex items-center gap-1.5 border-b border-black/[0.06] bg-black/[0.03] px-3 py-2.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-black/15" />
                  <span className="h-2.5 w-2.5 rounded-full bg-black/15" />
                  <span className="h-2.5 w-2.5 rounded-full bg-black/15" />
                  <span className="ml-2 inline-flex h-5 flex-1 items-center truncate rounded-md bg-black/[0.04] px-2.5 text-[10px] text-black/40">
                    {p.domain}
                  </span>
                </div>
                <div className="relative aspect-[16/10] overflow-hidden bg-neutral-100">
                  {/* eslint-disable-next-line @next/next/no-img-element -- static, fixed-size portfolio thumbnail; next/image adds no value here */}
                  <img
                    src={p.img}
                    alt={`${p.name} website, built by StoopCraft`}
                    loading="lazy"
                    className="h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                </div>
                <div className="flex items-center justify-between gap-3 px-5 py-4">
                  <div className="min-w-0">
                    <p className="truncate font-display text-lg font-semibold tracking-[-0.02em] text-[#15120c]">{p.name}</p>
                    <p className="truncate text-xs font-semibold uppercase tracking-wider text-[var(--accent-strong)]">
                      {p.type} · {p.city}
                    </p>
                  </div>
                  <span className="shrink-0 text-[#15120c]/35 transition-colors group-hover:text-[#15120c]">
                    <Arrow />
                  </span>
                </div>
              </a>
            ))}
          </div>

          <p className="mx-auto mt-10 max-w-2xl text-center text-sm leading-relaxed text-white/50">
            These are anonymized versions of real client builds. The branding and contact details
            are stand-ins so we can show the work publicly without publishing a customer&rsquo;s
            business.
          </p>

          <CtaRow onBand />
        </div>
      </section>

      {/* ===================================================================
          5 · HOW IT WORKS — three steps, no call to book
          =================================================================== */}
      <section id="how" className="mx-auto max-w-6xl px-6 py-20 lg:py-28">
        <div className="mx-auto mb-16 max-w-2xl text-center">
          <Eyebrow>How it works</Eyebrow>
          <h2 className="font-display text-[2.15rem] font-bold leading-[1.08] tracking-[-0.03em] sm:text-[2.9rem]">
            Three steps. <span className="text-[var(--accent-strong)]">No sales call.</span>
          </h2>
          <p className="mt-5 text-lg text-[#15120c]/60">
            You never get put on a calendar or pitched on a Zoom. Here&rsquo;s the whole thing.
          </p>
        </div>

        <div className="relative grid gap-10 md:grid-cols-3">
          <div className="absolute left-[16.66%] right-[16.66%] top-7 hidden h-px border-t border-dashed border-black/15 md:block" />
          {[
            {
              n: '01',
              t: 'Apply in 2 minutes',
              d: 'Pick your trade, tell us your business name and where to send it. That is genuinely all we need. If you have a Google listing or a Facebook page, we pull the rest ourselves.',
            },
            {
              n: '02',
              t: 'We build the whole site',
              d: `A designer takes it the same day. In about ${STATS.previewHours} hours you get a link to a finished, live website. Real design, real copy, your services, working contact form.`,
            },
            {
              n: '03',
              t: 'You decide, after seeing it',
              d: `Want changes? Say so and we keep revising, free. Want it live on your own domain? Activate it for ${STATS.monthly}/month, everything included. Not for you? Nothing happens and nothing is owed.`,
            },
          ].map((s) => (
            <div key={s.n} className="relative text-center md:text-left">
              <div className="relative mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full border border-amber-accent/45 bg-white font-display text-sm font-semibold text-[var(--accent-strong)] md:mx-0">
                {s.n}
              </div>
              <h3 className="font-display text-xl font-semibold tracking-[-0.02em]">{s.t}</h3>
              <p className="mt-2.5 text-[15px] leading-relaxed text-[#15120c]/60">{s.d}</p>
            </div>
          ))}
        </div>

        <CtaRow href="#apply-2" />
      </section>

      {/* ===================================================================
          6 · WHAT YOU GET — feature grid
          =================================================================== */}
      <section className="bg-[var(--surface-band)] text-[var(--on-band)] py-20 lg:py-28">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto mb-14 max-w-2xl text-center">
            <Eyebrow onBand>What you get</Eyebrow>
            <h2 className="font-display text-[2.15rem] font-bold leading-[1.08] tracking-[-0.03em] sm:text-[2.9rem]">
              A website you&rsquo;d have{' '}
              <span className="text-amber-accent-soft">paid for.</span>
            </h2>
            <p className="mt-5 text-lg text-white/65">
              Free doesn&rsquo;t mean a stripped-down starter page. It&rsquo;s the same build we
              charge agencies&rsquo; rates to do. We just don&rsquo;t charge you for it.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.t} className="rounded-2xl border border-black/[0.07] bg-white p-7 text-[#15120c]">
                <span className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-amber-accent/15 text-[var(--accent-strong)]">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
                    {ICONS[f.icon]}
                  </svg>
                </span>
                <h3 className="font-display text-lg font-semibold tracking-[-0.02em]">{f.t}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-[#15120c]/60">{f.d}</p>
              </div>
            ))}
          </div>

          <CtaRow href="#apply-2" onBand />
        </div>
      </section>

      {/* ===================================================================
          7 · WHY FREE — the objection that stops everyone, answered plainly.
          First place the page states the price; the pricing block below
          spells it out in full.
          =================================================================== */}
      <section id="why-free" className="mx-auto max-w-4xl px-6 py-20 lg:py-28">
        <div className="rounded-3xl border border-black/[0.07] bg-[#15120c] p-9 text-white sm:p-14">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-amber-accent-soft">
            The honest part
          </p>
          <h2 className="font-display text-[2rem] font-bold leading-[1.08] tracking-[-0.03em] sm:text-[2.5rem]">
            Why would anyone build a website{' '}
            <span className="text-amber-accent-soft">for free?</span>
          </h2>

          <div className="mt-7 space-y-5 text-[17px] leading-relaxed text-white/70">
            <p>
              Because charging {STATS.agencyCostLow} to {STATS.agencyCostHigh}{' '} up front is how
              most agencies lose the small businesses they&rsquo;d be best for. Owners can&rsquo;t
              justify a four-figure guess, so they put it off another year and keep sending people
              to a Facebook page.
            </p>
            <p>
              So we flipped it. We eat the build cost, show you the finished website, and make our
              money on the part that actually recurs: the monthly plan that keeps it live. That
              plan is <span className="font-semibold text-white">{`${STATS.monthly} a month`}</span>{' '}
              and covers hosting, your domain, security, and unlimited edits whenever you need
              them.
            </p>
            <p>
              If the site is good, you launch it and we earn for years. If it isn&rsquo;t, we spent a
              few hours and you owe nothing. That asymmetry is deliberate. It&rsquo;s the only thing
              keeping us honest about quality, because we don&rsquo;t get paid until you actually
              like it.
            </p>
          </div>

          <div className="mt-9 grid gap-3 sm:grid-cols-2">
            {['No setup fee', 'No card to apply', 'No contract', 'Cancel any time'].map((b) => (
              <span key={b} className="flex items-center gap-2.5 text-[15px] text-white/80">
                <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-accent/25 text-amber-accent-soft">
                  <Check className="h-3 w-3" />
                </span>
                {b}
              </span>
            ))}
          </div>

          <a
            href="#apply-2"
            className="group mt-9 inline-flex w-full items-center justify-center gap-2 rounded-full bg-amber-accent px-8 py-4 text-[15px] font-semibold text-[var(--accent-ink)] transition-colors hover:bg-[var(--accent-hover)] sm:w-auto"
          >
            Apply in 2 minutes. Get your free website.
            <Arrow />
          </a>
        </div>
      </section>

      {/* ===================================================================
          8 · PRICING — full disclosure, deliberately this far down
          =================================================================== */}
      <section
        id="pricing"
        className="bg-[var(--surface-band)] text-[var(--on-band)] py-20 lg:py-28"
      >
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto mb-14 max-w-2xl text-center">
            <Eyebrow onBand>If you decide to launch</Eyebrow>
            <h2 className="font-display text-[2.15rem] font-bold leading-[1.08] tracking-[-0.03em] sm:text-[2.9rem]">
              One plan. <span className="text-amber-accent-soft">{STATS.monthly} a month.</span>
            </h2>
            <p className="mt-5 text-lg text-white/65">
              Only after you&rsquo;ve seen the finished site and said yes. There is no version of
              this where you get billed for something you didn&rsquo;t choose.
            </p>
          </div>

          <div className="grid items-center gap-10 lg:grid-cols-2">
            <ul className="grid gap-3.5 text-[15px] text-white/80 sm:grid-cols-2 lg:grid-cols-1 lg:gap-4">
              {INCLUDED.map((f) => (
                <li key={f} className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-accent/25 text-amber-accent-soft">
                    <Check />
                  </span>
                  {f}
                </li>
              ))}
            </ul>

            <div className="rounded-3xl border border-black/[0.07] bg-white p-8 text-[#15120c] shadow-[0_28px_70px_-40px_rgba(21,18,12,0.5)] sm:p-10">
              <div className="mb-6 flex items-center justify-between">
                <p className="text-sm font-medium uppercase tracking-wider text-[#15120c]/60">
                  Everything, one price
                </p>
                <span className="rounded-full bg-amber-accent px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-[var(--accent-ink)]">
                  No setup fee
                </span>
              </div>

              <div className="flex items-end justify-between border-b border-black/[0.08] pb-5">
                <div>
                  <p className="text-sm text-[#15120c]/55">Design, copy &amp; build</p>
                  <p className="font-display text-3xl font-bold tracking-[-0.03em]">Free</p>
                </div>
                <p className="pb-1 text-sm text-[#15120c]/40 line-through">
                  {STATS.agencyCostLow}+ elsewhere
                </p>
              </div>

              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 pt-5">
                <p className="text-sm text-[#15120c]/55">then</p>
                <span className="font-display text-5xl font-bold tracking-[-0.03em] text-[var(--accent-strong)]">
                  {STATS.monthly}
                </span>
                <span className="text-lg text-[#15120c]/60">/ month</span>
              </div>
              <p className="mt-1.5 text-sm text-[#15120c]/55">
                Only if you activate it, starting the day you launch. Cancel any time. $0 upfront.
              </p>

              <a href="#apply-2" className={`${goldBtn} mt-8 w-full`}>
                Apply in 2 minutes
                <Arrow />
              </a>
              <p className="mt-4 text-center text-xs text-[#15120c]/45">
                🔒 No card to apply · No contract · Nothing owed if you pass
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ===================================================================
          9 · CAPACITY + HAND-HOLDING — scarcity that's actually true, and
          the reassurance non-technical owners need before applying
          =================================================================== */}
      <section className="mx-auto max-w-6xl px-6 py-20 lg:py-28">
        <div className="grid gap-8 md:grid-cols-2">
          <div className="rounded-3xl border border-amber-accent/30 bg-amber-accent/[0.07] p-9 sm:p-10">
            <p className="font-display text-5xl font-bold tracking-[-0.03em] text-[var(--accent-strong)]">
              {STATS.slotsPerWeek}
            </p>
            <h3 className="mt-3 font-display text-[1.6rem] font-bold leading-tight tracking-[-0.02em]">
              free builds a week
            </h3>
            <p className="mt-4 text-[15px] leading-relaxed text-[#15120c]/65">
              We&rsquo;re a small studio and every site is designed by a person, so we cap how many
              free builds we take on at once. When the week fills up, applications roll to the next
              one, and we&rsquo;ll tell you where you sit rather than leave you guessing.
            </p>
          </div>

          <div className="rounded-3xl border border-black/[0.07] bg-[var(--surface-inset)] p-9 sm:p-10">
            <span className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white text-[var(--accent-strong)]">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
                {ICONS.chat}
              </svg>
            </span>
            <h3 className="font-display text-[1.6rem] font-bold leading-tight tracking-[-0.02em]">
              You don&rsquo;t need to know anything technical
            </h3>
            <p className="mt-4 text-[15px] leading-relaxed text-[#15120c]/65">
              Most owners we build for have never had a website made before. There&rsquo;s nothing to
              install, no dashboard to learn, and no jargon coming at you. Send us your business name
              and we take it from there: domain, hosting, writing, all of it.
            </p>
          </div>
        </div>

        <CtaRow href="#apply-2" />
      </section>

      {/* ===================================================================
          10 · FAQ
          =================================================================== */}
      <section id="faq" className="bg-[var(--surface-band)] text-[var(--on-band)] py-20 lg:py-28">
        <div className="mx-auto max-w-3xl px-6">
          <div className="mb-12 text-center">
            <Eyebrow onBand>Before you apply</Eyebrow>
            <h2 className="font-display text-[2.15rem] font-bold leading-[1.08] tracking-[-0.03em] sm:text-[2.9rem]">
              The questions everyone{' '}
              <span className="text-amber-accent-soft">asks first.</span>
            </h2>
          </div>
          <FreeFaq />
        </div>
      </section>

      {/* ===================================================================
          11 · CLOSING APPLICATION
          =================================================================== */}
      <section className="relative overflow-hidden py-20 lg:py-28">
        <div className="glow-amber pointer-events-none absolute inset-0" />
        <div className="relative mx-auto max-w-7xl px-6">
          <div className="grid gap-14 lg:grid-cols-[1fr_1.05fr] lg:items-center">
            <div className="text-center lg:text-left">
              <h2 className="font-display text-[2.4rem] font-bold leading-[1.04] tracking-[-0.03em] sm:text-[3.1rem] lg:text-[3.4rem]">
                See the website first.
                <br />
                <span className="text-[var(--accent-strong)]">Decide after.</span>
              </h2>
              <p className="mx-auto mt-6 max-w-md text-lg leading-relaxed text-[#15120c]/65 lg:mx-0">
                Two minutes to apply. About {STATS.previewHours} hours until a finished website is
                sitting in your inbox. Nothing owed either way.
              </p>
              <div className="mt-8 grid gap-2.5 text-left sm:mx-auto sm:max-w-md lg:mx-0">
                {[
                  'Free to design, write, and build',
                  'No card, no deposit, no contract',
                  `${STATS.monthly}/month to activate, only if you choose to launch`,
                ].map((b) => (
                  <span key={b} className="flex items-start gap-2.5 text-[15px] text-[#15120c]/75">
                    <span className="mt-[3px] inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-accent/20 text-[var(--accent-strong)]">
                      <Check className="h-3 w-3" />
                    </span>
                    {b}
                  </span>
                ))}
              </div>
            </div>
            <div id="apply-2" className="mx-auto w-full max-w-md scroll-mt-24">
              <ApplyForm
                heading="Apply for your free website"
                subheading="Two questions, then your details. A designer picks it up the same day."
                formLocation="footer"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ===================================================================
          12 · FOOTER — deliberately minimal; every link is an exit
          =================================================================== */}
      <footer className="border-t border-black/[0.07] bg-white px-6 py-12 pb-24 lg:pb-12">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-5 text-center sm:flex-row sm:justify-between sm:text-left">
          <div className="flex items-center gap-2 font-display text-lg font-semibold">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-accent" />
            StoopCraft
          </div>
          <p className="max-w-md text-sm text-[#15120c]/50">
            A small US-based web design studio. You work directly with our team, not a marketplace
            and not a template generator.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-5 text-sm text-[#15120c]/55">
            <a href="mailto:developer@example.com" className="transition-colors hover:text-[#15120c]">
              Email us
            </a>
            <Link href="/blog" className="transition-colors hover:text-[#15120c]">
              Blog
            </Link>
            <a href="/privacy" className="transition-colors hover:text-[#15120c]">
              Privacy
            </a>
            <a href="/terms" className="transition-colors hover:text-[#15120c]">
              Terms
            </a>
          </div>
        </div>
        <p className="mx-auto mt-8 max-w-7xl text-center text-xs text-[#15120c]/35 sm:text-left">
          © {new Date().getFullYear()} StoopCraft. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
