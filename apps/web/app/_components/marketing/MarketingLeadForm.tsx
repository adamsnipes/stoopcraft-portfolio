'use client';

// Lead-capture form for the StoopCraft Marketing (ad management) funnel. Posts
// to /api/marketing-inquiry, which forwards the lead to the StoopCraft inbox,
// fires the deduped CAPI Lead, and tags the SecureMyLead webhook as the $499/mo
// offer. Collects the contact essentials plus a couple of qualifiers (ad budget
// range, what they want leads for) so the team can prep a lead plan before
// reaching out — the funnel is "get my free lead plan", we follow up.
//
// `company_site` is a honeypot, hidden from humans and required-empty
// server-side. Field ids are namespaced with useId so the form can appear more
// than once on the page (hero + final CTA) without duplicate-id collisions.

import { useId, useState } from 'react';
import { trackPixel } from '@/lib/fbq';
import { formatPhone } from '@/lib/format-phone';

// Qualifying selector — stored and emailed verbatim, so keep values readable.
const BUDGET_OPTIONS = ['$300–$500', '$500–$1,000', '$1,000+', 'Not sure yet'];

type Status = 'idle' | 'submitting' | 'success' | 'error';

const fieldClass =
  'w-full rounded-xl border border-navy-700/70 bg-navy-950/50 px-4 py-3 text-[15px] text-cream-50 placeholder:text-cream-100/25 outline-none transition-colors focus:border-gold-400/70 focus:bg-navy-950/80';

const labelClass =
  'mb-1.5 block text-xs font-medium uppercase tracking-wider text-cream-100/50';

export function MarketingLeadForm({
  heading,
  subheading,
}: {
  heading?: string;
  subheading?: string;
}) {
  const [status, setStatus] = useState<Status>('idle');
  const [phone, setPhone] = useState('');
  const uid = useId();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === 'submitting') return;
    setStatus('submitting');

    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());

    // Shared id so Meta dedupes the browser pixel against the server-side
    // Conversions API copy this same request fires (see /api/marketing-inquiry).
    const eventId = crypto.randomUUID();

    try {
      const res = await fetch('/api/marketing-inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, event_id: eventId }),
      });
      if (!res.ok) throw new Error('request failed');
      trackPixel('Lead', undefined, { eventID: eventId });
      setStatus('success');
      form.reset();
      setPhone('');
    } catch {
      setStatus('error');
    }
  }

  if (status === 'success') {
    return (
      <div className="flex flex-col items-center justify-center rounded-3xl border border-gold-400/30 bg-navy-800/60 px-8 py-14 text-center shadow-2xl">
        <span className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-full bg-gold-400/15 text-gold-400">
          <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="m6 12 4 4 8-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <h3 className="font-display text-2xl font-semibold text-cream-50">
          You&rsquo;re in! 🎉
        </h3>
        <p className="mt-3 max-w-sm text-cream-100/70">
          Thanks &mdash; we&rsquo;ve got your details. We&rsquo;ll put together your free lead plan
          and reach out shortly to get your 3-day trial live. No card, no obligation.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-3xl border border-navy-700/60 bg-navy-800/60 p-6 shadow-2xl backdrop-blur-sm sm:p-8"
    >
      {(heading || subheading) && (
        <div className="mb-6">
          {heading && <h3 className="font-display text-xl font-semibold text-cream-50">{heading}</h3>}
          {subheading && <p className="mt-1.5 text-sm text-cream-100/60">{subheading}</p>}
        </div>
      )}

      <div className="grid gap-4">
        <div>
          <label htmlFor={`${uid}-name`} className={labelClass}>
            Full name
          </label>
          <input id={`${uid}-name`} name="name" required placeholder="Jane Smith" className={fieldClass} />
        </div>
        <div>
          <label htmlFor={`${uid}-business`} className={labelClass}>
            Business name
          </label>
          <input id={`${uid}-business`} name="business_name" required placeholder="Smith & Co." className={fieldClass} />
        </div>
        <div>
          <label htmlFor={`${uid}-phone`} className={labelClass}>
            Phone
          </label>
          <input
            id={`${uid}-phone`}
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            required
            value={phone}
            onChange={(e) => setPhone(formatPhone(e.target.value))}
            placeholder="555-123-4567"
            className={fieldClass}
          />
        </div>
        <div>
          <label htmlFor={`${uid}-email`} className={labelClass}>
            Email
          </label>
          <input id={`${uid}-email`} name="email" type="email" required placeholder="jane@business.com" className={fieldClass} />
        </div>
        <div>
          <label htmlFor={`${uid}-website`} className={labelClass}>
            Website / Facebook / Instagram{' '}
            <span className="normal-case tracking-normal text-cream-100/35">(optional)</span>
          </label>
          <input
            id={`${uid}-website`}
            name="website"
            placeholder="yourbusiness.com, Facebook, or Instagram"
            className={fieldClass}
          />
        </div>
        <div>
          <label htmlFor={`${uid}-service`} className={labelClass}>
            What do you want more leads for?{' '}
            <span className="normal-case tracking-normal text-cream-100/35">(optional)</span>
          </label>
          <input
            id={`${uid}-service`}
            name="service"
            placeholder="e.g. roofing, dental implants, HVAC repair"
            className={fieldClass}
          />
        </div>
        <div>
          <label htmlFor={`${uid}-budget`} className={labelClass}>
            Monthly ad budget range
          </label>
          <div className="relative">
            <select
              id={`${uid}-budget`}
              name="budget"
              required
              defaultValue=""
              className={`${fieldClass} appearance-none pr-10 [&:invalid]:text-cream-100/30 [&>option]:bg-navy-900 [&>option]:text-cream-50`}
            >
              <option value="" disabled>
                Select a range…
              </option>
              {BUDGET_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
            <svg
              className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-cream-100/40"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden
            >
              <path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
      </div>

      {/* Honeypot — hidden from humans, bots fill it. Kept at the end of the
          form so it never reads as the first field to anyone inspecting it. */}
      <div className="absolute -left-[9999px]" aria-hidden>
        <label>
          Company site
          <input type="text" name="company_site" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <label className="mt-5 flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          name="consent"
          value="yes"
          required
          className="mt-0.5 h-4 w-4 shrink-0 accent-gold-400"
        />
        <span className="text-xs leading-relaxed text-cream-100/55">
          I agree to be contacted about my free trial. There&rsquo;s no fee for the 3-day trial
          &mdash; I only pay for my own ad budget. Continue after for $499/month, cancel anytime.
        </span>
      </label>

      {status === 'error' && (
        <p className="mt-4 text-sm text-red-400">
          Something went wrong. Please try again, or email developer@example.com.
        </p>
      )}

      <button
        type="submit"
        disabled={status === 'submitting'}
        className="group mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-b from-gold-300 to-gold-500 py-4 text-sm font-bold text-navy-950 shadow-[0_10px_35px_-8px_rgba(231,180,60,0.6)] transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {status === 'submitting' ? 'Sending…' : 'Get My Free Lead Plan'}
        {status !== 'submitting' && (
          <svg className="h-4 w-4 transition-transform group-hover:translate-x-0.5" viewBox="0 0 16 16" fill="none">
            <path d="M3 8h10m0 0L8.5 3.5M13 8l-4.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>
      <p className="mt-3 text-center text-xs text-cream-100/40">
        3-day free trial · No card required · We&rsquo;ll reach out shortly
      </p>
    </form>
  );
}
