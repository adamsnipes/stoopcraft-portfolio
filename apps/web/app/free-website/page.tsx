import type { Metadata } from 'next';
import { AgencyNav } from '../_components/agency/AgencyNav';
import { ContactForm } from '../_components/agency/ContactForm';
import { FaqAccordion } from '../_components/agency/FaqAccordion';
import { StickyMobileCta } from '../_components/agency/StickyMobileCta';

// Previous homepage, moved here 2026-08-21 when the free-website funnel was
// promoted to . Kept live as the control for the conversion experiment: the
// two pages post identical payloads to /api/agency-inquiry with the same pixel,
// CAPI and Google Ads events, so lead counts stay comparable.
export const metadata: Metadata = {
  alternates: { canonical: '/free-website' },
  title: {
    absolute: 'StoopCraft — We Build Your Website First. Pay Only If You Love It.',
  },
  description:
    'StoopCraft designs a custom website preview for your business at no cost, within 2 hours. Launch it for $99/mo — hosting, domain, edits, and support included. No card, nothing owed if you walk away.',
};

// Portfolio work. These are anonymized demo builds of real client sites — the
// branding, names, and contact details are fictional stand-ins so the work can be
// shown publicly. Screenshots (public/work/clients/*.jpg) are captured from each
// demo deployment; cards link out to the live demo. Demo hosts are external to
// the app, so under the site CSP (frame-src 'self') these stay static images
// rather than live iframes like the /work/*.html demo pages.
const CLIENT_WORK = [
  {
    name: 'Nimbus Pest Defense',
    type: 'Pest Control',
    city: 'Fairmont, AZ',
    img: '/work/clients/nimbus-pest.jpg',
    href: 'https://nimbus.stoopcraft.com/',
    domain: 'nimbus.stoopcraft.com',
    did: 'Custom design, copy, lead form, hosting and domain — built and launched by StoopCraft.',
  },
  {
    name: 'Vista',
    type: 'Mobile Bar & Events',
    city: 'Fairview, CO',
    img: '/work/clients/vista.jpg',
    href: 'https://vista.stoopcraft.com/',
    domain: 'vista.stoopcraft.com',
    did: 'A brand-led site with quote capture, packages, and a blog — designed, written, and launched end to end.',
  },
  {
    name: 'Willow & Wave Laundry Co.',
    type: 'Laundry Pickup & Delivery',
    city: 'Alder Grove, VT',
    img: '/work/clients/willow-wave.jpg',
    href: 'https://willow-wave.stoopcraft.com/',
    domain: 'willow-wave.stoopcraft.com',
    did: 'A clean, trust-first site with online booking — design, copy, hosting, and domain handled for them.',
  },
  {
    name: 'Meridian Labor Services',
    type: 'Commercial Cleaning',
    city: 'Millbrook, SC',
    img: '/work/clients/meridian.jpg',
    href: 'https://meridian.stoopcraft.com/',
    domain: 'meridian.stoopcraft.com',
    did: 'A trust-first commercial cleaning site with quote capture — design, copy, hosting, and domain handled end to end.',
  },
  {
    name: 'Havenwood Community Outreach',
    type: 'Nonprofit · Community Support',
    city: 'Havenwood, PA',
    img: '/work/clients/havenwood.jpg',
    href: 'https://havenwood.stoopcraft.com/',
    domain: 'havenwood.stoopcraft.com',
    did: 'A warm, donor- and volunteer-focused site with clear ways to give and get involved — designed, written, and launched end to end.',
  },
  {
    name: 'Firebird Wings & Catering',
    type: 'Catering · Wings',
    city: 'Cedarville, GA',
    img: '/work/clients/firebird.jpg',
    href: 'https://firebird.stoopcraft.com/',
    domain: 'firebird.stoopcraft.com',
    did: 'A bold, appetite-first catering site with menu, packages, and quote capture — designed, written, and launched end to end.',
  },
];

