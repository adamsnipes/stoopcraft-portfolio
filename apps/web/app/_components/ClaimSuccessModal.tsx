'use client';

// Shows a confirmation modal when the user returns from Stripe Checkout
// with `?claim_success=...` in the URL. Stripe sets that param on the
// success_url configured in /api/checkout/claim. The modal also clears
// the param from the URL on dismiss so a refresh doesn't re-trigger it.

import { useEffect, useState } from 'react';

export function ClaimSuccessModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.has('claim_success')) setOpen(true);
  }, []);

  function close() {
    setOpen(false);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('claim_success');
      url.searchParams.delete('claim_cancelled');
      window.history.replaceState({}, '', url.toString());
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8 bg-ink-900/80 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="claim-success-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="relative w-full max-w-md bg-cream-50 text-ink-900 rounded-2xl p-8 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)]">
        <div className="flex justify-center mb-5">
          <span className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-amber-accent/15 text-amber-accent">
            <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="m6 12 4 4 8-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </div>
        <h2
          id="claim-success-title"
          className="font-display text-2xl sm:text-3xl font-light tracking-tight text-center"
        >
          Payment <span className="italic">received.</span>
        </h2>
        <p className="text-ink-700 text-center mt-3 leading-relaxed">
          Your site is locked in. We&rsquo;ve emailed a confirmation and we&rsquo;re
          setting up your domain now — usually live within 15 minutes.
        </p>
        <ul className="mt-6 space-y-3 text-sm text-ink-700">
          <li className="flex items-start gap-2.5">
            <span className="mt-1 inline-block w-1.5 h-1.5 rounded-full bg-amber-accent shrink-0" />
            <span>Check your inbox for next steps and your temporary site URL.</span>
          </li>
          <li className="flex items-start gap-2.5">
            <span className="mt-1 inline-block w-1.5 h-1.5 rounded-full bg-amber-accent shrink-0" />
            <span>You&rsquo;ll get a second email with portal access once your domain is live.</span>
          </li>
          <li className="flex items-start gap-2.5">
            <span className="mt-1 inline-block w-1.5 h-1.5 rounded-full bg-amber-accent shrink-0" />
            <span>Reply to either email if you have questions — a real person reads them.</span>
          </li>
        </ul>
        <button
          type="button"
          onClick={close}
          className="mt-7 w-full bg-ink-900 hover:bg-ink-800 text-cream-50 rounded-xl py-3.5 text-sm font-semibold transition-colors"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
