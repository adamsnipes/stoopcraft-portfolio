'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Method = 'paypal' | 'venmo';

const VENMO_RE = /^[a-zA-Z0-9._-]{5,30}$/;

function validate(method: Method, destination: string): string | null {
  const trimmed = destination.trim();
  if (!trimmed) return 'required';
  if (method === 'paypal') {
    // Plain email regex — strict-enough for client-side; server re-checks.
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
    return ok ? null : 'must be a valid email';
  }
  const handle = trimmed.replace(/^@/, '');
  if (!VENMO_RE.test(handle)) return 'handle must be 5-30 letters/numbers/._-';
  return null;
}

export function PayoutSettingsForm({
  initialMethod,
  initialDestination,
}: {
  initialMethod: Method | null;
  initialDestination: string;
}) {
  const router = useRouter();
  const [method, setMethod] = useState<Method>(initialMethod ?? 'paypal');
  const [destination, setDestination] = useState(initialDestination);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const localError = validate(method, destination);

  async function save() {
    if (localError) {
      setError(localError);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/reps/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payout_method: method, payout_destination: destination.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error ?? 'save_failed');
        return;
      }
      setSavedAt(Date.now());
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-semibold text-ink-700 uppercase tracking-wider mb-2">
          How should we pay you?
        </label>
        <div className="flex gap-2">
          <MethodRadio
            value="paypal"
            label="PayPal"
            sub="Send to an email"
            selected={method === 'paypal'}
            onChange={() => setMethod('paypal')}
          />
          <MethodRadio
            value="venmo"
            label="Venmo"
            sub="Send to a @handle"
            selected={method === 'venmo'}
            onChange={() => setMethod('venmo')}
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-ink-700 uppercase tracking-wider mb-1.5">
          {method === 'paypal' ? 'PayPal email' : 'Venmo handle'}
        </label>
        <input
          type={method === 'paypal' ? 'email' : 'text'}
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          placeholder={method === 'paypal' ? 'you@example.com' : '@your-handle'}
          className="w-full border border-ink-900/10 rounded-lg px-3 py-2 bg-cream-50 focus:outline-none focus:border-amber-accent"
        />
        {method === 'venmo' && (
          <p className="text-xs text-ink-700/60 mt-1">
            Just the handle — the @ is optional.
          </p>
        )}
      </div>

      {error && <p className="text-sm text-red-700">{error}</p>}

      <button
        onClick={save}
        disabled={saving || !!localError}
        className="bg-ink-900 text-cream-50 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-ink-800 disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Save'}
      </button>
      {savedAt && (
        <span className="text-xs text-emerald-700 ml-3">Saved.</span>
      )}
    </div>
  );
}

function MethodRadio({
  value,
  label,
  sub,
  selected,
  onChange,
}: {
  value: string;
  label: string;
  sub: string;
  selected: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`flex-1 text-left rounded-xl border px-4 py-3 transition-colors ${
        selected
          ? 'border-amber-accent bg-amber-accent/10'
          : 'border-ink-900/10 bg-cream-50 hover:border-ink-900/20'
      }`}
    >
      <input type="radio" value={value} checked={selected} onChange={onChange} className="sr-only" />
      <div className="font-medium">{label}</div>
      <div className="text-xs text-ink-700/60 mt-0.5">{sub}</div>
    </button>
  );
}
