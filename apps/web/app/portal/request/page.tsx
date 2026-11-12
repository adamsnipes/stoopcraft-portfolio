'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const EXAMPLES = [
  'Update my hours to Mon–Fri 9am–7pm, Sat 8am–5pm, closed Sunday',
  'Add "Brazilian Blowout — $120" to the services list',
  'Replace the hero photo with the new one I\'ll email you',
  'Change my phone number to (555) 123-4567',
];

export default function RequestChangePage() {
  const router = useRouter();
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setLoading(true);
    setError('');

    const res = await fetch('/api/portal/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body }),
    });

    const data = await res.json() as { error?: string; message?: string };
    setLoading(false);

    if (!res.ok) {
      setError(data.message ?? data.error ?? 'Something went wrong. Please try again.');
    } else {
      router.push('/portal?requested=1');
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Request a change</h1>
        <p className="text-sm text-gray-400 mt-1">
          Describe what you&apos;d like updated. We&apos;ll get it done within 24 hours on business days.
        </p>
      </div>

      {/* Examples */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">Common requests</p>
        <div className="grid grid-cols-2 gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => setBody(ex)}
              className="text-left text-xs text-gray-600 bg-white border border-gray-200 rounded-xl px-3 py-2.5 hover:border-gray-400 hover:text-gray-900 transition-all leading-snug"
            >
              &ldquo;{ex}&rdquo;
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">Your request</p>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={6}
            required
            placeholder="Describe exactly what you'd like changed — the more detail, the better."
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900 transition resize-none"
          />
          <p className="text-xs text-gray-400 mt-1.5">{body.length} characters</p>
        </div>

        {error && (
          <div className="rounded-xl border bg-red-50 border-red-200 text-red-700 px-4 py-3 text-sm">
            <p>{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !body.trim()}
          className="w-full bg-gray-900 hover:bg-gray-800 text-white py-3 rounded-xl font-semibold text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? 'Submitting…' : 'Submit request'}
        </button>
      </form>
    </div>
  );
}
