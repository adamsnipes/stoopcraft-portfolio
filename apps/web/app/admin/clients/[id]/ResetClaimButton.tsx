'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

export function ResetClaimButton({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [resetting, setResetting] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function handleReset() {
    if (!confirm('Reset claim? Wipes owner, plan, Stripe IDs and sets status=live.')) return;
    setError(null);
    setResetting(true);
    try {
      const res = await fetch(`/api/admin/clients/${clientId}/unclaim`, {
        method: 'POST',
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? `failed (${res.status})`);
        setResetting(false);
        return;
      }
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'network_error');
      setResetting(false);
    }
  }

  const busy = resetting || isPending;

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={handleReset}
        disabled={busy}
        className="bg-white border border-amber-200 text-amber-800 rounded-lg px-4 py-2 text-sm hover:bg-amber-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {busy ? 'Resetting…' : 'Reset claim'}
      </button>
      {error && <span className="text-xs text-red-700">{error}</span>}
    </div>
  );
}
