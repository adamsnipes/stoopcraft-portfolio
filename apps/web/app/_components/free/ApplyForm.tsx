'use client';

// Two-step lead capture for the /free-website funnel experiment.
//
// Why it exists instead of reusing agency/ContactForm: the homepage form asks a
// cold visitor for four fields — including a required phone number labelled
// "we'll text you" — before they've committed to anything. This splits the ask:
//
//   Step 1  one click, zero typing, no PII  → "what kind of business is it?"
//   Step 2  the contact details, phone OPTIONAL
//
// The step-1 click is a micro-commitment, and it also fills the `need`
// qualifier the API already accepts. Nothing is posted until step 2 submits, so
// a bail on step 2 costs us the same lead the single-step form would have lost.
//
// The POST body, honeypot, Meta Pixel + CAPI dedupe id, and Google Ads
// conversion all match agency/ContactForm exactly — this is a UI change, not a
// tracking change, so leads from both pages stay comparable in the ad accounts.
//
// PostHog step events are the point of the experiment: with 13 clicks and 0
// leads on the dark page there is no way to tell whether visitors never reached
// the form, opened it and stalled, or errored out. `apply_form_*` answers that.

import { useId, useState } from 'react';
import posthog from 'posthog-js';
import { trackPixel } from '@/lib/fbq';
import { trackLeadConversion } from '@/lib/gtag';
import { formatPhone } from '@/lib/format-phone';
import { PRICING } from '@/lib/pricing';

type Status = 'idle' | 'submitting' | 'success' | 'error';

// Step-1 choices. These double as the `need` qualifier on the lead email and in
// SecureMyLead, so keep the labels descriptive enough to read cold in an inbox.
// Ordered by how often the industry shows up in websites/claimed + active_build.
const BUSINESS_TYPES = [
  'Home services & trades',
  'Landscaping & lawn care',
  'Cleaning services',
  'Food, catering & events',
  'Health, beauty & wellness',
  'Professional services',
  'Church or nonprofit',
  'Something else',
];

const fieldClass =
  'w-full rounded-xl border border-black/15 bg-white px-4 py-3 text-[15px] text-[#15120c] placeholder:text-black/35 outline-none transition-colors focus:border-amber-accent focus:ring-2 focus:ring-amber-accent/25';

const labelClass = 'mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#15120c]/70';

function capture(event: string, props?: Record<string, unknown>) {
  // No-ops when PostHog was never initialised (no NEXT_PUBLIC_POSTHOG_KEY).
  if (posthog.__loaded) posthog.capture(event, props);
}

