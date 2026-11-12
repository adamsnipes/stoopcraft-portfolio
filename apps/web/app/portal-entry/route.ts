import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server';
import { verifyPortalEntry } from '@/lib/auth/portal-entry-token';

// One-click portal sign-in for the welcome email. Validates the signed token,
// then mints a FRESH Supabase OTP and verifies it in this same request so the
// browser leaves authenticated (cookies can only be written from a Route
// Handler). Prefetch-safe: a link scanner that loads this just logs in a
// throwaway session; the human's click mints its own OTP. On any failure we
// fall back to /login (they sign in normally) rather than a dead error page.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { origin } = req.nextUrl;
  // Fall back to /login on failure, with a short reason code so a failed click
  // is diagnosable from the URL (no sensitive data — just which step bailed).
  const bail = (reason: string) => NextResponse.redirect(`${origin}/login?pe=${reason}`);

  const token = req.nextUrl.searchParams.get('t');
  if (!token) return bail('no_token');

  const payload = verifyPortalEntry(token);
  if (!payload) return bail('bad_token');

  const admin = createServiceRoleClient();
  const { data: { user }, error: getErr } = await admin.auth.admin.getUserById(payload.uid);
  if (getErr || !user?.email) {
    console.error('portal-entry getUserById failed', { uid: payload.uid, err: getErr?.message });
    return bail('no_user');
  }
  const email = user.email;

  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  });
  const otp = link?.properties?.email_otp;
  if (linkErr || !otp) {
    console.error('portal-entry generateLink failed', { err: linkErr?.message, hasOtp: !!otp });
    return bail('gen_failed');
  }

  const ssr = await createServerClient();
  const { error: verifyErr } = await ssr.auth.verifyOtp({ email, token: otp, type: 'email' });
  if (verifyErr) {
    console.error('portal-entry verifyOtp failed', { err: verifyErr.message });
    return bail('verify_failed');
  }

  return NextResponse.redirect(`${origin}/portal`);
}
