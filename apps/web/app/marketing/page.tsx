import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { MarketingLeadForm } from '../_components/marketing/MarketingLeadForm';

// Served from public/ at the site root. Intrinsic size is 2172×724 (~3:1);
// next/image needs the real dimensions, then the className scales by height.
const LOGO_SRC = '/stoopcraft-marketing-logo-v2.png';

export const metadata: Metadata = {
  title: {
    absolute: 'StoopCraft Marketing — Done-For-You Ads for Local Businesses',
  },
  description:
    'Your competitors are running ads. Why aren’t you? Done-for-you ads for local businesses — we build, launch, and manage the campaigns that bring you more leads and calls. 3-day free trial, no risk, no obligation. $499/mo after, cancel anytime.',
  alternates: { canonical: '/marketing' },
  openGraph: {
    type: 'website',
    url: 'https://stoopcraft.com/marketing',
    title: 'StoopCraft Marketing — Done-For-You Ads for Local Businesses',
    description:
      'We build and run your ad campaigns for you. 3-day free trial, no obligation. $499/mo after, cancel anytime.',
  },
};

// StoopCraft Marketing — the ad-management funnel. Distinct navy + gold look
// (matched to the ad creative), separate from the cobalt homepage. Single-page,
// lead-focused: every section funnels to the form / #book anchor. Server
// component; the only client piece is MarketingLeadForm.

// ---------------------------------------------------------------------------
// Small presentational helpers (server components, no JS shipped).
// ---------------------------------------------------------------------------

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-gold-400/30 bg-gold-400/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-gold-300">
      {children}
    </span>
  );
}