const INCLUDED = [
  'Custom website design — never a template',
  'Conversion-focused copy, written for you',
  'Mobile-first on every screen',
  'Hosting + SSL included',
  'Your own custom domain',
  'Unlimited edits & updates',
  'Basic on-page SEO',
  'Real human support, anytime',
];

const TRUST_BADGES = ['No card required', 'Preview in 2 hours', 'We write the copy', 'Cancel anytime'];

// Solid-gold primary button. Gold does the work of the CTA; a soft neutral
// shadow gives lift without the metallic glow the brief asks us to avoid.
const goldBtn =
  'group inline-flex items-center justify-center gap-2 rounded-full bg-amber-accent px-7 py-4 text-sm font-semibold text-ink-900 shadow-[0_10px_30px_-12px_rgba(0,0,0,0.8)] transition-colors hover:bg-[#d99a12]';

export default function Home() {
  return (
    <div className="landing-gold min-h-screen overflow-x-clip bg-ink-900 font-sans text-cream-50 selection:bg-amber-accent/30">
      <AgencyNav />
      <StickyMobileCta />

      {/* ===================================================================
          1 · HERO — soft black, subtle texture, minimal gold
          =================================================================== */}
      <section className="relative overflow-hidden pt-32 pb-20 lg:pt-44 lg:pb-28">
        <div className="glow-amber pointer-events-none absolute inset-0" />
        <div className="grid-texture pointer-events-none absolute inset-0" />

        <div className="relative mx-auto max-w-7xl px-6">
          <div className="grid items-center gap-16 lg:grid-cols-[1.05fr_1fr]">
            <div className="text-center lg:text-left">
              <span className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-widest text-cream-100/80">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-accent-soft opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-accent-soft" />
                </span>
                A design studio, not a template factory
              </span>

              <h1 className="font-display text-5xl font-light leading-[0.98] tracking-tight sm:text-6xl lg:text-7xl">
                We build your website
                <br />
                <span className="italic text-amber-accent">first.</span>
              </h1>

              <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-cream-100/70 lg:mx-0 lg:text-xl">
                See a custom website preview for your business within 2 hours. We handle the
                design, copy, hosting, domain, and ongoing edits. Launch it for{' '}
                <span className="font-medium text-amber-accent">$99/month</span>{' '}
                only if you love it. Don&rsquo;t? Pay nothing.
              </p>

              <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row lg:items-start">
                <a href="#get-started" className={`${goldBtn} w-full sm:w-auto`}>
                  Request My Free Preview
                  <svg className="h-4 w-4 transition-transform group-hover:translate-x-0.5" viewBox="0 0 16 16" fill="none">
                    <path d="M3 8h10m0 0L8.5 3.5M13 8l-4.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </a>
                <a
                  href="#work"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/15 px-7 py-4 text-sm font-semibold text-cream-50 transition-colors hover:bg-white/5 sm:w-auto"
                >
                  See Websites We&rsquo;ve Built
                </a>
              </div>

              <div className="mt-9 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 lg:justify-start">
                {TRUST_BADGES.map((b) => (
                  <span key={b} className="inline-flex items-center gap-1.5 text-sm text-cream-100/60">
                    <svg className="h-3.5 w-3.5 text-amber-accent" viewBox="0 0 16 16" fill="none">
                      <path d="m3 8.5 3 3 7-8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {b}
                  </span>
                ))}
              </div>

              <p className="mt-6 text-sm text-cream-100/45">
                Websites launched for real businesses in pest control, events, laundry, landscaping,
                and more.
              </p>
            </div>

            {/* Lead form — primary conversion point, top of page */}
            <div id="get-started" className="mx-auto w-full max-w-md scroll-mt-28">
              <ContactForm
                heading="Request your free preview"
                subheading="Tell us about your business. We'll design a custom website preview and send it within 2 hours — no card, no obligation."
              />
            </div>
          </div>
        </div>
      </section>

      {/* ===================================================================
          2 · REAL WORK — warm-white section, proof below the hero
          =================================================================== */}
      <section id="work" className="relative bg-[#f7f4ed] py-24 text-[#161616] lg:py-32">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-16 flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
            <div className="max-w-2xl">
              <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-[#9a6d0f]">Our work</p>
              <h2 className="font-display text-4xl font-light tracking-tight sm:text-5xl">
                Real websites for <span className="italic">real businesses.</span>
              </h2>
              <p className="mt-5 text-lg text-[#161616]/60">
                Live sites we designed, wrote, and launched — each one custom-built, not a template.
                Click any one to see it in the wild.
              </p>
            </div>
            <a href="#get-started" className="hidden shrink-0 text-sm font-semibold text-[#9a6d0f] transition-colors hover:text-[#161616] md:inline">
              Get yours free →
            </a>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {CLIENT_WORK.map((p) => (
              <a
                key={p.domain}
                href={p.href}
                target="_blank"
                rel="noopener noreferrer"
                className="group block overflow-hidden rounded-2xl border border-black/[0.08] bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
              >
                {/* Browser chrome + real screenshot of the live site */}
                <div className="flex items-center gap-1.5 border-b border-black/[0.06] bg-black/[0.03] px-3 py-2.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-black/15" />
                  <span className="h-2.5 w-2.5 rounded-full bg-black/15" />
                  <span className="h-2.5 w-2.5 rounded-full bg-black/15" />
                  <span className="ml-2 inline-flex h-5 flex-1 items-center truncate rounded-md bg-black/[0.04] px-2.5 text-[10px] text-black/40">{p.domain}</span>
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
                <div className="p-6">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[#9a6d0f]">
                    {p.type} · {p.city}
                  </p>
                  <p className="mt-1 font-display text-xl font-medium text-[#161616]">{p.name}</p>
                  <p className="mt-2 text-sm leading-relaxed text-[#161616]/60">{p.did}</p>
                  <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-[#161616]/55 transition-colors group-hover:text-[#161616]">
                    Visit the live site
                    <svg className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" viewBox="0 0 16 16" fill="none">
                      <path d="M3 8h10m0 0L8.5 3.5M13 8l-4.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                </div>
              </a>
            ))}
          </div>

          {/* Small "who's behind StoopCraft" trust note — legitimizes the offer. */}
          <p className="mx-auto mt-14 max-w-2xl text-center text-sm leading-relaxed text-[#161616]/55">
            StoopCraft is a small US-based web design studio. You work directly with our team —
            not a marketplace or an automated template generator.
          </p>

          {/*
            TESTIMONIALS — build a client quote block here once you have real,
            attributable quotes (name, business, and ideally a link to their live
            site). Keep it specific ("built the preview in one day, handled the
            domain") over generic ("great work"). Left out for now rather than
            shipping placeholder quotes.
          */}
        </div>
      </section>

      {/* ===================================================================
          3 · PROCESS — soft black
          =================================================================== */}
      <section id="process" className="mx-auto max-w-7xl px-6 py-24 lg:py-32">
        <div className="mx-auto mb-16 max-w-2xl text-center">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-amber-accent">How it works</p>
          <h2 className="font-display text-4xl font-light tracking-tight sm:text-5xl">
            Three steps. <span className="italic text-amber-accent">Zero risk.</span>
          </h2>
          <p className="mt-5 text-lg text-cream-100/60">
            No calls to schedule, no upfront cost. Here&rsquo;s exactly what happens after you hit
            submit.
          </p>
        </div>

        <div className="relative grid gap-10 md:grid-cols-3">
          <div className="absolute left-[16.66%] right-[16.66%] top-7 hidden h-px border-t border-dashed border-white/15 md:block" />
          {[
            {
              n: '01',
              t: 'Tell us about your business',
              d: 'Send your business name and a current website, Google profile, or social page. That’s all we need to get started.',
            },
            {
              n: '02',
              t: 'See your free preview in 2 hours',
              d: 'We design the site and write the copy, then send a live preview link. Tell us what to change — revisions are included.',
            },
            {
              n: '03',
              t: 'Launch only if you love it',
              d: 'Go live for $99/month — hosting, domain, edits, and support all included. Don’t love it? Pay nothing and walk away.',
            },
          ].map((s) => (
            <div key={s.n} className="relative text-center md:text-left">
              <div className="relative mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full border border-amber-accent/40 bg-ink-800 font-display text-sm font-medium text-amber-accent md:mx-0">
                {s.n}
              </div>
              <h3 className="font-display text-xl font-medium">{s.t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-cream-100/55">{s.d}</p>
            </div>
          ))}
        </div>

        <div className="mt-14 text-center">
          <a href="#get-started" className={goldBtn}>
            Request My Free Preview
            <svg className="h-4 w-4 transition-transform group-hover:translate-x-0.5" viewBox="0 0 16 16" fill="none">
              <path d="M3 8h10m0 0L8.5 3.5M13 8l-4.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        </div>
      </section>

      {/* ===================================================================
          4 · INCLUDED + PRICING — warm-white section, dark price card
          =================================================================== */}
      <section id="pricing" className="relative overflow-hidden bg-[#f7f4ed] py-24 text-[#161616] lg:py-32">
        <div className="relative mx-auto max-w-6xl px-6">
          <div className="mx-auto mb-16 max-w-2xl text-center">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-[#9a6d0f]">Everything included</p>
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
                  <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-accent/20 text-[#9a6d0f]">
                    <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none">
                      <path d="m3 8.5 3 3 7-8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  {f}
                </li>
              ))}
            </ul>

            {/* Pricing card — dark elevated surface for contrast on the light section */}
            <div className="relative rounded-3xl bg-ink-800 p-8 text-cream-50 shadow-[0_30px_60px_-30px_rgba(0,0,0,0.5)] ring-1 ring-amber-accent/25 sm:p-10">
              <div className="mb-6 flex items-center justify-between">
                <p className="text-sm font-medium uppercase tracking-wider text-cream-100/70">All-in-one website</p>
                <span className="rounded-full bg-amber-accent/15 px-2.5 py-1 text-xs font-medium text-amber-accent-soft">
                  No upfront cost
                </span>
              </div>

              <div className="flex items-end justify-between border-b border-white/10 pb-5">
                <div>
                  <p className="text-sm text-cream-100/55">Design &amp; preview</p>
                  <p className="font-display text-3xl font-light tracking-tight">Free</p>
                </div>
                <p className="pb-1 text-sm text-cream-100/40 line-through">$2,000+ value</p>
              </div>

              <div className="flex items-baseline gap-2 pt-5">
                <p className="text-sm text-cream-100/55">then just</p>
                <span className="font-display text-5xl font-light tracking-tight text-amber-accent">$99</span>
                <span className="text-lg text-cream-100/70">/ month</span>
              </div>
              <p className="mt-1 text-sm text-cream-100/55">Only when you launch. Cancel anytime.</p>

              <a href="#get-started" className={`${goldBtn} mt-8 w-full`}>
                Request My Free Preview
                <svg className="h-4 w-4 transition-transform group-hover:translate-x-0.5" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8h10m0 0L8.5 3.5M13 8l-4.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>
              <p className="mt-4 text-center text-xs text-cream-100/40">
                🔒 $0 upfront · No card until you launch · No long-term contracts
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ===================================================================
          5 · FAQ — soft black
          =================================================================== */}
      <section id="faq" className="mx-auto max-w-3xl px-6 py-24 lg:py-32">
        <div className="mb-12 text-center">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-amber-accent">FAQ</p>
          <h2 className="font-display text-4xl font-light tracking-tight sm:text-5xl">
            Questions, <span className="italic text-amber-accent">answered.</span>
          </h2>
        </div>
        <FaqAccordion />
      </section>

      {/* ===================================================================
          6 · FINAL CTA + CONTACT — soft black
          =================================================================== */}
      <section id="contact" className="relative overflow-hidden py-24 lg:py-32">
        <div className="glow-amber pointer-events-none absolute inset-0" />
        <div className="relative mx-auto max-w-7xl px-6">
          <div className="grid gap-14 lg:grid-cols-[1fr_1.05fr] lg:items-center">
            <div>
              <h2 className="font-display text-4xl font-light leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
                See your new website{' '}
                <span className="italic text-amber-accent">before you decide.</span>
              </h2>
              <p className="mt-6 max-w-md text-lg text-cream-100/70">
                Tell us about your business and we&rsquo;ll design a custom preview within 2 hours.
                Launch it for $99/month only if you love it — nothing owed if you don&rsquo;t.
              </p>
              <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2">
                {TRUST_BADGES.map((b) => (
                  <span key={b} className="inline-flex items-center gap-1.5 text-sm text-cream-100/55">
                    <svg className="h-3.5 w-3.5 text-amber-accent" viewBox="0 0 16 16" fill="none">
                      <path d="m3 8.5 3 3 7-8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {b}
                  </span>
                ))}
              </div>
            </div>
            <div id="start" className="scroll-mt-28">
              <ContactForm
                heading="Request your free preview"
                subheading="A custom website preview for your business, designed within 2 hours. No card, no obligation."
              />
            </div>
          </div>
        </div>
      </section>

      {/* ===================================================================
          7 · FOOTER — soft black
          =================================================================== */}
      <footer className="border-t border-white/5 bg-ink-900 px-6 py-16">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            <div className="lg:col-span-1">
              <div className="flex items-center gap-2 font-display text-xl font-semibold">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-accent" />
                StoopCraft
              </div>
              <p className="mt-4 max-w-xs text-sm leading-relaxed text-cream-100/55">
                A small US-based design studio building modern, high-converting websites for
                businesses that want to look the part and win more customers.
              </p>
              <a
                href="#get-started"
                className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-amber-accent transition-colors hover:text-amber-accent-soft"
              >
                Request my free preview →
              </a>
            </div>

            <div>
              <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-cream-100/40">Explore</p>
              <ul className="space-y-2.5 text-sm text-cream-100/60">
                <li><a href="#work" className="transition-colors hover:text-cream-50">Our work</a></li>
                <li><a href="#process" className="transition-colors hover:text-cream-50">How it works</a></li>
                <li><a href="#pricing" className="transition-colors hover:text-cream-50">Pricing</a></li>
                <li><a href="#faq" className="transition-colors hover:text-cream-50">FAQ</a></li>
                <li><a href="/blog" className="transition-colors hover:text-cream-50">Blog</a></li>
              </ul>
            </div>

            <div>
              <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-cream-100/40">The offer</p>
              <ul className="space-y-2.5 text-sm text-cream-100/60">
                <li>Free custom preview in 2 hours</li>
                <li>$99/mo only if you launch</li>
                <li>Hosting, domain &amp; edits included</li>
                <li>Cancel anytime, no contract</li>
              </ul>
            </div>

            <div>
              <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-cream-100/40">Get in touch</p>
              <ul className="space-y-2.5 text-sm text-cream-100/60">
                <li><a href="mailto:developer@example.com" className="transition-colors hover:text-cream-50">developer@example.com</a></li>
              </ul>
              <p className="mb-3 mt-6 text-xs font-semibold uppercase tracking-wider text-cream-100/40">Serving</p>
              <p className="text-sm text-cream-100/60">Local businesses nationwide — remote-first, on your schedule.</p>
              <div className="mt-5 flex gap-3">
                {['Instagram', 'LinkedIn', 'X'].map((s) => (
                  <a
                    key={s}
                    href="#"
                    aria-label={s}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-cream-100/60 transition-colors hover:border-white/25 hover:text-cream-50"
                  >
                    <span className="text-xs font-medium">{s.charAt(0)}</span>
                  </a>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-white/5 pt-8 text-sm text-cream-100/45 sm:flex-row">
            <span>© {new Date().getFullYear()} StoopCraft. All rights reserved.</span>
            <div className="flex gap-6">
              <a href="/privacy" className="transition-colors hover:text-cream-50">Privacy</a>
              <a href="/terms" className="transition-colors hover:text-cream-50">Terms</a>
              <a href="/login" className="transition-colors hover:text-cream-50">Customer portal</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
