'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { btn, field } from '../ui';

const STATUSES = ['open', 'in_progress', 'done', 'declined'] as const;

type Props = { requestId: string; currentStatus: string };

export function RequestStatusForm({ requestId, currentStatus }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState(currentStatus);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const res = await fetch(`/api/admin/requests/${requestId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });

    setLoading(false);

    if (res.ok) {
      setToast('Status updated');
      setTimeout(() => setToast(null), 3000);
      router.refresh();
    } else {
      setToast('Failed to update');
      setTimeout(() => setToast(null), 3000);
    }
  }

  return (
    <div className="relative shrink-0">
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className={`${field} py-1.5 capitalize`}
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s.replace('_', ' ')}</option>
          ))}
        </select>
        <button
          type="submit"
          disabled={loading}
          className={`${btn.primary} py-1.5`}
        >
          {loading ? '…' : 'Update'}
        </button>
      </form>

      {toast && (
        <div className={`absolute right-0 top-10 z-10 text-xs font-medium px-3 py-1.5 rounded-lg shadow-sm whitespace-nowrap ${
          toast === 'Status updated' ? 'bg-ink-900 text-cream-50' : 'bg-red-600 text-white'
        }`}>
          {toast}
        </div>
      )}
    </div>
  );
}
