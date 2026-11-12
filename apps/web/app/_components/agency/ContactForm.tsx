'use client';

// Agency lead-capture form. Posts to /api/agency-inquiry, which forwards the
// lead to the StoopCraft inbox. Collects name, business name, email, and phone —
// enough for the team to reach out and start a preview. The phone field notes
// "we'll text you" so people give a real number instead of a throwaway.
//
// Rendered as a LIGHT card (white surface, dark text) so it reads as familiar
// and trustworthy on top of the dark hero / final-CTA sections. The accent
// (button fill/hover, success icon) follows the surrounding landing scope via
// CSS vars — gold under `.landing-gold` (homepage), green under `.landing-green`
// (the /landscapers campaign LP).
//
// Used in two spots on the homepage (hero + contact section), so field ids are
// namespaced with useId to avoid duplicate-id collisions on the same page.
// `company_site` is a honeypot, hidden from humans and required-empty server-side.

import { useId, useState } from 'react';
import { trackPixel } from '@/lib/fbq';
import { trackLeadConversion } from '@/lib/gtag';
import { formatPhone } from '@/lib/format-phone';

type Status = 'idle' | 'submitting' | 'success' | 'error';

const fieldClass =
  'w-full rounded-xl border border-black/15 bg-white px-4 py-3 text-[15px] text-[#161616] placeholder:text-black/35 outline-none transition-colors focus:border-amber-accent focus:ring-2 focus:ring-amber-accent/25';

const labelClass =
  'mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#161616]/70';

export function ContactForm({
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
    // Conversions API copy this same request fires (see /api/agency-inquiry).
    const eventId = crypto.randomUUID();

    try {
      const res = await fetch('/api/agency-inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, event_id: eventId }),
      });
      if (!res.ok) throw new Error('request failed');
      // Fire Meta Pixel Lead only on a confirmed submission — mirrors the
      // server-side "form completion page" Meta's docs assume in an SPA. The
      // server sends the same Lead via CAPI; eventID lets Meta dedupe the two.
      trackPixel('Lead', undefined, { eventID: eventId });
      // Google Ads lead-form conversion — mirrors the Meta Lead above. Both
      // globals are gated to platform pages, so neither fires on customer sites.
      trackLeadConversion();
      setStatus('success');
      form.reset();
      setPhone('');
    } catch {
      setStatus('error');
    }
  }

  if (status === 'success') {
    return (
      <div className="flex flex-col items-center justify-center rounded-3xl border border-black/10 bg-white px-8 py-16 text-center shadow-2xl shadow-black/30">
        <span className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-full bg-amber-accent/15 text-[var(--accent-strong)]">
          <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="m6 12 4 4 8-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <h3 className="font-display text-2xl font-medium text-[#161616]">You&rsquo;re in — we&rsquo;re on it.</h3>
        <p className="mt-3 max-w-sm text-[#161616]/60">
          We&rsquo;ll start on your custom website preview and reach out within 2 hours. No card,
          no commitment until you love it.
        </p>
        <button
          type="button"
          onClick={() => setStatus('idle')}
          className="mt-7 text-sm font-semibold text-[var(--accent-strong)] hover:text-[#161616]"
        >
          Send another →
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-3xl border border-black/10 bg-white p-6 shadow-2xl shadow-black/30 sm:p-8"
    >
      {(heading || subheading) && (
        <div className="mb-6">
          {heading && <h3 className="font-display text-xl font-medium text-[#161616]">{heading}</h3>}
          {subheading && <p className="mt-1.5 text-sm text-[#161616]/60">{subheading}</p>}
        </div>
      )}

      {/* Honeypot — hidden from humans, bots fill it. */}
      <div className="absolute -left-[9999px]" aria-hidden>
        <label>
          Company site
          <input type="text" name="company_site" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

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
          <label htmlFor={`${uid}-email`} className={labelClass}>
            Email
          </label>
          <input id={`${uid}-email`} name="email" type="email" required placeholder="jane@business.com" className={fieldClass} />
        </div>
        <div>
          <label htmlFor={`${uid}-phone`} className={labelClass}>
            Phone{' '}
            <span className="font-normal normal-case tracking-normal text-[#161616]/40">
              (we&rsquo;ll text you)
            </span>
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
      </div>

      {status === 'error' && (
        <p className="mt-4 text-sm text-red-600">
          Something went wrong. Please try again, or email developer@example.com.
        </p>
      )}

      <button
        type="submit"
        disabled={status === 'submitting'}
        className="group mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-amber-accent py-4 text-sm font-semibold text-[var(--accent-ink)] shadow-[0_10px_30px_-12px_rgba(0,0,0,0.5)] transition-colors hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {status === 'submitting' ? 'Sending…' : 'Create My Website'}
        {status !== 'submitting' && (
          <svg className="h-4 w-4 transition-transform group-hover:translate-x-0.5" viewBox="0 0 16 16" fill="none">
            <path d="M3 8h10m0 0L8.5 3.5M13 8l-4.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>
      <p className="mt-3 text-center text-xs text-[#161616]/50">
        Free preview. $99/month only if you launch. No card required.
      </p>
    </form>
  );
}
