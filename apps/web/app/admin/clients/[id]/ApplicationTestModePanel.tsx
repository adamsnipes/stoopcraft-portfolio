'use client';

import { useState } from 'react';

// Admin toggle for application-email test mode. When on, /api/application routes
// each submitted application PDF to the ops inbox (ADMIN_EMAIL), marked [TEST],
// instead of the client owner — for verifying the flow before go-live. Scoped to
// the application endpoint only; lead emails are unaffected. Turn off to deliver
// to the owner. No deploy needed — this writes a per-client DB flag.
export function ApplicationTestModePanel({
  clientId,
  currentEnabled,
}: {
  clientId: string;
  currentEnabled: boolean;
}) {
  const [enabled, setEnabled] = useState(currentEnabled);
  const [savedEnabled, setSavedEnabled] = useState(currentEnabled);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = enabled !== savedEnabled;

  async function handleSave() {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/clients/${clientId}/application-test-mode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ application_test_mode: enabled }),
      });
      const data = (await res.json()) as { error?: string; application_test_mode?: boolean };
      if (!res.ok) {
        setError(data.error ?? 'failed');
        return;
      }
      setSavedEnabled(!!data.application_test_mode);
      setEnabled(!!data.application_test_mode);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'network_error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-ink-900/10 p-6 mb-4 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
      <h2 className="font-display text-lg font-medium mb-1">Application test mode</h2>
      <p className="text-xs text-ink-700 mb-4">
        When on, driver/employment applications submitted on this site are emailed (with the PDF) to
        the <strong>ops inbox</strong> instead of the owner — marked <strong>[TEST]</strong> and naming
        the real recipient. Use it to confirm the flow before go-live, then turn it off so applications
        deliver to the owner. Lead forms are unaffected.
      </p>

      <div className="space-y-3">
        <label className="flex items-center gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="h-4 w-4 rounded border-ink-900/20"
          />
          <span className="text-sm font-medium">Send applications to the ops inbox (test)</span>
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
          {!dirty && savedEnabled && (
            <span className="text-sm text-amber-700">Test mode ON — applications go to the ops inbox.</span>
          )}
          {!dirty && !savedEnabled && (
            <span className="text-sm text-emerald-700">Live — applications deliver to the owner.</span>
          )}
        </div>

        {error && <p className="text-sm text-red-700">Error: {error}</p>}
      </div>
    </div>
  );
}
