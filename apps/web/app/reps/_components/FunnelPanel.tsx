// Server component — pure presentation of FunnelStats.

import type { ChannelStat } from '@/lib/sales-rep/clicks';

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

export function FunnelStat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="bg-white border border-ink-900/10 rounded-2xl p-4">
      <div className="text-xs uppercase tracking-wider text-ink-700/60 font-semibold">
        {label}
      </div>
      <div className="text-2xl font-display tracking-tight mt-1">{value}</div>
      {hint && <div className="text-xs text-ink-700/60 mt-1">{hint}</div>}
    </div>
  );
}

export function Sparkline({ series }: { series: { day: string; count: number }[] }) {
  const max = Math.max(1, ...series.map((s) => s.count));
  return (
    <div className="bg-white border border-ink-900/10 rounded-2xl p-4">
      <div className="text-xs uppercase tracking-wider text-ink-700/60 font-semibold mb-3">
        Clicks · last 30 days
      </div>
      <div className="flex items-end gap-[2px] h-16">
        {series.map((s) => {
          const h = (s.count / max) * 100;
          return (
            <div
              key={s.day}
              title={`${s.day}: ${s.count}`}
              className="flex-1 bg-amber-accent/30 hover:bg-amber-accent/60 rounded-sm"
              style={{ height: `${Math.max(4, h)}%` }}
            />
          );
        })}
      </div>
      <div className="flex justify-between text-[10px] text-ink-700/50 mt-1">
        <span>{series[0]?.day.slice(5)}</span>
        <span>{series[series.length - 1]?.day.slice(5)}</span>
      </div>
    </div>
  );
}

export function ChannelTable({ channels }: { channels: ChannelStat[] }) {
  if (channels.length === 0) return null;
  return (
    <div className="bg-white border border-ink-900/10 rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-ink-900/5">
        <div className="text-xs uppercase tracking-wider text-ink-700/60 font-semibold">
          Per-channel performance
        </div>
        <p className="text-xs text-ink-700/60 mt-1">
          Channels are picked up from the <code>?utm_source=</code> tag on your link.
          &ldquo;(direct)&rdquo; is everyone who clicked your bare link without a tag.
        </p>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-cream-100/40 border-b border-ink-900/5">
          <tr>
            {['Source', 'Clicks', 'Conversions', 'Paying now', 'Conv. rate'].map((h) => (
              <th
                key={h}
                className="text-left px-4 py-2.5 font-semibold text-ink-700 text-xs uppercase tracking-wider"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-900/5">
          {channels.map((c) => {
            const cr = c.clicks > 0 ? c.conversions / c.clicks : 0;
            return (
              <tr key={c.source}>
                <td className="px-4 py-2.5 font-mono text-xs">{c.source}</td>
                <td className="px-4 py-2.5 text-ink-700">{c.clicks}</td>
                <td className="px-4 py-2.5 text-ink-700">{c.conversions}</td>
                <td className="px-4 py-2.5 text-ink-700">{c.paying}</td>
                <td className="px-4 py-2.5 text-ink-700">{c.clicks > 0 ? pct(cr) : '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