export function ApplyForm({
  heading = 'Apply for your free website',
  subheading = 'Takes about 2 minutes. No card, no obligation. See the finished preview before you decide.',
  formLocation = 'hero',
}: {
  heading?: string;
  subheading?: string;
  /** Distinguishes the hero form from the closing form in PostHog. */
  formLocation?: string;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [businessType, setBusinessType] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [phone, setPhone] = useState('');
  const [started, setStarted] = useState(false);
  const uid = useId();

  function markStarted() {
    if (started) return;
    setStarted(true);
    capture('apply_form_started', { form_location: formLocation });
  }

  function chooseType(type: string) {
    markStarted();
    setBusinessType(type);
    setStep(2);
    capture('apply_step_1_completed', { form_location: formLocation, business_type: type });
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === 'submitting') return;
    setStatus('submitting');

    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());

    // Shared id so Meta dedupes the browser pixel against the server-side
    // Conversions API copy that /api/agency-inquiry fires for this request.
    const eventId = crypto.randomUUID();

    try {
      const res = await fetch('/api/agency-inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, need: businessType, event_id: eventId }),
      });
      if (!res.ok) throw new Error('request failed');
      trackPixel('Lead', undefined, { eventID: eventId });
      trackLeadConversion();
      capture('apply_form_submitted', { form_location: formLocation, business_type: businessType });
      setStatus('success');
      form.reset();
      setPhone('');
    } catch {
      setStatus('error');
      capture('apply_form_error', { form_location: formLocation });
    }
  }

  if (status === 'success') {
    return (
      <div className="flex flex-col items-center justify-center rounded-3xl border border-black/[0.08] bg-white px-8 py-14 text-center shadow-[0_24px_60px_-30px_rgba(21,18,12,0.35)]">
        <span className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-full bg-amber-accent/15 text-[var(--accent-strong)]">
          <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="m6 12 4 4 8-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <h3 className="font-display text-2xl font-semibold tracking-[-0.02em] text-[#15120c]">Application received.</h3>
        <p className="mt-3 max-w-sm text-[#15120c]/60">
          A designer is picking this up now. Watch your inbox, because your website preview link
          lands within 2 hours. Nothing is owed unless you decide to launch it.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-black/[0.08] bg-white p-6 shadow-[0_24px_60px_-30px_rgba(21,18,12,0.35)] sm:p-8">
      <div className="mb-5">
        <h3 className="font-display text-xl font-semibold tracking-[-0.02em] text-[#15120c]">{heading}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-[#15120c]/60">{subheading}</p>
      </div>

      <div className="mb-6 rounded-xl border border-amber-accent/25 bg-amber-accent/10 px-4 py-3 text-sm leading-relaxed text-[#15120c]/75">
        <p className="font-semibold text-[#15120c]">$0 to design, build, and preview.</p>
        <p className="mt-1">
          Launch for <strong className="font-semibold text-[#15120c]">${PRICING.starter.monthly}/month</strong> only if you choose.
          {' '}That monthly plan is how we earn, covering hosting, your domain, security, and unlimited edits.
        </p>
      </div>

      {/* Progress — a visible "2 of 2" reads as short, which is the whole pitch. */}
      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-[#15120c]/45">
          <span>Step {step} of 2</span>
          <span>{step === 1 ? 'About 2 minutes' : 'Almost done'}</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-[var(--color-cream-200)]">
          <div
            className="h-full rounded-full bg-amber-accent transition-all duration-500 ease-out"
            style={{ width: step === 1 ? '50%' : '100%' }}
          />
        </div>
      </div>

      {step === 1 ? (
        <div>
          <p className={labelClass}>What kind of business is it?</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {BUSINESS_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => chooseType(t)}
                className="rounded-xl border border-black/10 bg-[var(--surface-inset)] px-4 py-3 text-left text-sm font-medium text-[#15120c] transition-all hover:-translate-y-px hover:border-amber-accent hover:bg-amber-accent/10 hover:shadow-sm"
              >
                {t}
              </button>
            ))}
          </div>
          <p className="mt-4 text-center text-xs text-[#15120c]/45">
            Pick one to continue. We never ask for a card.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          {/* Honeypot — hidden from humans, bots fill it. Server requires empty. */}
          <div className="absolute -left-[9999px]" aria-hidden>
            <label>
              Company site
              <input type="text" name="company_site" tabIndex={-1} autoComplete="off" />
            </label>
          </div>

          <button
            type="button"
            onClick={() => setStep(1)}
            className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-[#15120c]/50 transition-colors hover:text-[#15120c]"
          >
            <svg className="h-3 w-3" viewBox="0 0 16 16" fill="none">
              <path d="M13 8H3m0 0 4.5-4.5M3 8l4.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {businessType}
          </button>

          <div className="grid gap-4">
            <div>
              <label htmlFor={`${uid}-business`} className={labelClass}>
                Business name
              </label>
              <input
                id={`${uid}-business`}
                name="business_name"
                required
                placeholder="Smith & Co."
                className={fieldClass}
              />
            </div>
            <div>
              <label htmlFor={`${uid}-name`} className={labelClass}>
                Your name
              </label>
              <input id={`${uid}-name`} name="name" required placeholder="Jane Smith" className={fieldClass} />
            </div>
            <div>
              <label htmlFor={`${uid}-email`} className={labelClass}>
                Email
              </label>
              <input
                id={`${uid}-email`}
                name="email"
                type="email"
                required
                placeholder="jane@business.com"
                className={fieldClass}
              />
              <p className="mt-1.5 text-xs text-[#15120c]/45">This is where your preview link gets sent.</p>
            </div>
            <div>
              <label htmlFor={`${uid}-phone`} className={labelClass}>
                Phone{' '}
                <span className="font-normal normal-case tracking-normal text-[#15120c]/40">
                  (optional)
                </span>
              </label>
              <input
                id={`${uid}-phone`}
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(formatPhone(e.target.value))}
                placeholder="555-123-4567"
                className={fieldClass}
              />
            </div>
          </div>

          {status === 'error' && (
            <p className="mt-4 text-sm text-red-600">
              Something went wrong. Please try again, or email developer@example.com.
            </p>
          )}

          <button
            type="submit"
            disabled={status === 'submitting'}
            className="group mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-amber-accent py-4 text-sm font-semibold text-[var(--accent-ink)] shadow-[0_12px_30px_-12px_rgba(150,105,10,0.6)] transition-colors hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {status === 'submitting' ? 'Sending…' : 'Build My Free Website'}
            {status !== 'submitting' && (
              <svg className="h-4 w-4 transition-transform group-hover:translate-x-0.5" viewBox="0 0 16 16" fill="none">
                <path d="M3 8h10m0 0L8.5 3.5M13 8l-4.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
          <p className="mt-3 text-center text-xs text-[#15120c]/50">
            Free to design and build · No card required · Nothing owed if you pass
          </p>
        </form>
      )}
    </div>
  );
}
