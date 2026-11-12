'use client';

import { useState } from 'react';

export function MarkPaidCashPanel({ clientId }: { clientId: string }) {
  const [email, setEmail] = useState('');
  const [note, setNote] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/clients/${clientId}/mark-paid-cash`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, note: note || undefined }),
      });
      const data = (await res.json()) as { error?: string; detail?: string };
      if (!res.ok) {
        const msg =
          data.error === 'already_claimed'
            ? 'This customer is already claimed.'
            : `${data.error ?? 'failed'}${data.detail ? ` — ${data.detail}` : ''}`;
        setError(msg);
        return;
      }
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'network_error');
    } finally {
      setSubmitting(false);
      setConfirming(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-ink-900/10 p-6 mb-4 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
      <h2 className="font-display text-lg font-medium mb-1">Mark paid (cash)</h2>
      <p className="text-xs text-ink-700 mb-4">
        Setup plan only — $300 one-time. Use when paid by cash, check, or anything outside Stripe.
      </p>

      <div className="space-y-3">
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-widest text-ink-700">Customer email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="customer@example.com"
            className="mt-1 block w-full border border-ink-900/10 rounded-lg px-3 py-2 text-sm bg-white"
          />
        </label>

        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-widest text-ink-700">Note (optional)</span>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. paid by check #1024"
            className="mt-1 block w-full border border-ink-900/10 rounded-lg px-3 py-2 text-sm bg-white"
          />
        </label>

        {!confirming ? (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            disabled={!email.trim()}
            className="bg-ink-900 text-cream-50 px-4 py-2 rounded-lg text-sm font-medium hover:bg-ink-800 disabled:opacity-50 transition-colors"
          >
            Mark paid (cash)
          </button>
        ) : (
          <div className="flex gap-2 flex-wrap items-center pt-1">
            <span className="text-sm text-ink-900">
              Confirm — claim this customer with email <strong>{email}</strong>?
            </span>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-800 disabled:opacity-50 transition-colors"
            >
              {submitting ? 'Working…' : 'Yes, claim'}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={submitting}
              className="bg-white border border-ink-900/10 px-4 py-2 rounded-lg text-sm hover:bg-ink-900/5 transition-colors"
            >
              Cancel
            </button>
          </div>
        )}

        {error && <p className="text-sm text-red-700">Error: {error}</p>}
      </div>
    </div>
  );
}
