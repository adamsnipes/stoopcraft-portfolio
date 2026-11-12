import Link from 'next/link';

function dollars(cents: number): string {
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function PayoutsDueBanner({
  totalCents,
  repCount,
}: {
  totalCents: number;
  repCount: number;
}) {
  return (
    <Link
      href="/admin/payouts"
      className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-amber-accent/25 bg-amber-accent/[0.07] px-4 py-3 transition-colors hover:bg-amber-accent/[0.12]"
    >
      <div>
        <div className="text-sm font-medium text-ink-900">
          {dollars(totalCents)} owed to {repCount} {repCount === 1 ? 'rep' : 'reps'}
        </div>
        <div className="mt-0.5 text-xs text-ink-700/65">
          Payout cadence: 1st &amp; 15th of every month.
        </div>
      </div>
      <span className="shrink-0 text-sm font-semibold text-amber-accent">Open payouts →</span>
    </Link>
  );
}
