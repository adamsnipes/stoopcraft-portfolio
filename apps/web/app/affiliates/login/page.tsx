'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function AffiliateLoginPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const supabase = createClient();
    const { error: err } = await supabase.auth.signInWithOtp({
      email,
      options: {
        // emailRedirectTo's pathname tells the post-auth router which flow
        // to create. /affiliates → kind='affiliate', auto-active, 20%.
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/affiliates`,
      },
    });
    if (err) setError(err.message);
    else setSent(true);
  }

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream-50">
        <p className="text-lg">Magic link sent to {email}. Check your inbox.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-cream-50 px-4">
      <form
        onSubmit={handleSubmit}
        className="space-y-4 w-full max-w-sm p-6 bg-white border border-ink-900/10 rounded-2xl"
      >
        <div>
          <h1 className="font-display text-2xl tracking-tight">Affiliate sign in</h1>
          <p className="text-sm text-ink-700/70 mt-1">
            New affiliate? Your dashboard activates the moment you click the magic link — no
            waiting on approval.
          </p>
        </div>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
          className="w-full border border-ink-900/10 rounded-lg px-3 py-2 bg-cream-50 focus:outline-none focus:border-amber-accent"
        />
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button
          type="submit"
          className="w-full bg-ink-900 text-cream-50 py-2 rounded-lg font-semibold hover:bg-ink-800"
        >
          Send magic link
        </button>
      </form>
    </div>
  );
}
