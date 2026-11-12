'use client';

import { useState } from 'react';

export function SmsNotificationPanel({
  clientId,
  currentEnabled,
  currentPhone,
}: {
  clientId: string;
  currentEnabled: boolean;
  currentPhone: string | null;
}) {
  const [enabled, setEnabled] = useState(currentEnabled);
  const [phone, setPhone] = useState(currentPhone ?? '');
  const [savedEnabled, setSavedEnabled] = useState(currentEnabled);
  const [savedPhone, setSavedPhone] = useState(currentPhone ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = enabled !== savedEnabled || phone.trim() !== (savedPhone ?? '');

  async function handleSave() {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/clients/${clientId}/sms-notifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sms_notifications_enabled: enabled, notification_phone: phone.trim() }),
      });
      const data = (await res.json()) as {
        error?: string;
        sms_notifications_enabled?: boolean;
        notification_phone?: string | null;
      };
      if (!res.ok) {
        setError(
          data.error === 'invalid_phone'
            ? 'Enter a valid US phone number (or leave blank to clear).'
            : (data.error ?? 'failed'),
        );
        return;
      }
      setSavedEnabled(!!data.sms_notifications_enabled);
      setEnabled(!!data.sms_notifications_enabled);
      setSavedPhone(data.notification_phone ?? '');
      setPhone(data.notification_phone ?? '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'network_error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-ink-900/10 p-6 mb-4 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
      <h2 className="font-display text-lg font-medium mb-1">Lead notification texts (upsell)</h2>
      <p className="text-xs text-ink-700 mb-4">
        Texts new form leads to the client&apos;s phone, on top of the email. This is a <strong>paid add-on</strong> —
        only turn it on once they&apos;ve purchased it. Texts send in addition to the notification email; leave the
        toggle off and no texts are sent.
      </p>

      <div className="space-y-3">
        <label className="flex items-center gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="h-4 w-4 rounded border-ink-900/20"
          />
          <span className="text-sm font-medium">SMS upsell purchased — text this client their leads</span>
        </label>

        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-widest text-ink-700">Text leads to</span>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="(415) 555-1212"
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
          {!dirty && savedEnabled && savedPhone && (
            <span className="text-sm text-emerald-700">Texting leads to {savedPhone}</span>
          )}
          {!dirty && savedEnabled && !savedPhone && (
            <span className="text-sm text-amber-700">Enabled, but no number set — no texts will send.</span>
          )}
          {!dirty && !savedEnabled && <span className="text-sm text-ink-700/60">Off — not purchased.</span>}
        </div>

        {error && <p className="text-sm text-red-700">Error: {error}</p>}
      </div>
    </div>
  );
}
