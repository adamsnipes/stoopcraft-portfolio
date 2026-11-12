'use client';

import { useState } from 'react';

export function SubscribeButton({
  clientId,
  plan = 'starter',
  buttonLabel = 'Subscribe — $99/mo',
}: {
  clientId: string;
  plan?: string;
  buttonLabel?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/pay/${clientId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setError(
          data.error === 'already_active'
            ? 'This subscription is already active.'
            : data.error === 'rate_limited'
              ? 'Too many attempts — please try again in a few minutes.'
              : 'Something went wrong. Please try again.',
        );
        setLoading(false);
        return;
      }
      // Hand off to Stripe Checkout.
      window.location.href = data.url;
    } catch {
      setError('Network error. Please try again.');
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="group flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-b from-amber-accent-soft to-amber-accent py-4 text-sm font-semibold text-ink-900 transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? 'Redirecting to secure checkout…' : buttonLabel}
        {!loading && (
          <svg className="h-4 w-4 transition-transform group-hover:translate-x-0.5" viewBox="0 0 16 16" fill="none">
            <path d="M3 8h10m0 0L8.5 3.5M13 8l-4.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>
      {error && <p className="mt-3 text-center text-sm text-red-400">{error}</p>}
    </div>
  );
}
