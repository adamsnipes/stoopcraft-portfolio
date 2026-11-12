'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { RepLeadRow } from '@dfy/db';

const STATUS_LABELS: Record<RepLeadRow['status'], string> = {
  contacted: 'Contacted',
  interested: 'Interested',
  converted: 'Converted',
  dead: 'Dead',
};

const STATUS_BADGE: Record<string, string> = {
  contacted: 'bg-ink-900/5 text-ink-700 border-ink-900/10',
  interested: 'bg-amber-accent/10 text-amber-accent border-amber-accent/30',
  converted: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  dead: 'bg-red-50 text-red-700 border-red-200',
};

export function LeadsList({ initialLeads }: { initialLeads: RepLeadRow[] }) {
  const router = useRouter();
  const [leads, setLeads] = useState(initialLeads);
  const [, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ business_name: '', phone: '', email: '', notes: '' });
  const [error, setError] = useState('');

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const res = await fetch('/api/reps/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draft),
    });
    if (!res.ok) {
      setError('Could not save lead');
      return;
    }
    const { lead } = await res.json();
    setLeads((prev) => [lead, ...prev]);
    setDraft({ business_name: '', phone: '', email: '', notes: '' });
    setAdding(false);
  }

  async function updateStatus(id: string, status: RepLeadRow['status']) {
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l)));
    await fetch(`/api/reps/leads/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    startTransition(() => router.refresh());
  }

  async function remove(id: string) {
    if (!confirm('Delete this lead?')) return;
    setLeads((prev) => prev.filter((l) => l.id !== id));
    await fetch(`/api/reps/leads/${id}`, { method: 'DELETE' });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => setAdding((a) => !a)}
          className="bg-ink-900 text-cream-50 px-4 py-2 rounded-lg text-sm font-medium hover:bg-ink-800"
        >
          {adding ? 'Cancel' : 'Add lead'}
        </button>
      </div>

      {adding && (
        <form onSubmit={add} className="bg-white border border-ink-900/10 rounded-2xl p-4 space-y-3">
          <input
            required
            placeholder="Business name"
            value={draft.business_name}
            onChange={(e) => setDraft((d) => ({ ...d, business_name: e.target.value }))}
            className="w-full border border-ink-900/10 rounded-lg px-3 py-2 bg-cream-50"
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              placeholder="Phone (optional)"
              value={draft.phone}
              onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))}
              className="border border-ink-900/10 rounded-lg px-3 py-2 bg-cream-50"
            />
            <input
              type="email"
              placeholder="Email (optional)"
              value={draft.email}
              onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))}
              className="border border-ink-900/10 rounded-lg px-3 py-2 bg-cream-50"
            />
          </div>
          <textarea
            placeholder="Notes"
            value={draft.notes}
            onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
            className="w-full border border-ink-900/10 rounded-lg px-3 py-2 bg-cream-50 min-h-[80px]"
          />
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button
            type="submit"
            className="bg-amber-accent text-ink-900 px-4 py-2 rounded-lg text-sm font-semibold"
          >
            Save
          </button>
        </form>
      )}

      <div className="bg-white rounded-2xl border border-ink-900/10 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-cream-100/60 border-b border-ink-900/10">
            <tr>
              {['Business', 'Contact', 'Notes', 'Status', ''].map((h) => (
                <th key={h} className="text-left px-4 py-3 font-semibold text-ink-700 text-xs uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-900/5">
            {leads.map((l) => (
              <tr key={l.id} className="hover:bg-cream-50 align-top">
                <td className="px-4 py-3 font-medium">{l.business_name}</td>
                <td className="px-4 py-3 text-ink-700 text-xs">
                  {l.phone && <div>{l.phone}</div>}
                  {l.email && <div className="font-mono">{l.email}</div>}
                </td>
                <td className="px-4 py-3 text-ink-700 max-w-md whitespace-pre-wrap text-xs">
                  {l.notes ?? '—'}
                </td>
                <td className="px-4 py-3">
                  <select
                    value={l.status}
                    onChange={(e) => updateStatus(l.id, e.target.value as RepLeadRow['status'])}
                    className={`px-2 py-1 rounded-full text-xs font-medium border ${STATUS_BADGE[l.status] ?? ''}`}
                  >
                    {Object.entries(STATUS_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => remove(l.id)}
                    className="text-red-600 text-xs hover:underline"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {leads.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-ink-700/60">
                  No leads yet. Add one to start tracking your pipeline.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
