'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

// Pause is a reversible kill switch: status=paused serves a branded 503 while
// data + billing are preserved. Resuming restores the pre-pause public state —
// 'claimed' if the site was ever claimed (claimed_at set), otherwise 'live'.
// (We don't persist the prior status, so claimed_at is the reliable signal.)

type Props = {
  clientId: string;
  status: string;
  claimedAt: string | null;
  variant?: 'inline' | 'block' | 'quiet';
};

export function PauseClientButton({ clientId, status, claimedAt, variant = 'inline' }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const isPaused = status === 'paused';
  // Only live/claimed sites are publicly serving and thus pausable. Draft and
  // cancelled sites have nothing to pause.
  const pausable = isPaused || status === 'live' || status === 'claimed';
  if (!pausable) return null;

  const nextStatus = isPaused ? (claimedAt ? 'claimed' : 'live') : 'paused';

  async function handleClick() {
    setLoading(true);
    setToast(null);
    try {
      const res = await fetch(`/api/admin/clients/${clientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setToast({ msg: data.error ?? `Failed (${res.status})`, ok: false });
        setTimeout(() => setToast(null), 4000);
        setLoading(false);
        return;
      }
      setToast({ msg: isPaused ? 'Site resumed' : 'Site paused', ok: true });
      setTimeout(() => setToast(null), 3000);
      router.refresh();
    } catch (err) {
      setToast({ msg: err instanceof Error ? err.message : 'network_error', ok: false });
      setTimeout(() => setToast(null), 4000);
    } finally {
      setLoading(false);
    }
  }

  const busyLabel = isPaused ? 'Resuming…' : 'Pausing…';
  const idleLabel = isPaused ? 'Resume' : 'Pause';

  if (variant === 'quiet') {
    return (
      <div className="relative">
        <button
          type="button"
          onClick={handleClick}
          disabled={loading}
          className="bg-white border border-yellow-200 text-yellow-800 rounded-lg px-4 py-2 text-sm hover:bg-yellow-50 disabled:opacity-50 transition-colors"
        >
          {loading ? busyLabel : isPaused ? 'Resume site' : 'Pause site'}
        </button>
        {toast && (
          <div className={`absolute left-0 top-11 z-10 text-xs font-medium px-3 py-1.5 rounded-lg shadow-sm whitespace-nowrap ${
            toast.ok ? 'bg-emerald-900 text-white' : 'bg-red-600 text-white'
          }`}>
            {toast.msg}
          </div>
        )}
      </div>
    );
  }

  if (variant === 'block') {
    return (
      <div className="relative">
        <button
          type="button"
          onClick={handleClick}
          disabled={loading}
          className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded text-sm font-semibold disabled:opacity-50 transition-colors"
        >
          {loading ? busyLabel : isPaused ? 'Resume Now' : 'Pause Now'}
        </button>
        {toast && (
          <div className={`mt-2 text-xs font-medium ${toast.ok ? 'text-emerald-700' : 'text-red-600'}`}>
            {toast.msg}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="text-xs font-medium text-yellow-700 hover:text-yellow-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? busyLabel : idleLabel}
      </button>
      {toast && (
        <div className={`absolute right-0 top-6 z-10 text-xs font-medium px-3 py-1.5 rounded-lg shadow-sm whitespace-nowrap ${
          toast.ok ? 'bg-emerald-900 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
