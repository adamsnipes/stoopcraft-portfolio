import Link from 'next/link';

export default function RepsPendingPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-cream-50 px-4">
      <div className="max-w-md text-center space-y-5">
        <h1 className="font-display text-3xl tracking-tight">Awaiting approval</h1>
        <p className="text-ink-700">
          Thanks for signing up. An admin needs to approve your account
          before your dashboard unlocks. You&apos;ll be able to log back
          in once you&apos;ve been notified.
        </p>
        <p className="text-sm text-ink-700/70">
          While you wait, read{' '}
          <Link className="underline" href="/reps/guide">
            how the program works
          </Link>{' '}
          so you can hit the ground running.
        </p>
      </div>
    </div>
  );
}
