'use client';

import { useState } from 'react';

const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-ink-900/5 text-ink-700 border-ink-900/10',
  live: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  claimed: 'bg-amber-accent/10 text-amber-accent border-amber-accent/30',
  cancelled: 'bg-red-50 text-red-700 border-red-200',
  lost: 'bg-ink-900/5 text-ink-700/60 border-ink-900/10',
};

function dollars(cents: number): string {
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export type CustomerRow = {
  id: string;
  business_name: string;
  status: string;
  plan: string | null;
  cancelled_at: string | null;
  signed_up_at: string;
  site_href: string;
  site_label: string;
  monthly_cents: number;
  my_cut_cents: number;
  cancel_reason: string | null;
  // If non-null, this customer was attributed to the current rep but has
  // since been taken over by another rep. The row stays in the list as a
  // tombstone so the rep isn't confused about disappearing prospects.
  lost_at: string | null;
};

export function CustomersTable({ customers }: { customers: CustomerRow[] }) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [linkById, setLinkById] = useState<Record<string, string>>({});
  const [errorById, setErrorById] = useState<Record<string, string>>({});

  async function getPaymentLink(id: string) {
    setBusyId(id);
    setErrorById((e) => ({ ...e, [id]: '' }));
    try {
      const res = await fetch(`/api/reps/clients/${id}/payment-link`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorById((e) => ({ ...e, [id]: data?.error ?? 'failed' }));
        return;
      }
      setLinkById((m) => ({ ...m, [id]: data.url }));
      try { await navigator.clipboard.writeText(data.url); } catch { /* user can still select-copy */ }
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-ink-900/10 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-cream-100/60 border-b border-ink-900/10">
          <tr>
            {['Business', 'Site', 'Status', 'Plan', 'MRR', 'Your cut', 'Signed up', 'Payment link'].map((h) => (
              <th key={h} className="text-left px-4 py-3 font-semibold text-ink-700 text-xs uppercase tracking-wider">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-900/5">
          {customers.map((c) => {
            const isCancelled = !!c.cancelled_at;
            const isLost = !!c.lost_at;
            const isUnclaimed = c.status === 'live' && !isCancelled && !isLost;
            const link = linkById[c.id];
            const err = errorById[c.id];
            const badgeKey = isLost
              ? 'lost'
              : isCancelled
              ? 'cancelled'
              : c.status;
            return (
              <tr key={c.id} className={`hover:bg-cream-50 align-top ${isLost ? 'opacity-60' : ''}`}>
                <td className="px-4 py-3">
                  <div className="font-medium">{c.business_name}</div>
                  {isLost && (
                    <div className="text-xs text-ink-700/60 mt-0.5">
                      Closed by another rep on{' '}
                      {new Date(c.lost_at!).toLocaleDateString()}
                    </div>
                  )}
                  {c.cancel_reason && !isLost && (
                    <div className="text-xs text-red-700 mt-0.5">Cancel reason: {c.cancel_reason}</div>
                  )}
                </td>
                <td className="px-4 py-3">
                  {isLost ? (
                    <span className="text-xs text-ink-700/40">—</span>
                  ) : (
                    <a
                      href={c.site_href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-mono text-ink-700 hover:text-amber-accent"
                    >
                      {c.site_label}
                    </a>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_BADGE[badgeKey] ?? ''}`}>
                    {badgeKey}
                  </span>
                </td>
                <td className="px-4 py-3 text-ink-700">{c.plan ?? '—'}</td>
                <td className="px-4 py-3 text-ink-700">
                  {c.monthly_cents > 0 && !isCancelled && !isLost ? dollars(c.monthly_cents) : '—'}
                </td>
                <td className="px-4 py-3 text-ink-700">
                  {c.my_cut_cents > 0 && !isCancelled && !isLost ? dollars(c.my_cut_cents) : '—'}
                </td>
                <td className="px-4 py-3 text-ink-700/60 text-xs">
                  {new Date(c.signed_up_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 align-middle">
                  {!isUnclaimed ? (
                    <span className="text-xs text-ink-700/40">—</span>
                  ) : link ? (
                    <button
                      type="button"
                      onClick={() => navigator.clipboard.writeText(link)}
                      title={link}
                      className="text-xs bg-emerald-50 border border-emerald-200 text-emerald-700 px-2 py-1 rounded"
                    >
                      Copy link
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => getPaymentLink(c.id)}
                      disabled={busyId === c.id}
                      className="text-xs bg-ink-900 text-cream-50 px-2 py-1 rounded disabled:opacity-50"
                    >
                      {busyId === c.id ? 'Working…' : 'Get link'}
                    </button>
                  )}
                  {err && <div className="text-xs text-red-700 mt-1">{err}</div>}
                </td>
              </tr>
            );
          })}
          {customers.length === 0 && (
            <tr>
              <td colSpan={8} className="px-4 py-12 text-center text-ink-700/60">
                No customers yet. Generate a site from the Generate tab or
                share your referral link.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
