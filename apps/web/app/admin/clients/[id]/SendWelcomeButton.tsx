'use client';

import { useState } from 'react';

export function SendWelcomeButton({
  clientId,
  disabled,
  disabledReason,
}: {
  clientId: string;
  disabled: boolean;
  disabledReason?: string;
}) {
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function handleSend() {
    if (!confirm('Send the welcome email to this customer?')) return;
    setSending(true);
    setResult(null);
    try {
      const res = await fetch(`/api/admin/clients/${clientId}/send-welcome`, {
        method: 'POST',
      });
      const data = (await res.json()) as { ok?: boolean; site_url?: string; error?: string };
      if (res.ok && data.ok) {
        setResult({ ok: true, message: `Sent — links to ${data.site_url}` });
      } else {
        setResult({ ok: false, message: data.error ?? 'failed' });
      }
    } catch (err) {
      setResult({ ok: false, message: err instanceof Error ? err.message : 'network_error' });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={handleSend}
        disabled={disabled || sending}
        title={disabled ? disabledReason : undefined}
        className="bg-white border border-ink-900/10 rounded-lg px-4 py-2 text-sm hover:border-ink-900/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {sending ? 'Sending…' : 'Send welcome email'}
      </button>
      {result && (
        <p className={`text-xs ${result.ok ? 'text-emerald-700' : 'text-red-700'}`}>
          {result.message}
        </p>
      )}
    </div>
  );
}
