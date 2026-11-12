'use client';

import { useState } from 'react';

// Admin toggle for the pre-sale "claim this site" banner. The banner shows
// automatically on every unclaimed (status='live') preview and links to
// /pay/[id]; check this box to suppress it — mainly for demo/sample builds we
// keep live for the portfolio, where there's no real prospect to bill.
export function ClaimBannerPanel({
  clientId,
  currentHidden,
  status,
}: {
  clientId: string;
  currentHidden: boolean;
  status: string;
}) {
  const [hidden, setHidden] = useState(currentHidden);
  const [savedHidden, setSavedHidden] = useState(currentHidden);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = hidden !== savedHidden;
  const isClaimed = status === 'claimed';

  async function handleSave() {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/clients/${clientId}/claim-banner`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hide_claim_banner: hidden }),
      });
      const data = (await res.json()) as { error?: string; hide_claim_banner?: boolean };
      if (!res.ok) {
        setError(data.error ?? 'failed');
        return;
      }
      setSavedHidden(!!data.hide_claim_banner);
      setHidden(!!data.hide_claim_banner);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'network_error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-ink-900/10 p-6 mb-4 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
      <h2 className="font-display text-lg font-medium mb-1">Claim banner</h2>
      <p className="text-xs text-ink-700 mb-4">
        Unclaimed previews show a sticky bar linking straight to this client&apos;s checkout page, so
        they can claim &amp; pay from the preview link. It removes itself once the site is claimed.
        Hide it for <strong>demo / sample builds</strong> you keep live for the portfolio.
      </p>

      <div className="space-y-3">
        <label className="flex items-center gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={hidden}
            onChange={(e) => setHidden(e.target.checked)}
            className="h-4 w-4 rounded border-ink-900/20"
          />
          <span className="text-sm font-medium">Hide the claim banner on this site (demo)</span>
        </label>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={handleSave}
            disabled={submitting || !dirty}
            className="bg-ink-900 text-cream-50 px-4 py-2 rounded-lg text-sm font-medium hover:bg-ink-800 disabled:opacity-50 transition-colors"
          >
            {submitting ? 'Saving…' : 'Save'}
          </button>
          {!dirty && isClaimed && (
            <span className="text-sm text-ink-700/60">Site is claimed — banner never shows regardless.</span>
          )}
          {!dirty && !isClaimed && savedHidden && (
            <span className="text-sm text-amber-700">Hidden — no claim banner on the preview.</span>
          )}
          {!dirty && !isClaimed && !savedHidden && (
            <span className="text-sm text-emerald-700">Showing on the preview.</span>
          )}
        </div>

        {error && <p className="text-sm text-red-700">Error: {error}</p>}
      </div>
    </div>
  );
}
