'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function RefetchPhotosButton({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function handleClick() {
    setState('loading');
    setMessage('');
    try {
      const res = await fetch(`/api/admin/clients/${clientId}/photos/refetch`, {
        method: 'POST',
      });
      const data = (await res.json()) as { stored?: number; refs_found?: number; message?: string };
      if (res.ok) {
        setMessage(`Stored ${data.stored ?? 0} of ${data.refs_found ?? 0} photos.`);
        setState('done');
        router.refresh();
      } else {
        setMessage(data.message ?? 'Failed to fetch photos.');
        setState('error');
      }
    } catch {
      setMessage('Network error.');
      setState('error');
    }
  }

  return (
    <div className="flex items-center gap-3">
      {message && (
        <span className={`text-sm ${state === 'error' ? 'text-red-600' : 'text-green-700'}`}>
          {message}
        </span>
      )}
      <button
        onClick={handleClick}
        disabled={state === 'loading'}
        className="bg-gray-900 text-white px-4 py-2 rounded text-sm disabled:opacity-50"
      >
        {state === 'loading' ? 'Fetching…' : 'Re-fetch Photos'}
      </button>
    </div>
  );
}
