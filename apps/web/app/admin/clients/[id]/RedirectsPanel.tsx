'use client';

import { useState } from 'react';

export function RedirectsPanel({ clientId, currentText }: { clientId: string; currentText: string }) {
  const [text, setText] = useState(currentText);
  const [saved, setSaved] = useState(currentText);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const dirty = text !== saved;

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/clients/${clientId}/redirects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const data = (await res.json()) as { count?: number; error?: string };
      if (res.ok) {
        setSaved(text);
        setMsg(`Saved — ${data.count ?? 0} redirect${data.count === 1 ? '' : 's'} active`);
      } else {
        setMsg(`Error: ${data.error ?? 'save failed'}`);
      }
    } catch {
      setMsg('Network error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-ink-900/10 p-6 mb-4 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
      <h2 className="font-display text-lg font-medium mb-1">Redirects (301)</h2>
      <p className="text-xs text-ink-700 mb-3">
        Preserve backlinks when moving off the old site: 301 old URLs to new ones. One rule per line —{' '}
        <code className="text-[11px]">/old-path -&gt; /new-path</code>. Lines starting with <code>#</code> are
        ignored. Applied to any path that would otherwise 404.
      </p>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        spellCheck={false}
        placeholder={'/services -> /\n/about -> /#about\n/blog/old-post -> /blog/new-post'}
        className="block w-full border border-ink-900/10 rounded-lg px-3 py-2 text-sm bg-white font-mono"
      />

      <div className="flex items-center gap-3 mt-3">
        <button
          type="button"
          onClick={save}
          disabled={busy || !dirty}
          className="bg-ink-900 text-cream-50 px-4 py-2 rounded-lg text-sm font-medium hover:bg-ink-800 disabled:opacity-50 transition-colors"
        >
          {busy ? 'Saving…' : 'Save redirects'}
        </button>
        {msg && <span className="text-sm text-emerald-700">{msg}</span>}
      </div>
    </div>
  );
}
