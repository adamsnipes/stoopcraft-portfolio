import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server';

// Post-checkout landing — runs as a Route Handler (not a Server Component)
// because verifyOtp must SET the auth cookie on the response, and cookies
// can only be written from Route Handlers, Server Actions, or middleware.
export async function GET(req: NextRequest): Promise<NextResponse> {
  const { origin } = req.nextUrl;
  const sessionId = req.nextUrl.searchParams.get('session_id');

  if (!sessionId) return NextResponse.redirect(`${origin}/welcome/error?reason=missing_session`);

  let session: import('stripe').default.Checkout.Session;
  try {
    session = await getStripe().checkout.sessions.retrieve(sessionId);
  } catch {
    return NextResponse.redirect(`${origin}/welcome/error?reason=invalid_session`);
  }

  if (session.payment_status !== 'paid' && session.payment_status !== 'no_payment_required') {
    return NextResponse.redirect(`${origin}/welcome/error?reason=not_paid`);
  }

  const email = session.customer_details?.email ?? session.customer_email;
  if (!email) return NextResponse.redirect(`${origin}/welcome/error?reason=no_email`);

  const admin = createServiceRoleClient();

  // Generate the OTP — generateLink is create-or-find by email and returns
  // both the user record and a 6-digit email_otp we'll consume server-side.
  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  });

  if (linkErr || !link?.properties?.email_otp) {
    console.error('generateLink failed', linkErr?.message);
    return NextResponse.redirect(`${origin}/welcome/error?reason=signin_failed`);
  }

  const userId = link.user?.id ?? null;
  if (!userId) {
    return NextResponse.redirect(`${origin}/welcome/error?reason=user_create_failed`);
  }

  // Best-effort: link the client to this user before sign-in so /portal
  // works on first hit even if the webhook is still in flight.
  const clientId = session.metadata?.['client_id'];
  if (clientId) {
    await admin
      .from('clients')
      .update({ owner_user_id: userId })
      .eq('id', clientId)
      .is('owner_user_id', null);
  }

  // Verify the OTP through the SSR client. From a Route Handler the cookie
  // setter actually writes to the response, so the browser leaves with an
  // authenticated session. /portal then loads as a signed-in user.
  const ssr = await createServerClient();
  const { error: verifyErr } = await ssr.auth.verifyOtp({
    email,
    token: link.properties.email_otp,
    type: 'email',
  });

  if (verifyErr) {
    console.error('verifyOtp failed', verifyErr.message);
    return NextResponse.redirect(`${origin}/welcome/error?reason=signin_failed`);
  }

  return NextResponse.redirect(`${origin}/portal`);
}
