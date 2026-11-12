// Magic-link confirmation endpoint — uses the token-hash + verifyOtp flow
// instead of /auth/callback's PKCE code exchange. This is prefetch-resistant:
// email security scanners (Gmail Safe Links, Outlook ATP, antivirus) that
// follow the link to "scan" it can't burn a session because verifyOtp runs
// against the cookie store on the user's real browser, not the scanner's.
// The scanner getting a 403 is fine — the user's actual click still works.
//
// MANUAL STEP: in the Supabase Dashboard → Auth → Email Templates → Magic
// Link (and Confirm signup if used), change the link to:
//   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next={{ .RedirectTo }}
// Until that template change ships, links still hit /auth/callback (the
// legacy PKCE path, which is what shows the "send twice" bug).

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { parseNextUrl, routeAuthenticatedUser } from '@/lib/auth/route-after';

const VALID_TYPES = new Set([
  'email',
  'magiclink',
  'signup',
  'recovery',
  'invite',
  'email_change',
]);

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams, origin } = req.nextUrl;
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') ?? 'email';
  const next = searchParams.get('next');

  if (!tokenHash) {
    return NextResponse.redirect(`${origin}/auth/error?reason=missing_token`);
  }
  if (!VALID_TYPES.has(type)) {
    return NextResponse.redirect(`${origin}/auth/error?reason=invalid_type`);
  }

  const supabase = await createServerClient();

  // 'magiclink' is deprecated upstream — collapse it to 'email' which is
  // the canonical type for both magic-link and OTP token verification.
  const verifyType = (type === 'magiclink' ? 'email' : type) as
    | 'email'
    | 'signup'
    | 'recovery'
    | 'invite'
    | 'email_change';

  const { data, error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: verifyType,
  });

  if (error || !data.user) {
    console.error('verifyOtp failed', error?.message);
    return NextResponse.redirect(`${origin}/auth/error?reason=verify_failed`);
  }

  const { nextPath, claimToken } = parseNextUrl(next, origin);
  return routeAuthenticatedUser({
    origin,
    user: data.user,
    nextPath,
    claimToken,
  });
}
