import type { Metadata } from 'next';
import { ContactForm } from '../_components/agency/ContactForm';
import { LandscapersNav } from '../_components/landscapers/LandscapersNav';
import { LandscapersFaq } from '../_components/landscapers/LandscapersFaq';
import { LandscapersStickyCta } from '../_components/landscapers/LandscapersStickyCta';

// ============================================================================
// Landscapers campaign landing page (/landscapers).
// ----------------------------------------------------------------------------
// Same offer and structure as the homepage (app/page.tsx) — a free custom
// website preview in 2 hours, launch for $99/mo only if you love it — but
// re-skinned LIGHT + GREEN to match the Facebook/Instagram ad creative and
// re-written to speak directly to landscaping / lawn-care owners. The green
// theme comes from the `.landing-green` root scope (see globals.css). The
// shared ContactForm is reused as-is so the pixel/CAPI lead tracking stays
// identical; nav, FAQ, and sticky CTA use light siblings under
// app/_components/landscapers/.
// ============================================================================

export const metadata: Metadata = {
  alternates: { canonical: '/landscapers' },
  title: {
    absolute: 'Free Website Preview for Landscapers — Only Pay If You Launch | StoopCraft',
  },
  description:
    'Landscapers: get a custom website preview built for your business at no cost, within 2 hours. Photo gallery, quote form, hosting, domain, and edits included for $99/mo — and only if you love it. No card, nothing owed if you walk away.',
};

// Portfolio work for the landscapers page — anonymized demo builds captured
// from the /websites/*/index.demo.html files (screenshots in
// public/landscapers/work/). Names, locations, and domains are fictional
// stand-ins so the work can be shown publicly. `href` is left empty until each
// demo is deployed to a live URL; while empty the card renders as a static
// showcase (no outbound link). Populate `href` to make a card clickable.
const LANDSCAPER_WORK: {
  name: string;
  type: string;
  city: string;
  img: string;
  href: string;
  domain: string;
  did: string;
}[] = [
  {
    name: 'Stonepath Landscaping',
    type: 'Landscaping & Lawn Care',
    city: 'Wexford, MS',
    img: '/landscapers/work/stonepath.webp',
    href: 'https://stonepath.stoopcraft.com/',
    domain: 'stonepathlandscaping.com',
    did: 'A trust-first landscaping site with clear service breakdowns, a project gallery, and instant quote capture — designed, written, and launched end to end.',
  },
  {
    name: 'Brightfield Lawn Care',
    type: 'Lawn Care & Maintenance',
    city: 'Rosewood, CT',
    img: '/landscapers/work/brightfield.webp',
    href: 'https://brightfield.stoopcraft.com/',
    domain: 'brightfieldlawncare.com',
    did: 'A clean lawn-care site with weekly & bi-weekly plans, a photo gallery, and fast quote requests — design, copy, hosting, and domain handled for them.',
  },
  {
    name: 'Harborstone Landscaping & Design',
    type: 'Landscaping & Outdoor Design',
    city: 'Kent County, MD',
    img: '/landscapers/work/harborstone.webp',
    href: 'https://harborstone.stoopcraft.com/',
    domain: 'harborstonelandscaping.com',
    did: 'An upscale outdoor-design site with a project gallery, service-area map, and detailed quote form — designed, written, and launched end to end.',
  },
];

const INCLUDED = [
  'Custom website design — never a template',
  'A photo gallery that shows off your work',
  'Quote & estimate request form',
  'Mobile-first on every screen',
  'Your service area on a real map',
  'Hosting, SSL & your own domain',
  'Unlimited edits — new photos & seasonal offers',
  'Basic SEO so nearby homeowners find you',
];

const TRUST_BADGES = ['No card required', 'Preview in 2 hours', 'We write the copy', 'Cancel anytime'];

// Solid-green primary button — green does the CTA work; a soft green-tinted
// shadow gives lift on the light background.
const greenBtn =
  'group inline-flex items-center justify-center gap-2 rounded-full bg-amber-accent px-7 py-4 text-sm font-semibold text-white shadow-[0_12px_30px_-12px_rgba(30,60,15,0.55)] transition-colors hover:bg-[var(--accent-hover)]';

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

