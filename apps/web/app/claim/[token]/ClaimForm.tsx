'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type Props = {
  token: string;
  clientId: string;
  businessName: string;
};

export function ClaimForm({ token, businessName }: Props) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const supabase = createClient();
    // /auth/callback handles PKCE today; /auth/confirm reads ?claim_token=
    // out of this URL once the email template is flipped to token-hash.
    const redirectTo = `${window.location.origin}/auth/callback?claim_token=${encodeURIComponent(token)}`;

    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });

    setLoading(false);

    if (otpError) {
      setError(otpError.message);
    } else {
      setSent(true);
    }
  }

  if (sent) {
    return (
      <div className="text-center py-4">
        <p className="text-lg font-medium mb-2">Check your email!</p>
        <p className="text-gray-600">
          We sent a magic link to <strong>{email}</strong>.
          Click it to claim {businessName} and set up your subscription.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1" htmlFor="claim-email">
          Your email address
        </label>
        <input
          id="claim-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          placeholder="you@yourbusiness.com"
          className="w-full border rounded px-3 py-2"
        />
      </div>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-gray-900 text-white py-3 rounded font-semibold disabled:opacity-60"
      >
        {loading ? 'Sending…' : 'Send My Magic Link'}
      </button>
      <p className="text-xs text-gray-500 text-center">
        No password required. We&apos;ll email you a secure link.
      </p>
    </form>
  );
}
