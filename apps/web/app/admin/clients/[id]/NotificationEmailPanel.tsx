'use client';

import { useState } from 'react';

export function NotificationEmailPanel({
  clientId,
  currentEmail,
}: {
  clientId: string;
  currentEmail: string | null;
}) {
  const [email, setEmail] = useState(currentEmail ?? '');
  const [saved, setSaved] = useState(currentEmail ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = email.trim() !== (saved ?? '');

  async function handleSave() {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/clients/${clientId}/notification-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notification_email: email.trim() }),
      });
      const data = (await res.json()) as { error?: string; notification_email?: string | null };
      if (!res.ok) {
        setError(data.error === 'validation_failed' ? 'Enter a valid email (or leave blank to clear).' : (data.error ?? 'failed'));
        return;
      }
      setSaved(data.notification_email ?? '');
      setEmail(data.notification_email ?? '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'network_error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-ink-900/10 p-6 mb-4 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
      <h2 className="font-display text-lg font-medium mb-1">Lead notification email</h2>
      <p className="text-xs text-ink-700 mb-4">
        Where this site&apos;s form submissions are emailed. Set it <strong>before</strong> they pay so they can
        watch their forms deliver real leads while evaluating. Leave blank to fall back to the owner&apos;s account
        email after they claim.
      </p>

      <div className="space-y-3">
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-widest text-ink-700">Send leads to</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="info@theirbusiness.com"
            className="mt-1 block w-full border border-ink-900/10 rounded-lg px-3 py-2 text-sm bg-white"
          />
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
          {!dirty && saved && <span className="text-sm text-emerald-700">Leads go to {saved}</span>}
          {!dirty && !saved && <span className="text-sm text-ink-700/60">No address set — falls back to owner.</span>}
        </div>

        {error && <p className="text-sm text-red-700">Error: {error}</p>}
      </div>
    </div>
  );
}
