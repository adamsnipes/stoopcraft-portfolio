import type { Metadata } from 'next';
import Link from 'next/link';
import { LandingGenerator } from '../_components/LandingGenerator';
import { ClaimSuccessModal } from '../_components/ClaimSuccessModal';
import { PRICING } from '@/lib/pricing';

export const metadata: Metadata = {
  title: {
    absolute: 'See Your Website in 30 Seconds — StoopCraft',
  },
  description:
    'Type your business name and watch a professional website generate from your real reviews and photos — no signup, no commitment.',
  alternates: { canonical: '/ai' },
};

export default function AiGenerator() {
  return (
    <div className="min-h-screen bg-cream-50 text-ink-900 font-sans selection:bg-amber-accent-soft/40">

      {/* Stripe-return confirmation. Renders nothing unless URL has
          ?claim_success=...; mounted at the top so it appears regardless
          of which section the user is scrolled to on return. */}
      <ClaimSuccessModal />

      {/* Nav */}
      <nav className="sticky top-0 z-30 backdrop-blur-md bg-cream-50/70 border-b border-ink-900/5">
        <div className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
          <Link href="/" className="flex items-center gap-2 font-display text-xl tracking-tight">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-accent" />
            <span className="font-semibold">Stoopcraft</span>
          </Link>
          <div className="flex items-center gap-6">
            <a href="#how-it-works" className="hidden sm:inline text-sm text-ink-700 hover:text-ink-900 transition-colors">
              How it works
            </a>
            <a href="#pricing" className="hidden sm:inline text-sm text-ink-700 hover:text-ink-900 transition-colors">
              Pricing
            </a>
            <Link
              href="/login"
              className="text-sm text-ink-700 hover:text-ink-900 transition-colors"
            >
              Customer portal
            </Link>
            <a
              href="#generator"
              className="hidden sm:inline-flex items-center px-4 py-2 rounded-full bg-ink-900 text-cream-50 text-sm font-medium hover:bg-ink-800 transition-colors"
            >
              See your site
            </a>
          </div>
        </div>
      </nav>

      {/* Hero — generator-first. Visitor types business name, picks from
          Google candidates, watches site render in an iframe ~30s later. */}
      <section id="generator" className="relative overflow-hidden bg-ink-900 text-cream-50">
        <div className="absolute inset-0 glow-amber pointer-events-none" />
        <div className="absolute inset-0 grid-texture pointer-events-none" />

        <div className="relative max-w-3xl mx-auto px-6 pt-16 pb-20 lg:pt-24 lg:pb-28 text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-cream-50/5 border border-cream-50/10 px-3 py-1 text-xs uppercase tracking-widest text-cream-100/80 mb-7">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-amber-accent-soft opacity-75 animate-ping" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-accent-soft" />
            </span>
            For local small businesses
          </span>

          <h1 className="font-display font-light text-5xl sm:text-6xl lg:text-7xl leading-[0.95] tracking-tight mb-5">
            See your website in{' '}
            <span className="italic font-normal">30 seconds.</span>
          </h1>

          <p className="text-cream-100/70 text-lg lg:text-xl leading-relaxed max-w-xl mx-auto mb-10">
            Type your business name. We&rsquo;ll generate a professional site using your real
            reviews and photos — no designers, no signup, just see it.
          </p>

          <LandingGenerator />

          <p className="mt-6 text-sm text-cream-100/50">
            No setup fee · Cancel anytime · {PRICING.starter.label}
          </p>
        </div>

        {/* Bottom fade into cream */}
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-cream-50/0 pointer-events-none" />
      </section>

      {/* Trust bar */}
      <section className="border-y border-ink-900/5 bg-cream-100/50 py-6 px-6">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-ink-700">
          <span className="font-medium text-ink-900">Built for small businesses</span>
          {[
            'Restaurants & cafés',
            'Beauty & grooming',
            'Home services',
            'Auto services',
            'Fitness & wellness',
            'Pet services',
            'Retail & boutiques',
            'Trades & repair',
          ].map((label, i, arr) => (
            <span key={label} className="inline-flex items-center gap-x-6">
              <span>{label}</span>
              {i < arr.length - 1 && <span className="text-ink-900/20">·</span>}
            </span>
          ))}
          <span className="text-ink-900/40">+ more</span>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="px-6 py-28 max-w-6xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-20">
          <p className="text-amber-accent text-xs font-semibold uppercase tracking-[0.2em] mb-4">The process</p>
          <h2 className="font-display font-light text-4xl sm:text-5xl tracking-tight mb-5">
            From <span className="italic">nothing</span> to live in under 30 mins.
          </h2>
          <p className="text-ink-700 text-lg">
            Three steps. No signup, no commitment — see it first.
          </p>
        </div>

        <div className="relative grid md:grid-cols-3 gap-12">
          {/* Connecting dotted line */}
          <div className="hidden md:block absolute top-6 left-[16.66%] right-[16.66%] h-px border-t border-dashed border-ink-900/15" />

          {[
            {
              num: '01',
              title: 'Find your business',
              desc: "Type your business name and city. We search Google and pull your real reviews and photos — no forms to fill.",
            },
            {
              num: '02',
              title: 'See it in 30 seconds',
              desc: 'Pick your listing and hit Build. We write copy, choose a design, and render your site right here on this page.',
            },
            {
              num: '03',
              title: 'Claim it and go live',
              desc: "Like what you see? Enter your domain and email, check out, and we handle everything else. Live within 30 mins.",
            },
          ].map((step) => (
            <div key={step.num} className="relative">
              <div className="relative w-12 h-12 rounded-full bg-cream-50 border border-ink-900/10 flex items-center justify-center font-display text-sm font-medium text-ink-900 mb-6 shadow-sm">
                {step.num}
                <span className="absolute -inset-1 rounded-full border border-amber-accent/20 -z-10" />
              </div>
              <h3 className="font-display text-xl font-medium mb-3">{step.title}</h3>
              <p className="text-ink-700 leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* What's included */}
      <section className="relative px-6 py-28 bg-cream-100/60 border-y border-ink-900/5">
        <div className="max-w-6xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <p className="text-amber-accent text-xs font-semibold uppercase tracking-[0.2em] mb-4">What you get</p>
            <h2 className="font-display font-light text-4xl sm:text-5xl tracking-tight mb-5">
              Everything <span className="italic">included.</span>
            </h2>
            <p className="text-ink-700 text-lg">
              No nickel-and-diming. One flat monthly fee, everything taken care of.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map(({ title, desc, icon }) => (
              <div
                key={title}
                className="group relative bg-cream-50 rounded-2xl p-7 border border-ink-900/5 hover:border-amber-accent/30 hover:-translate-y-1 transition-all duration-300 shadow-[0_1px_2px_rgba(0,0,0,0.02)] hover:shadow-[0_20px_40px_-20px_rgba(217,119,6,0.25)]"
              >
                <div className="w-10 h-10 rounded-xl bg-ink-900 text-cream-50 flex items-center justify-center mb-5 group-hover:bg-amber-accent transition-colors">
                  {icon}
                </div>
                <h3 className="font-display text-lg font-medium mb-2">{title}</h3>
                <p className="text-ink-700 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="px-6 py-28 max-w-5xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <p className="text-amber-accent text-xs font-semibold uppercase tracking-[0.2em] mb-4">Pricing</p>
          <p className="text-ink-700 text-xl">
            One simple monthly plan. No contracts, cancel anytime.
          </p>
        </div>

        <div className="max-w-md mx-auto">
          {/* Starter (monthly) */}
          <div className="relative">
            {/* gradient border */}
            <div className="absolute -inset-px rounded-3xl bg-gradient-to-b from-amber-accent-soft via-amber-accent to-ink-900 opacity-90" />
            <div className="relative h-full bg-cream-50 rounded-3xl p-9 flex flex-col">
              <div className="flex items-center justify-between mb-6">
                <p className="text-sm font-medium text-ink-700 uppercase tracking-wider">Starter</p>
                <span className="text-xs px-2.5 py-1 rounded-full bg-amber-accent/10 text-amber-accent font-medium">
                  Limited time offer
                </span>
              </div>
              <div className="flex items-baseline gap-1.5 mb-1">
                <span className="font-display text-6xl font-light tracking-tight">$49</span>
                <span className="text-ink-700 text-lg">/ month</span>
              </div>
              <p className="text-sm text-ink-700 mb-8">Everything below, billed monthly.</p>

              <ul className="space-y-3.5 mb-9 text-[15px] text-ink-700">
                {[
                  'Professional website',
                  'Mobile-friendly design',
                  'Hosting + SSL on a custom domain',
                  'Online booking integration',
                  'Photo gallery',
                  'Any updates you need',
                  'Priority support (24hr response)',
                  'Monthly content refresh',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span className="flex-shrink-0 mt-0.5 w-5 h-5 rounded-full bg-amber-accent/10 text-amber-accent flex items-center justify-center">
                      <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none">
                        <path d="M2.5 6.5L5 9L9.5 3.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              <a
                href="#generator"
                className="group mt-auto flex items-center justify-center gap-2 py-3.5 bg-ink-900 text-cream-50 rounded-full text-sm font-semibold hover:bg-ink-800 transition-colors"
              >
                Get started
                <svg className="w-4 h-4 transition-transform group-hover:translate-x-0.5" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8h10m0 0L8.5 3.5M13 8l-4.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>
            </div>
          </div>

        </div>
      </section>

      {/* Bottom CTA */}
      <section className="relative overflow-hidden bg-ink-900 text-cream-50 px-6 py-28">
        <div className="absolute inset-0 glow-amber pointer-events-none" />
        <div className="relative max-w-3xl mx-auto text-center">
          <h2 className="font-display font-light text-4xl sm:text-5xl tracking-tight mb-5">
            Ready to see <span className="italic">your</span> site?
          </h2>
          <p className="text-cream-100/70 text-lg mb-10 max-w-xl mx-auto">
            Type your business name and watch it appear in 30 seconds. No signup, no
            commitment — just look.
          </p>
          <a
            href="#generator"
            className="inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-gradient-to-b from-amber-accent-soft to-amber-accent text-ink-900 font-semibold rounded-full shadow-[0_8px_30px_-8px_rgba(245,158,11,0.6)] hover:shadow-[0_12px_40px_-8px_rgba(245,158,11,0.8)] hover:-translate-y-0.5 transition-all"
          >
            Build my site
            <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
              <path d="M3 8h10m0 0L8.5 3.5M13 8l-4.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-10 bg-cream-50 border-t border-ink-900/5">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-ink-700">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-amber-accent" />
            <span>© {new Date().getFullYear()} Stoopcraft</span>
          </div>
          <div className="flex gap-6 flex-wrap justify-center">
            <a href="/affiliates" className="hover:text-ink-900 transition-colors">Affiliate program</a>
            <a href="/privacy" className="hover:text-ink-900 transition-colors">Privacy</a>
            <a href="/terms" className="hover:text-ink-900 transition-colors">Terms</a>
            <a href="mailto:hello@stoopcraft.com" className="hover:text-ink-900 transition-colors">Contact</a>
          </div>
        </div>
      </footer>

    </div>
  );
}

const features = [
  {
    title: 'Professional design',
    desc: 'Looks great on phones and desktops. Clean, fast, no clutter.',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none">
        <path d="M3 5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5Z" stroke="currentColor" strokeWidth="1.5" />
        <path d="M3 7h14M7 17h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: 'Hosting included',
    desc: 'We handle servers, updates, and uptime. Nothing for you to manage.',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none">
        <path d="M4 11a6 6 0 0 1 12 0v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3Z" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="10" cy="11" r="1.5" fill="currentColor" />
      </svg>
    ),
  },
  {
    title: 'Your own domain',
    desc: 'Use a domain you already own, or we register a new one for you.',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5" />
        <path d="M3 10h14M10 3a10 10 0 0 1 0 14M10 3a10 10 0 0 0 0 14" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    title: 'Online booking',
    desc: 'Connect Cal.com or your existing booking tool in minutes.',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none">
        <rect x="3" y="5" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <path d="M3 8h14M7 3v4M13 3v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: 'Easy updates',
    desc: 'Need to change your hours or add a service? Just ask us.',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none">
        <path d="m4 13 2-2 6 6-2 2H4v-6Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="m12 5 3-3 3 3-3 3-3-3Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="m6 11 8-8" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    title: 'Real support',
    desc: 'You get a response from an actual person, not a help desk ticket.',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none">
        <path d="M3 10a7 7 0 0 1 14 0v4a3 3 0 0 1-3 3h-1v-6h4M3 14v-4h4v6H6a3 3 0 0 1-3-3v-3Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    ),
  },
];
