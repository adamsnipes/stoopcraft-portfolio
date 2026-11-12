'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';


// NOTE: `metadata` (title + noindex) lives in login/layout.tsx, not here.
// This page is a Client Component, and Next disallows exporting `metadata`
// from a "use client" module — doing so breaks the build.
export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // Why they landed here, surfaced from the redirect that sent them:
  //   ?nosite=<email> — signed in fine, but that email owns no site (unclaimed,
  //                      or they used a different address than they purchased
  //                      under). Without this they'd loop forever, re-requesting
  //                      links that all bounce off the portal guard.
  //   ?pe=<reason>    — the welcome email's one-click link expired/failed.
  const [notice, setNotice] = useState<{ kind: 'nosite'; email: string } | { kind: 'expired' } | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const nosite = params.get('nosite');
    if (nosite) setNotice({ kind: 'nosite', email: nosite });
    else if (params.get('pe')) setNotice({ kind: 'expired' });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const supabase = createClient();
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/portal` },
    });

    setLoading(false);

    if (otpError) {
      setError(otpError.message);
    } else {
      setSent(true);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 w-full max-w-sm">
        <div className="mb-7">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1">StoopCraft</p>
          <h1 className="text-2xl font-bold text-gray-900">Customer portal</h1>
          <p className="text-sm text-gray-400 mt-1">Enter your email to get a sign-in link</p>
        </div>

        {notice?.kind === 'nosite' && !sent && (
          <div className="mb-5 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
            <p className="font-semibold">No site linked to {notice.email}</p>
            <p className="mt-1 text-amber-700">
              You&apos;re signed in, but this email isn&apos;t connected to a website. If you used a
              different email when you signed up or paid, enter it below. Otherwise reply to your
              welcome email and we&apos;ll sort it out.
            </p>
          </div>
        )}
        {notice?.kind === 'expired' && !sent && (
          <div className="mb-5 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
            <p className="font-semibold">Your one-click link expired</p>
            <p className="mt-1 text-amber-700">Enter your email below for a fresh sign-in link.</p>
          </div>
        )}

        {sent ? (
          <div className="text-center py-4 space-y-2">
            <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-emerald-500" viewBox="0 0 20 20" fill="none">
                <path d="M2 6l8 5 8-5M2 6v10a1 1 0 001 1h14a1 1 0 001-1V6M2 6a1 1 0 011-1h14a1 1 0 011 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <p className="font-semibold text-gray-900">Check your inbox</p>
            <p className="text-sm text-gray-500">
              We sent a sign-in link to <strong>{email}</strong>. Click it to access your portal.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@yourbusiness.com"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900 transition"
            />
            {error && (
              <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gray-900 hover:bg-gray-800 text-white py-3 rounded-xl font-semibold text-sm transition-colors disabled:opacity-40"
            >
              {loading ? 'Sending…' : 'Send sign-in link'}
            </button>
            <p className="text-xs text-gray-400 text-center">No password needed — we email you a secure link.</p>
          </form>
        )}
      </div>
    </div>
  );
}
