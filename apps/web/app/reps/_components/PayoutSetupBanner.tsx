// Shown on /reps overview when the rep hasn't set up their payout method.
// Earlier nudge = less back-and-forth when a payout day actually rolls
// around and admin needs to know where to send the money.

import Link from 'next/link';

export function PayoutSetupBanner() {
  return (
    <div className="bg-amber-accent/10 border border-amber-accent/30 rounded-2xl p-4 flex items-start justify-between gap-4">
      <div>
        <div className="font-display tracking-tight">Set up how you get paid</div>
        <p className="text-sm text-ink-700 mt-1">
          You haven&apos;t told us where to send your payouts yet. Add a
          PayPal email or Venmo handle so we can pay you on the next cycle.
        </p>
      </div>
      <Link
        href="/reps/settings"
        className="shrink-0 bg-ink-900 text-cream-50 px-3 py-2 rounded-lg text-sm font-semibold hover:bg-ink-800 whitespace-nowrap self-start"
      >
        Set up payout →
      </Link>
    </div>
  );
}
