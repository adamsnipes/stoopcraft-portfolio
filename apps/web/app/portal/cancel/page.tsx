'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const REASONS = [
  'Too expensive',
  'Not using it enough',
  'Switching to another service',
  'Business closed or paused',
  'Missing a feature I need',
  'Other',
];

export default function CancelPage() {
  const router = useRouter();
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleCancel(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const res = await fetch('/api/portal/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });

    const data = await res.json() as { error?: string };
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? 'Something went wrong.');
    } else {
      router.push('/portal?cancelled=1');
    }
  }

  return (
    <div className="max-w-md space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Cancel subscription</h1>
        <p className="text-sm text-gray-400 mt-1">
          Your site stays live until the end of the billing period. Data is preserved for 60 days — reactivate anytime.
        </p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 space-y-1">
        <p className="text-sm font-semibold text-amber-800">Before you go</p>
        <p className="text-xs text-amber-700">If something isn&apos;t working, we&apos;d love a chance to fix it. Email us at <a href="mailto:hello@stoopcraft.com" className="underline">hello@stoopcraft.com</a> — we respond within 24 hours.</p>
      </div>

      <form onSubmit={handleCancel} className="space-y-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Why are you leaving? <span className="normal-case font-normal">(optional)</span></p>
          <div className="space-y-2">
            {REASONS.map((r) => (
              <label key={r} className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 cursor-pointer transition-all ${reason === r ? 'border-gray-900 bg-gray-50' : 'border-gray-200 hover:border-gray-300'}`}>
                <input
                  type="radio"
                  name="reason"
                  value={r}
                  checked={reason === r}
                  onChange={() => setReason(r)}
                  className="sr-only"
                />
                <span className={`w-4 h-4 shrink-0 rounded-full border-2 flex items-center justify-center transition-colors ${reason === r ? 'border-gray-900' : 'border-gray-300'}`}>
                  {reason === r && <span className="w-2 h-2 rounded-full bg-gray-900" />}
                </span>
                <span className="text-sm text-gray-700">{r}</span>
              </label>
            ))}
          </div>
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex-1 border border-gray-200 rounded-xl py-3 text-sm font-semibold text-gray-700 hover:border-gray-400 transition-all"
          >
            Never mind
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white py-3 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
          >
            {loading ? 'Cancelling…' : 'Confirm cancel'}
          </button>
        </div>
      </form>
    </div>
  );
}
