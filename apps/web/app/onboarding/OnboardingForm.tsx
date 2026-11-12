'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Props = { clientId: string };

const PLAN = {
  id: 'starter' as const,
  label: 'Starter',
  price: '$79',
  features: [
    'Professional website',
    'Mobile-friendly design',
    'Hosting + SSL on a custom domain',
    'Online booking integration',
    'Photo gallery',
    'Any updates you need',
    'Priority support (24hr response)',
    'Monthly content refresh',
  ],
};


function Check() {
  return (
    <svg className="w-4 h-4 shrink-0 text-emerald-500" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="8" fill="currentColor" fillOpacity="0.12" />
      <path d="M4.5 8l2.5 2.5 4-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Arrow() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
      <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function OnboardingForm({ clientId }: Props) {
  const router = useRouter();

  const [agreedTerms, setAgreedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  void clientId;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!agreedTerms) {
      setError('You must agree to the terms to continue.');
      return;
    }
    setLoading(true);
    setError('');

    const res = await fetch('/api/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        plan: PLAN.id,
        agreed_to_terms: true,
      }),
    });

    const data = await res.json() as { error?: string; checkout_url?: string };
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? 'Something went wrong.');
    } else if (data.checkout_url) {
      router.push(data.checkout_url);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-7">

      {/* Plan summary */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Your plan</p>
        <div className="rounded-xl border-2 border-gray-900 bg-gray-50 p-5 shadow-sm">
          <div className="flex items-baseline justify-between mb-4">
            <div className="text-xs font-medium text-gray-500">{PLAN.label}</div>
            <div className="text-2xl font-bold text-gray-900 leading-tight">
              {PLAN.price}<span className="text-sm font-normal text-gray-400">/mo</span>
            </div>
          </div>
          <ul className="space-y-2">
            {PLAN.features.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-gray-600">
                <Check />
                {f}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Terms */}
      <label className="flex items-start gap-2.5 cursor-pointer group">
        <span className={`mt-0.5 w-4 h-4 shrink-0 rounded border-2 flex items-center justify-center transition-colors ${agreedTerms ? 'bg-gray-900 border-gray-900' : 'border-gray-300 group-hover:border-gray-400'}`}>
          {agreedTerms && (
            <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 8" fill="none">
              <path d="M1 4l2.5 2.5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </span>
        <input type="checkbox" checked={agreedTerms} onChange={(e) => setAgreedTerms(e.target.checked)} className="sr-only" />
        <span className="text-sm text-gray-600 leading-snug">
          I agree to the{' '}
          <a href="/terms" target="_blank" className="underline text-gray-800 hover:text-gray-900">Terms of Service</a>
          {' '}and{' '}
          <a href="/cancellation" target="_blank" className="underline text-gray-800 hover:text-gray-900">Cancellation Policy</a>
        </span>
      </label>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading || !agreedTerms}
        className="w-full flex items-center justify-center gap-2 bg-gray-900 hover:bg-gray-800 active:bg-black text-white py-3.5 rounded-xl font-semibold text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {loading ? (
          <>
            <svg className="w-4 h-4 animate-spin" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6" stroke="currentColor" strokeOpacity="0.3" strokeWidth="2" />
              <path d="M8 2a6 6 0 016 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            Processing…
          </>
        ) : (
          <>
            Continue to Payment
            <Arrow />
          </>
        )}
      </button>

      <p className="text-center text-xs text-gray-400">Secure checkout via Stripe · Cancel anytime</p>
    </form>
  );
}
