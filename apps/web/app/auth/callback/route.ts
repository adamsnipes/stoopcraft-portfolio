// Legacy PKCE code-exchange callback. Sign-in code points emailRedirectTo
// here so PKCE keeps working today. Once the Supabase Dashboard email
// template is flipped to the token-hash flow, links land on /auth/confirm
// instead and this handler stops being called for magic links — but it
// stays around as a fallback for any OAuth flow we might add later.

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { routeAuthenticatedUser } from '@/lib/auth/route-after';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams, origin } = req.nextUrl;
  const code = searchParams.get('code');
  const claimToken = searchParams.get('claim_token');
  const next = searchParams.get('next');

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/error?reason=missing_code`);
  }

  const supabase = await createServerClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) {
    console.error('exchangeCodeForSession failed', exchangeError.message);
    return NextResponse.redirect(`${origin}/auth/error?reason=exchange_failed`);
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(`${origin}/auth/error?reason=no_user`);
  }

  return routeAuthenticatedUser({
    origin,
    user,
    nextPath: next,
    claimToken,
  });
}
