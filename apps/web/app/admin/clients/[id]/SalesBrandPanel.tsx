'use client';

import { useState } from 'react';
import { CHEAP_BRAND } from '@/lib/marketing-brand';

type Brand = 'stoopcraft' | typeof CHEAP_BRAND.id;

const LABELS: Record<Brand, string> = {
  stoopcraft: 'StoopCraft',
  [CHEAP_BRAND.id]: `${CHEAP_BRAND.name} ($${CHEAP_BRAND.monthly}/mo)`,
};

// Which brand this client is sold under. Stupid Cheap Websites clients get that
// brand's claim banner, pay page on its own domain, Stripe Checkout branding
// and $40 price, welcome page and activation emails. Locked once claimed.
export function SalesBrandPanel({
  clientId,
  currentBrand,
  status,
  cheapPayUrl,
}: {
  clientId: string;
  currentBrand: Brand;
  status: string;
  cheapPayUrl: string;
}) {
  const [brand, setBrand] = useState<Brand>(currentBrand);
  const [savedBrand, setSavedBrand] = useState<Brand>(currentBrand);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const dirty = brand !== savedBrand;
  const locked = status === 'claimed';

  async function handleSave() {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/clients/${clientId}/brand`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand }),
      });
      const data = (await res.json()) as { error?: string; brand?: Brand };
      if (!res.ok || !data.brand) {
        setError(data.error ?? 'failed');
        return;
      }
      setSavedBrand(data.brand);
      setBrand(data.brand);
      // The billing tab swaps payment panels by brand; reload to show the right one.
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'network_error');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(cheapPayUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="bg-white rounded-xl border border-ink-900/10 p-6 mb-4 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
      <h2 className="font-display text-lg font-medium mb-1">Sales brand</h2>
      <p className="text-xs text-ink-700 mb-4">
        {CHEAP_BRAND.name} clients see only that brand: its claim banner, launch page on{' '}
        {CHEAP_BRAND.domain}, Stripe checkout at ${CHEAP_BRAND.monthly}/mo, and its emails.
        {locked && ' Locked: this client has already paid.'}
      </p>

      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={brand}
          onChange={(e) => setBrand(e.target.value as Brand)}
          disabled={locked || submitting}
          className="border border-ink-900/15 rounded-lg px-3 py-2 text-sm bg-white"
        >
          {(Object.keys(LABELS) as Brand[]).map((b) => (
            <option key={b} value={b}>{LABELS[b]}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleSave}
          disabled={locked || submitting || !dirty}
          className="bg-ink-900 text-cream-50 px-4 py-2 rounded-lg text-sm font-medium hover:bg-ink-800 disabled:opacity-50 transition-colors"
        >
          {submitting ? 'Saving…' : 'Save'}
        </button>
      </div>

      {savedBrand === CHEAP_BRAND.id && !locked && (
        <div className="mt-5">
          <p className="text-sm font-medium mb-2">Launch page link</p>
          <div className="flex gap-2">
            <input readOnly value={cheapPayUrl} className="flex-1 min-w-0 border border-ink-900/15 rounded-lg px-3 py-2 text-sm font-mono bg-cream-50" />
            <button type="button" onClick={handleCopy} className="border border-ink-900/15 px-4 py-2 rounded-lg text-sm font-medium hover:bg-cream-50">
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <p className="text-xs text-ink-700/70 mt-2">
            The StoopCraft payment links are hidden for this client so it can’t be sent a StoopCraft price by mistake.
          </p>
        </div>
      )}

      {error && <p className="text-sm text-red-700 mt-3">Error: {error}</p>}
    </div>
  );
}
