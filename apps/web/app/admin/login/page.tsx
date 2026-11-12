'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function AdminLoginPage() {
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
        // /auth/callback is the legacy PKCE handler; /auth/confirm reads
        // this URL out of {{ .RedirectTo }} and extracts ?next= / ?claim_token=.
        // Keeping the /auth/callback URL means PKCE keeps working until the
        // Supabase email template is flipped to the token-hash flow.
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/admin`,
      },
    });
    if (err) {
      setError(err.message);
    } else {
      setSent(true);
    }
  }

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-lg">Magic link sent to {email}. Check your inbox.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <form onSubmit={handleSubmit} className="space-y-4 w-full max-w-sm">
        <h1 className="text-2xl font-bold">Admin Login</h1>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          required
          className="w-full border rounded px-3 py-2"
        />
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button
          type="submit"
          className="w-full bg-gray-900 text-white py-2 rounded font-semibold"
        >
          Send Magic Link
        </button>
      </form>
    </div>
  );
}
