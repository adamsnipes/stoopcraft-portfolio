'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { SalesRepRow } from '@dfy/db';

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-amber-accent/10 text-amber-accent border-amber-accent/30',
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  disabled: 'bg-red-50 text-red-700 border-red-200',
};

const KIND_BADGE: Record<string, string> = {
  rep: 'bg-ink-900 text-cream-50 border-ink-900',
  affiliate: 'bg-cream-100 text-ink-700 border-ink-900/10',
};

type Aggregate = { customers: number; pending_cents: number };

function dollars(cents: number): string {
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function RepsAdminTable({
  reps,
  aggregates,
}: {
  reps: SalesRepRow[];
  aggregates: Record<string, Aggregate>;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function update(id: string, body: Partial<SalesRepRow>) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/reps/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(`Update failed: ${data?.error ?? res.status}`);
        return;
      }
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-ink-900/10 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-cream-100/60 border-b border-ink-900/10">
          <tr>
            {['Rep', 'Kind', 'Code', 'Customers', 'Pending', 'Rate', 'Status', ''].map((h) => (
              <th key={h} className="text-left px-4 py-3 font-semibold text-ink-700 text-xs uppercase tracking-wider">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-900/5">
          {reps.map((r) => {
            const agg = aggregates[r.id] ?? { customers: 0, pending_cents: 0 };
            return (
              <tr key={r.id} className="hover:bg-cream-50 align-middle">
                <td className="px-4 py-3">
                  <div className="font-medium">{r.name ?? '(no name)'}</div>
                  <div className="text-xs text-ink-700/60 font-mono">{r.email}</div>
                </td>
                <td className="px-4 py-3">
                  <select
                    defaultValue={r.kind}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v !== r.kind) update(r.id, { kind: v });
                    }}
                    className={`px-2 py-0.5 rounded-full text-xs font-medium border ${KIND_BADGE[r.kind] ?? ''}`}
                  >
                    <option value="rep">rep</option>
                    <option value="affiliate">affiliate</option>
                  </select>
                </td>
                <td className="px-4 py-3">
                  <input
                    defaultValue={r.code}
                    onBlur={(e) => {
                      const v = e.target.value.trim().toLowerCase();
                      if (v && v !== r.code) update(r.id, { code: v });
                    }}
                    className="font-mono text-xs bg-cream-50 border border-ink-900/10 rounded px-2 py-1 w-32"
                  />
                </td>
                <td className="px-4 py-3 text-ink-700">{agg.customers}</td>
                <td className="px-4 py-3 text-ink-700">{dollars(agg.pending_cents)}</td>
                <td className="px-4 py-3">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    defaultValue={r.commission_pct}
                    onBlur={(e) => {
                      const v = parseInt(e.target.value, 10);
                      if (!Number.isNaN(v) && v !== r.commission_pct) update(r.id, { commission_pct: v });
                    }}
                    className="bg-cream-50 border border-ink-900/10 rounded px-2 py-1 w-16 text-sm"
                  />
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_BADGE[r.status] ?? ''}`}>
                    {r.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                  {r.status !== 'active' && (
                    <button
                      onClick={() => update(r.id, { status: 'active' })}
                      disabled={busyId === r.id}
                      className="text-xs bg-emerald-600 text-white px-2 py-1 rounded disabled:opacity-50"
                    >
                      Approve
                    </button>
                  )}
                  {r.status !== 'disabled' && (
                    <button
                      onClick={() => update(r.id, { status: 'disabled' })}
                      disabled={busyId === r.id}
                      className="text-xs bg-red-600 text-white px-2 py-1 rounded disabled:opacity-50"
                    >
                      Disable
                    </button>
                  )}
                  <Link
                    href={`/admin/payouts?rep=${r.id}`}
                    className="text-xs underline text-ink-700"
                  >
                    Payouts
                  </Link>
                </td>
              </tr>
            );
          })}
          {reps.length === 0 && (
            <tr><td colSpan={8} className="px-4 py-12 text-center text-ink-700/60">No reps yet.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
