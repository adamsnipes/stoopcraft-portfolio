'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ClientOption } from './page';

export function EmailComposer({
  clients,
  testRecipient,
}: {
  clients: ClientOption[];
  testRecipient: string;
}) {
  const router = useRouter();
  const [clientId, setClientId] = useState<string>('');
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState<null | 'send' | 'test'>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function pickClient(id: string) {
    setClientId(id);
    const match = clients.find((c) => c.id === id);
    if (match) setTo(match.email);
    setError(null);
  }

  function editTo(value: string) {
    setTo(value);
    // Manually editing the address breaks the dropdown association.
    if (clientId) setClientId('');
  }

  const emailLooksValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to.trim());

  async function submit(test: boolean) {
    setError(null);
    setNotice(null);

    if (!subject.trim()) {
      setError('Add a subject.');
      return;
    }
    if (!body.trim()) {
      setError('Write a message.');
      return;
    }
    if (!test && !emailLooksValid) {
      setError('Enter a valid recipient email (or use Send test).');
      return;
    }
    if (!test) {
      const who = clients.find((c) => c.id === clientId)?.name;
      const confirmed = window.confirm(
        `Send this email to ${to.trim()}${who ? ` (${who})` : ''}?`
      );
      if (!confirmed) return;
    }

    setBusy(test ? 'test' : 'send');
    try {
      const res = await fetch('/api/admin/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: to.trim(),
          subject: subject.trim(),
          body,
          clientId: clientId || null,
          test,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; to?: string; error?: string; detail?: string };
      if (!res.ok || !data.ok) {
        setError(data.detail || data.error || 'Send failed.');
        return;
      }
      if (test) {
        setNotice(`Test sent to ${data.to}. Check that inbox before sending for real.`);
      } else {
        setNotice(`Email sent to ${data.to}.`);
        setSubject('');
        setBody('');
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error.');
    } finally {
      setBusy(null);
    }
  }

  const inputClass =
    'mt-1 block w-full border border-ink-900/10 rounded-lg px-3 py-2 text-sm bg-white';

  return (
    <div className="bg-white rounded-2xl border border-ink-900/10 p-6 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-widest text-ink-700">Client</span>
          <select
            value={clientId}
            onChange={(e) => pickClient(e.target.value)}
            className={inputClass}
          >
            <option value="">Choose a client…</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id} disabled={!c.email}>
                {c.name}
                {c.email ? '' : ' (no email on file)'}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-widest text-ink-700">To</span>
          <input
            type="email"
            value={to}
            onChange={(e) => editTo(e.target.value)}
            placeholder="client@example.com"
            className={inputClass}
          />
        </label>
      </div>

      <label className="block mt-4">
        <span className="text-xs font-semibold uppercase tracking-widest text-ink-700">Subject</span>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Subject line"
          className={inputClass}
        />
      </label>

      <label className="block mt-4">
        <span className="text-xs font-semibold uppercase tracking-widest text-ink-700">Message</span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={10}
          placeholder={'Hi there,\n\nWrite your message here. Blank lines start a new paragraph.\n\n— StoopCraft'}
          className={`${inputClass} resize-y leading-relaxed`}
        />
      </label>
      <p className="text-xs text-ink-700/60 mt-1">
        Plain text — it&apos;s wrapped in the branded StoopCraft email layout automatically.
      </p>

      <div className="flex items-center gap-3 flex-wrap mt-5">
        <button
          type="button"
          onClick={() => submit(false)}
          disabled={busy !== null}
          className="bg-ink-900 text-cream-50 px-4 py-2 rounded-lg text-sm font-medium hover:bg-ink-800 disabled:opacity-50 transition-colors"
        >
          {busy === 'send' ? 'Sending…' : 'Send email'}
        </button>
        <button
          type="button"
          onClick={() => submit(true)}
          disabled={busy !== null}
          className="border border-ink-900/15 text-ink-900 px-4 py-2 rounded-lg text-sm font-medium hover:bg-ink-900/5 disabled:opacity-50 transition-colors"
        >
          {busy === 'test' ? 'Sending test…' : `Send test → ${testRecipient}`}
        </button>
      </div>

      {error && <p className="text-sm text-red-700 mt-3">{error}</p>}
      {notice && <p className="text-sm text-emerald-700 mt-3">{notice}</p>}
    </div>
  );
}
