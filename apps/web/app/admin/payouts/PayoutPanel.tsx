'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

function dollars(cents: number): string {
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function PayoutPanel({
  repId,
  totalCents,
  method,
  destination,
}: {
  repId: string;
  totalCents: number;
  method: string;
  destination: string;
}) {
  const router = useRouter();
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  async function copyDestination() {
    try {
      await navigator.clipboard.writeText(destination);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* user can still select-copy from the readonly input */
    }
  }

  async function submit() {
    if (!confirm(`Mark ${dollars(totalCents)} as paid? This flips every pending ledger row to paid.`)) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/reps/${repId}/payouts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reference: reference.trim() || null,
          notes: notes.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error ?? 'Failed');
        return;
      }
      setReference('');
      setNotes('');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const isVenmo = method === 'venmo';
  const displayDest = isVenmo ? `@${destination}` : destination;
  const externalLabel =
    method === 'paypal' ? 'Open PayPal' : isVenmo ? 'Open Venmo' : 'Send payment';
  const externalUrl =
    method === 'paypal'
      ? 'https://www.paypal.com/myaccount/transfer/homepage/send'
      : isVenmo
      ? `https://venmo.com/?txn=pay&recipients=${encodeURIComponent(destination)}&amount=${(totalCents / 100).toFixed(2)}`
      : null;

  return (
    <section className="bg-white border border-ink-900/10 rounded-2xl p-5 space-y-4">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <h2 className="font-display text-xl tracking-tight">
          Issue payout — {dollars(totalCents)}
        </h2>
        <div className="text-xs text-ink-700/60">
          Cadence: 1st &amp; 15th of every month
        </div>
      </div>

      <div className="bg-cream-50 border border-ink-900/10 rounded-xl p-4 space-y-3">
        <div className="text-xs uppercase tracking-wider text-ink-700/60 font-semibold">
          Step 1: send the money
        </div>
        <div className="flex items-center gap-2">
          <input
            readOnly
            value={displayDest}
            onFocus={(e) => e.currentTarget.select()}
            className="flex-1 border border-ink-900/10 rounded-lg px-3 py-2 bg-white font-mono text-sm"
          />
          <button
            type="button"
            onClick={copyDestination}
            className="bg-ink-900 text-cream-50 px-3 py-2 rounded-lg text-sm font-medium hover:bg-ink-800 whitespace-nowrap"
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
          {externalUrl && (
            <a
              href={externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-amber-accent text-ink-900 px-3 py-2 rounded-lg text-sm font-medium hover:brightness-95 whitespace-nowrap"
            >
              {externalLabel} →
            </a>
          )}
        </div>
        <p className="text-xs text-ink-700/60">
          Send <strong>{dollars(totalCents)}</strong> via{' '}
          <strong className="uppercase">{method}</strong>, then come back and confirm below.
        </p>
      </div>

      <div className="bg-cream-50 border border-ink-900/10 rounded-xl p-4 space-y-3">
        <div className="text-xs uppercase tracking-wider text-ink-700/60 font-semibold">
          Step 2: record it
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input
            placeholder="Transaction ID / reference"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            className="border border-ink-900/10 rounded-lg px-3 py-2 bg-white"
          />
          <input
            placeholder="Notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="border border-ink-900/10 rounded-lg px-3 py-2 bg-white"
          />
        </div>
        {error && <p className="text-sm text-red-700">{error}</p>}
        <button
          onClick={submit}
          disabled={busy}
          className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
        >
          {busy ? 'Working…' : `Mark ${dollars(totalCents)} as paid`}
        </button>
      </div>
    </section>
  );
}