function CheckPin({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="11" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
      <path d="m7 12 3.5 3.5L17 8.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Concrete, no-hype breakdown of the trial so it feels real and removes
// uncertainty for cold traffic — deliberately describes actions we take, not
// results we promise.
const TRIAL_STEPS = [
  'We review your business and who your best customers are',
  'We create your first ad campaign — copy and creative',
  'We set up targeting for your local service area',
  'We launch your ads with a budget you approve',
  'We track the calls, messages, and form fills they bring in',
  'You decide if you want to continue — no pressure',
];

const INCLUDED = [
  { title: 'Ad creative & copy', body: 'Scroll-stopping images and words written to make locals call you — not just double-tap.' },
  { title: 'Precise local targeting', body: 'We put you in front of people in your service area who are ready to buy right now.' },
  { title: 'Daily management', body: 'We watch, test, and tune your campaigns every day so your budget never gets wasted.' },
  { title: 'Lead tracking', body: 'Every call and message is tracked so you see exactly what your ad dollars bring back.' },
  { title: 'Plain-English reporting', body: 'No jargon dashboards. Just a clear read on leads, cost, and what’s working.' },
  { title: 'One dedicated team', body: 'A real person who knows your account — not a ticket queue in another timezone.' },
];

const FAQS = [
  {
    q: 'Is the 3-day trial really free?',
    a: 'Yes. There’s no management fee and no card required for the trial. You only cover your own ad spend (the money that goes to Facebook/Google to show your ads) — which you’d pay regardless of who runs them.',
  },
  {
    q: 'What happens after the 3 days?',
    a: 'If you’re happy with what you see, we keep your campaigns running for a flat $499/month. If it’s not for you, just say so — we shut it down and you owe us nothing.',
  },
  {
    q: 'How much should I budget for ad spend?',
    a: 'Most local businesses start around $15–$30/day. We’ll recommend a number on your call based on your goals and area — and you’re always in control of it.',
  },
  {
    q: 'Am I locked into a contract?',
    a: 'No. The $499/mo is month-to-month. Cancel anytime, no cancellation fees.',
  },
  {
    q: 'What kind of businesses is this for?',
    a: 'Local, service-based businesses that want more calls and customers — contractors, home services, clinics, salons, restaurants, gyms, and more.',
  },
  {
    q: 'Do you write the ads or do I?',
    a: 'We do all of it — the copy, the images, the targeting, and the day-to-day management. You focus on the customers we send you.',
  },
];

export default function MarketingPage() {
  return (
    <div className="min-h-screen bg-navy-950 text-cream-50">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-navy-700/50 bg-navy-950/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <Link href="/marketing" className="flex items-center">
            <Image
              src={LOGO_SRC}
              alt="StoopCraft Marketing"
              width={2172}
              height={724}
              priority
              className="h-12 w-auto sm:h-14"
              sizes="320px"
            />
          </Link>
          <a
            href="#book"
            className="rounded-full bg-gradient-to-b from-gold-300 to-gold-500 px-5 py-2.5 text-sm font-bold text-navy-950 shadow-[0_8px_25px_-8px_rgba(231,180,60,0.6)] transition-transform hover:-translate-y-0.5"
          >
            Get My Free Plan
          </a>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="glow-gold pointer-events-none absolute inset-0" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 py-16 lg:grid-cols-2 lg:py-24">
          <div>
            <Badge>
              <span className="h-1.5 w-1.5 rounded-full bg-gold-400" />
              3-Day Free Trial · No risk. No obligation.
            </Badge>
            <h1 className="mt-6 font-display text-4xl font-bold leading-[1.05] tracking-tight text-cream-50 sm:text-5xl lg:text-6xl">
              Your Competitors <br className="hidden sm:block" />
              Are Running Ads. <span className="text-gold-400">Why Aren&rsquo;t You?</span>
            </h1>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-cream-100/70">
              Done-for-you ads for local businesses. We build, launch, and manage the campaigns
              that put you in front of ready-to-buy customers — while your competition soaks up the
              leads you&rsquo;re missing.
            </p>
            <ul className="mt-7 space-y-3">
              {[
                'Target local customers ready to buy',
                'Get more leads, calls & booked jobs',
                'Try it free for 3 days — then just $499/mo',
              ].map((item) => (
                <li key={item} className="flex items-center gap-3 text-cream-100/80">
                  <CheckPin className="h-5 w-5 shrink-0 text-gold-400" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <a
                href="#book"
                className="rounded-full bg-gradient-to-b from-gold-300 to-gold-500 px-7 py-4 text-sm font-bold text-navy-950 shadow-[0_10px_35px_-8px_rgba(231,180,60,0.6)] transition-transform hover:-translate-y-0.5"
              >
                Get My Free Lead Plan →
              </a>
              <span className="text-sm text-cream-100/50">No card required · No obligation</span>
            </div>
          </div>

          {/* Form */}
          <div id="book" className="scroll-mt-24">
            <MarketingLeadForm
              heading="Start your free 3-day trial"
              subheading="Tell us where to reach you and we’ll set up your first campaign. No card, no obligation."
            />
          </div>
        </div>
      </section>

      {/* Trust bar */}
      <section className="border-y border-navy-700/50 bg-navy-900/50">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-5 py-8 text-center sm:grid-cols-4">
          {[
            ['3 days', 'Free trial'],
            ['$499/mo', 'Flat, no contract'],
            ['Days', 'To go live'],
            ['You', 'Own the results'],
          ].map(([big, small]) => (
            <div key={small}>
              <div className="font-display text-2xl font-bold text-gold-400 sm:text-3xl">{big}</div>
              <div className="mt-1 text-xs uppercase tracking-wider text-cream-100/45">{small}</div>
            </div>
          ))}
        </div>
      </section>

      {/* What happens during the trial — concrete, no-hype, near the top */}
      <section className="mx-auto max-w-4xl px-5 py-20">
        <div className="mb-12 text-center">
          <Badge>The 3-day free trial</Badge>
          <h2 className="mt-5 font-display text-3xl font-bold tracking-tight text-cream-50 sm:text-4xl">
            What happens during your free trial?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-cream-100/60">
            No mystery, no lock-in — here&rsquo;s exactly what we do, starting the day you sign up.
          </p>
        </div>
        <ol className="mx-auto grid max-w-2xl gap-3">
          {TRIAL_STEPS.map((step, i) => (
            <li
              key={step}
              className="flex items-center gap-4 rounded-2xl border border-navy-700/50 bg-navy-800/40 px-5 py-4"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-gold-300 to-gold-500 font-display text-sm font-bold text-navy-950">
                {i + 1}
              </span>
              <span className="text-cream-100/85">{step}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* Problem */}
      <section className="mx-auto max-w-4xl px-5 py-20 text-center">
        <h2 className="font-display text-3xl font-bold tracking-tight text-cream-50 sm:text-4xl">
          Every day you wait,
          <br />
          <span className="text-cream-100/50">a competitor takes the call.</span>
        </h2>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-cream-100/70">
          Your best customers are searching right now — and calling whoever shows up first. Boosting
          a post gets you nowhere, and most agencies want a 6-month contract before they’ll lift a
          finger. We run the ads that actually bring in local customers, and we prove it works
          before you pay a dime in fees.
        </p>
      </section>

      {/* What's included */}
      <section className="mx-auto max-w-6xl px-5 py-20">
        <div className="mb-14 text-center">
          <Badge>Done for you</Badge>
          <h2 className="mt-5 font-display text-3xl font-bold tracking-tight text-cream-50 sm:text-4xl">
            Everything handled. Nothing on your plate.
          </h2>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {INCLUDED.map((item) => (
            <div key={item.title} className="rounded-2xl border border-navy-700/50 bg-navy-800/40 p-6">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-gold-400/10 text-gold-400">
                <CheckPin className="h-5 w-5" />
              </div>
              <h3 className="font-display text-base font-semibold text-cream-50">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-cream-100/65">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Offer / pricing */}
      <section className="border-t border-navy-700/50 bg-navy-900/40">
        <div className="mx-auto max-w-3xl px-5 py-20">
          <div className="relative overflow-hidden rounded-3xl border border-gold-400/30 bg-navy-800/60 p-8 text-center shadow-2xl sm:p-12">
            <div className="glow-gold pointer-events-none absolute inset-0 opacity-70" />
            <div className="relative">
              <Badge>The offer</Badge>
              <h2 className="mt-6 font-display text-3xl font-bold tracking-tight text-cream-50 sm:text-4xl">
                Start with a 3-day free trial
              </h2>
              <p className="mx-auto mt-4 max-w-lg text-cream-100/70">
                See a real campaign running for your business before you pay a management fee. You
                only cover ad spend during the trial.
              </p>

              <p className="mx-auto mt-8 max-w-md text-lg font-medium text-cream-50">
                Free for 3 days. Continue only if you like it.
              </p>
              <div className="mx-auto mt-3 flex max-w-sm items-end justify-center gap-2">
                <span className="font-display text-5xl font-bold text-gold-400">$499</span>
                <span className="mb-1.5 text-lg text-cream-100/60">/month, month-to-month</span>
              </div>
              <p className="mt-2 text-sm text-cream-100/50">No setup fees · Cancel anytime</p>

              <ul className="mx-auto mt-8 grid max-w-md gap-3 text-left">
                {[
                  'No setup fees, no long-term contract',
                  'Ad creative, targeting & daily management included',
                  'Cancel anytime — you’re never locked in',
                  'You keep every lead and every result',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-cream-100/80">
                    <CheckPin className="mt-0.5 h-5 w-5 shrink-0 text-gold-400" />
                    <span className="text-sm">{item}</span>
                  </li>
                ))}
              </ul>

              <a
                href="#book"
                className="mt-9 inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-b from-gold-300 to-gold-500 px-8 py-4 text-sm font-bold text-navy-950 shadow-[0_10px_35px_-8px_rgba(231,180,60,0.6)] transition-transform hover:-translate-y-0.5"
              >
                Get My Free Lead Plan →
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-5 py-20">
        <div className="mb-12 text-center">
          <Badge>Questions</Badge>
          <h2 className="mt-5 font-display text-3xl font-bold tracking-tight text-cream-50 sm:text-4xl">
            Straight answers
          </h2>
        </div>
        <div className="divide-y divide-navy-700/50 overflow-hidden rounded-2xl border border-navy-700/50 bg-navy-800/40">
          {FAQS.map((faq) => (
            <details key={faq.q} className="group px-6">
              <summary className="flex cursor-pointer list-none items-center justify-between py-5 font-medium text-cream-50 [&::-webkit-details-marker]:hidden">
                {faq.q}
                <svg
                  className="h-5 w-5 shrink-0 text-gold-400 transition-transform group-open:rotate-45"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden
                >
                  <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </summary>
              <p className="pb-5 text-sm leading-relaxed text-cream-100/65">{faq.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Positioning / who it's for */}
      <section className="border-t border-navy-700/50">
        <div className="mx-auto max-w-3xl px-5 py-16 text-center">
          <p className="font-display text-xl font-medium leading-relaxed text-cream-50 sm:text-2xl">
            Built for local businesses that need more{' '}
            <span className="text-gold-400">
              calls, booked jobs, appointments, and estimate requests
            </span>{' '}
            — not vanity clicks.
          </p>
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-t border-navy-700/50 bg-navy-900/50">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-20 lg:grid-cols-2">
          <div>
            <h2 className="font-display text-3xl font-bold tracking-tight text-cream-50 sm:text-4xl">
              Stop losing customers to the competition.
            </h2>
            <p className="mt-5 max-w-md text-lg leading-relaxed text-cream-100/70">
              Start your free 3-day trial and we’ll get your first campaign live. No card, no
              obligation — start seeing what a real campaign can do for your business.
            </p>
            <div className="mt-7 flex items-center gap-3 text-cream-100/60">
              <CheckPin className="h-5 w-5 text-gold-400" />
              <span className="text-sm">We&rsquo;ll reach out shortly to get you set up.</span>
            </div>
          </div>
          <MarketingLeadForm heading="Start your free 3-day trial" />
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-navy-700/50 bg-navy-950">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-8 text-sm text-cream-100/40 sm:flex-row">
          <Image src={LOGO_SRC} alt="StoopCraft Marketing" width={2172} height={724} className="h-11 w-auto opacity-80 sm:h-12" sizes="260px" />

          <p>© {new Date().getFullYear()} StoopCraft Marketing. All rights reserved.</p>
          <div className="flex gap-5">
            <Link href="/marketing/privacy" className="hover:text-cream-100/70">Privacy</Link>
            <Link href="/marketing/terms" className="hover:text-cream-100/70">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