// A single portfolio card. Renders as an outbound link when the demo has a live
// URL (`p.href`), otherwise as a static showcase card (screenshot + details, no
// dead link). The browser-chrome bar shows the demo's domain either way.
function WorkCard({ p }: { p: (typeof LANDSCAPER_WORK)[number] }) {
  const base =
    'group block overflow-hidden rounded-2xl border border-black/[0.08] bg-white shadow-sm transition-all duration-300';
  const inner = (
    <>
      <div className="flex items-center gap-1.5 border-b border-black/[0.06] bg-black/[0.03] px-3 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-black/15" />
        <span className="h-2.5 w-2.5 rounded-full bg-black/15" />
        <span className="h-2.5 w-2.5 rounded-full bg-black/15" />
        <span className="ml-2 inline-flex h-5 flex-1 items-center truncate rounded-md bg-black/[0.04] px-2.5 text-[10px] text-black/40">{p.domain}</span>
      </div>
      <div className="relative aspect-[16/10] overflow-hidden bg-neutral-100">
        {/* eslint-disable-next-line @next/next/no-img-element -- static portfolio thumbnail */}
        <img
          src={p.img}
          alt={`${p.name} website, built by StoopCraft`}
          loading="lazy"
          className="h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-[1.03]"
        />
      </div>
      <div className="p-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--accent-strong)]">
          {p.type} · {p.city}
        </p>
        <p className="mt-1 font-display text-xl font-medium text-[#161616]">{p.name}</p>
        <p className="mt-2 text-sm leading-relaxed text-[#161616]/60">{p.did}</p>
        {p.href && (
          <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-[#161616]/55 transition-colors group-hover:text-[#161616]">
            Visit the live site
            <Arrow />
          </span>
        )}
      </div>
    </>
  );

  return p.href ? (
    <a href={p.href} target="_blank" rel="noopener noreferrer" className={`${base} hover:-translate-y-1 hover:shadow-lg`}>
      {inner}
    </a>
  ) : (
    <div className={base}>{inner}</div>
  );
}

export default function Landscapers() {
  const showWork = LANDSCAPER_WORK.length > 0;

  return (
    <div className="landing-green min-h-screen overflow-x-clip bg-white font-sans text-[#161616] selection:bg-amber-accent/25">
      <LandscapersNav showWork={showWork} />
      <LandscapersStickyCta />

      {/* ===================================================================
          1 · HERO — light, landscaping photo on the right, form as the CTA
          =================================================================== */}
      <section className="relative overflow-hidden">
        {/* Desktop background photo — right side, faded into white on its inner
            edge so the copy and the white form card stay perfectly readable. */}
        <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[46%] lg:block">
          {/* eslint-disable-next-line @next/next/no-img-element -- decorative hero backdrop; next/image adds no value */}
          <img src="/landscapers/hero-home.webp" alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-white via-white/65 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white to-transparent" />
        </div>
        <div className="glow-green pointer-events-none absolute inset-0" />

        <div className="relative mx-auto max-w-7xl px-6 pt-28 pb-16 lg:pt-40 lg:pb-24">
          <div className="grid items-center gap-14 lg:grid-cols-[1.05fr_1fr]">
            <div className="text-center lg:text-left">
              {/* Mobile-only landscaping image (desktop uses the bg photo) */}
              {/* eslint-disable-next-line @next/next/no-img-element -- fixed hero image; next/image adds no value */}
              <img
                src="/landscapers/hero-home.webp"
                alt="A freshly landscaped home with a striped, manicured lawn"
                className="mb-8 h-44 w-full rounded-2xl object-cover shadow-lg shadow-black/10 sm:h-56 lg:hidden"
              />

              <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-amber-accent/25 bg-amber-accent/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-[var(--accent-strong)]">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-accent opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-accent" />
                </span>
                For landscapers &amp; lawn-care pros
              </span>

              <h1 className="font-display text-5xl font-light leading-[0.98] tracking-tight sm:text-6xl lg:text-7xl">
                Get a <span className="italic text-amber-accent">free</span> preview
                <br />
                of your new website.
              </h1>

              <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-[#161616]/65 lg:mx-0 lg:text-xl">
                We design and build it first — custom, never a template. See it live within 2 hours,
                with your work, your services, and a quote form. Launch it for{' '}
                <span className="font-semibold text-[var(--accent-strong)]">$99/month</span>{' '}
                only if you love it. Don&rsquo;t? Pay nothing.
              </p>

              <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row lg:items-start">
                <a href="#get-started" className={`${greenBtn} w-full sm:w-auto`}>
                  Request My Free Preview
                  <Arrow />
                </a>
                {showWork && (
                  <a
                    href="#work"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-black/15 px-7 py-4 text-sm font-semibold text-[#161616] transition-colors hover:bg-black/[0.04] sm:w-auto"
                  >
                    See Landscaper Sites We&rsquo;ve Built
                  </a>
                )}
              </div>

              <div className="mt-9 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 lg:justify-start">
                {TRUST_BADGES.map((b) => (
                  <span key={b} className="inline-flex items-center gap-1.5 text-sm text-[#161616]/60">
                    <span className="text-amber-accent">
                      <Check />
                    </span>
                    {b}
                  </span>
                ))}
              </div>

              <p className="mt-6 text-sm text-[#161616]/45">
                Built for landscaping, lawn care, hardscaping, and outdoor pros.
              </p>
            </div>

            {/* Lead form — primary conversion point, top of page */}
            <div id="get-started" className="mx-auto w-full max-w-md scroll-mt-28">
              <ContactForm
                heading="Request your free preview"
                subheading="Tell us about your landscaping business. We'll design a custom website preview and send it within 2 hours — no card, no obligation."
              />
            </div>
          </div>
        </div>
      </section>

      {/* ===================================================================
          2 · OUR WORK — only renders once landscaping demos are provided
          =================================================================== */}
      {showWork && (
        <section id="work" className="relative bg-[#f5f7f1] py-24 lg:py-32">
          <div className="mx-auto max-w-7xl px-6">
            <div className="mb-16 flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
              <div className="max-w-2xl">
                <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent-strong)]">Our work</p>
                <h2 className="font-display text-4xl font-light tracking-tight sm:text-5xl">
                  Websites for <span className="italic">landscapers.</span>
                </h2>
                <p className="mt-5 text-lg text-[#161616]/60">
                  Real websites we designed, wrote, and launched for landscaping businesses — each one
                  custom-built for their brand and services, never a template.
                </p>
              </div>
              <a href="#get-started" className="hidden shrink-0 text-sm font-semibold text-[var(--accent-strong)] transition-colors hover:text-[#161616] md:inline">
                Get yours free →
              </a>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {LANDSCAPER_WORK.map((p) => (
                <WorkCard key={p.domain} p={p} />
              ))}
            </div>

            <p className="mx-auto mt-14 max-w-2xl text-center text-sm leading-relaxed text-[#161616]/55">
              StoopCraft is a small US-based web design studio. You work directly with our team —
              not a marketplace or an automated template generator.
            </p>
          </div>
        </section>
      )}

      {/* ===================================================================
          3 · PROCESS — light
          =================================================================== */}
      <section id="process" className="mx-auto max-w-7xl px-6 py-24 lg:py-32">
        <div className="mx-auto mb-16 max-w-2xl text-center">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent-strong)]">How it works</p>
          <h2 className="font-display text-4xl font-light tracking-tight sm:text-5xl">
            Three steps. <span className="italic text-amber-accent">Zero risk.</span>
          </h2>
          <p className="mt-5 text-lg text-[#161616]/60">
            No calls to schedule, no upfront cost. Here&rsquo;s exactly what happens after you hit
            submit.
          </p>
        </div>

        <div className="relative grid gap-10 md:grid-cols-3">
          <div className="absolute left-[16.66%] right-[16.66%] top-7 hidden h-px border-t border-dashed border-black/15 md:block" />
          {[
            {
              n: '01',
              t: 'Tell us about your business',
              d: 'Send your business name and a current website, Google profile, or Facebook page. That’s all we need to get started.',
            },
            {
              n: '02',
              t: 'See your free preview in 2 hours',
              d: 'We design the site, write the copy, and build in a gallery of your work — then send a live preview link. Tell us what to change; revisions are included.',
            },
            {
              n: '03',
              t: 'Launch only if you love it',
              d: 'Go live for $99/month — hosting, domain, edits, and support all included. Don’t love it? Pay nothing and walk away.',
            },
          ].map((s) => (
            <div key={s.n} className="relative text-center md:text-left">
              <div className="relative mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full border border-amber-accent/40 bg-white font-display text-sm font-medium text-[var(--accent-strong)] shadow-sm md:mx-0">
                {s.n}
              </div>
              <h3 className="font-display text-xl font-medium">{s.t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#161616]/60">{s.d}</p>
            </div>
          ))}
        </div>

        <div className="mt-14 text-center">
          <a href="#get-started" className={greenBtn}>
            Request My Free Preview
            <Arrow />
          </a>
        </div>
      </section>

      {/* ===================================================================
          4 · PHOTO BANNER — full-width landscaping shot, green wash
          =================================================================== */}
      <section className="relative overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element -- decorative full-width banner */}
        <img src="/landscapers/curb-appeal.webp" alt="" className="h-72 w-full object-cover sm:h-80 lg:h-96" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#12280b]/85 via-[#12280b]/45 to-transparent" />
        <div className="absolute inset-0 flex items-center">
          <div className="mx-auto w-full max-w-7xl px-6">
            <div className="max-w-lg text-white">
              <h2 className="font-display text-3xl font-light leading-tight tracking-tight sm:text-4xl lg:text-5xl">
                Your work speaks for itself.
                <br />
                <span className="italic">Your website should too.</span>
              </h2>
              <p className="mt-4 max-w-md text-white/85">
                Homeowners judge you online before they ever call. We make sure what they see looks
                every bit as sharp as the yards you leave behind.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ===================================================================
          5 · INCLUDED + PRICING — warm-white section, dark price card
          =================================================================== */}
      <section id="pricing" className="relative overflow-hidden bg-[#f5f7f1] py-24 lg:py-32">
        <div className="relative mx-auto max-w-6xl px-6">
          <div className="mx-auto mb-16 max-w-2xl text-center">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent-strong)]">Everything included</p>
            <h2 className="font-display text-4xl font-light tracking-tight sm:text-5xl">
              One plan. <span className="italic">$99 a month.</span>
            </h2>
            <p className="mt-5 text-lg text-[#161616]/60">
              Free to design and build. You only start paying once your site is live and you&rsquo;re
              happy with it — and everything below is included, every month.
            </p>
          </div>

          <div className="grid items-center gap-10 lg:grid-cols-[1fr_1fr]">
            {/* Included list */}
            <ul className="grid gap-3.5 text-[15px] text-[#161616]/80 sm:grid-cols-2 lg:grid-cols-1 lg:gap-4">
              {INCLUDED.map((f) => (
                <li key={f} className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-accent/15 text-[var(--accent-strong)]">
                    <Check />
                  </span>
                  {f}
                </li>
              ))}
            </ul>

            {/* Pricing card — dark green surface for contrast on the light section */}
            <div className="relative rounded-3xl bg-[#16301a] p-8 text-white shadow-[0_30px_60px_-30px_rgba(0,0,0,0.5)] ring-1 ring-amber-accent/30 sm:p-10">
              <div className="mb-6 flex items-center justify-between">
                <p className="text-sm font-medium uppercase tracking-wider text-white/70">All-in-one website</p>
                <span className="rounded-full bg-amber-accent/20 px-2.5 py-1 text-xs font-medium text-amber-accent-soft">
                  No upfront cost
                </span>
              </div>

              <div className="flex items-end justify-between border-b border-white/10 pb-5">
                <div>
                  <p className="text-sm text-white/55">Design &amp; preview</p>
                  <p className="font-display text-3xl font-light tracking-tight">Free</p>
                </div>
                <p className="pb-1 text-sm text-white/40 line-through">$2,000+ value</p>
              </div>

              <div className="flex items-baseline gap-2 pt-5">
                <p className="text-sm text-white/55">then just</p>
                <span className="font-display text-5xl font-light tracking-tight text-amber-accent-soft">$99</span>
                <span className="text-lg text-white/70">/ month</span>
              </div>
              <p className="mt-1 text-sm text-white/55">Only when you launch. Cancel anytime.</p>

              <a href="#get-started" className={`${greenBtn} mt-8 w-full`}>
                Request My Free Preview
                <Arrow />
              </a>
              <p className="mt-4 text-center text-xs text-white/40">
                🔒 $0 upfront · No card until you launch · No long-term contracts
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ===================================================================
          6 · FAQ — light
          =================================================================== */}
      <section id="faq" className="mx-auto max-w-3xl px-6 py-24 lg:py-32">
        <div className="mb-12 text-center">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent-strong)]">FAQ</p>
          <h2 className="font-display text-4xl font-light tracking-tight sm:text-5xl">
            Questions, <span className="italic text-amber-accent">answered.</span>
          </h2>
        </div>
        <LandscapersFaq />
      </section>

      {/* ===================================================================
          7 · FINAL CTA + CONTACT — light, green wash
          =================================================================== */}
      <section id="contact" className="relative overflow-hidden bg-[#f5f7f1] py-24 lg:py-32">
        <div className="glow-green pointer-events-none absolute inset-0" />
        <div className="relative mx-auto max-w-7xl px-6">
          <div className="grid gap-14 lg:grid-cols-[1fr_1.05fr] lg:items-center">
            <div>
              <h2 className="font-display text-4xl font-light leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
                See your new website{' '}
                <span className="italic text-amber-accent">before you decide.</span>
              </h2>
              <p className="mt-6 max-w-md text-lg text-[#161616]/65">
                Tell us about your landscaping business and we&rsquo;ll design a custom preview within
                2 hours. Launch it for $99/month only if you love it — nothing owed if you don&rsquo;t.
              </p>
              <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2">
                {TRUST_BADGES.map((b) => (
                  <span key={b} className="inline-flex items-center gap-1.5 text-sm text-[#161616]/60">
                    <span className="text-amber-accent">
                      <Check />
                    </span>
                    {b}
                  </span>
                ))}
              </div>
            </div>
            <div id="start" className="scroll-mt-28">
              <ContactForm
                heading="Request your free preview"
                subheading="A custom website for your landscaping business, designed within 2 hours. No card, no obligation."
              />
            </div>
          </div>
        </div>
      </section>

      {/* ===================================================================
          8 · FOOTER — light
          =================================================================== */}
      <footer className="border-t border-black/10 bg-white px-6 py-16">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            <div className="lg:col-span-1">
              <div className="flex items-center gap-2 font-display text-xl font-semibold text-[#161616]">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-accent" />
                StoopCraft
              </div>
              <p className="mt-4 max-w-xs text-sm leading-relaxed text-[#161616]/60">
                A small US-based design studio building modern, high-converting websites for
                landscapers and outdoor pros who want to look the part and win more jobs.
              </p>
              <a
                href="#get-started"
                className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--accent-strong)] transition-colors hover:text-[#161616]"
              >
                Request my free preview →
              </a>
            </div>

            <div>
              <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-[#161616]/40">Explore</p>
              <ul className="space-y-2.5 text-sm text-[#161616]/60">
                {showWork && (
                  <li><a href="#work" className="transition-colors hover:text-[#161616]">Our work</a></li>
                )}
                <li><a href="#process" className="transition-colors hover:text-[#161616]">How it works</a></li>
                <li><a href="#pricing" className="transition-colors hover:text-[#161616]">Pricing</a></li>
                <li><a href="#faq" className="transition-colors hover:text-[#161616]">FAQ</a></li>
              </ul>
            </div>

            <div>
              <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-[#161616]/40">The offer</p>
              <ul className="space-y-2.5 text-sm text-[#161616]/60">
                <li>Free custom preview in 2 hours</li>
                <li>$99/mo only if you launch</li>
                <li>Hosting, domain &amp; edits included</li>
                <li>Cancel anytime, no contract</li>
              </ul>
            </div>

            <div>
              <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-[#161616]/40">Get in touch</p>
              <ul className="space-y-2.5 text-sm text-[#161616]/60">
                <li><a href="mailto:developer@example.com" className="transition-colors hover:text-[#161616]">developer@example.com</a></li>
              </ul>
              <p className="mb-3 mt-6 text-xs font-semibold uppercase tracking-wider text-[#161616]/40">Serving</p>
              <p className="text-sm text-[#161616]/60">Landscapers nationwide — remote-first, on your schedule.</p>
            </div>
          </div>

          <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-black/10 pt-8 text-sm text-[#161616]/45 sm:flex-row">
            <span>© {new Date().getFullYear()} StoopCraft. All rights reserved.</span>
            <div className="flex gap-6">
              <a href="/privacy" className="transition-colors hover:text-[#161616]">Privacy</a>
              <a href="/terms" className="transition-colors hover:text-[#161616]">Terms</a>
              <a href="/login" className="transition-colors hover:text-[#161616]">Customer portal</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
