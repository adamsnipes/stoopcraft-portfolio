import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server';

const inputSchema = z.object({
  email: z.string().email(),
  token: z.string().min(10).max(100),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const parsed = inputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'validation_failed' }, { status: 400 });
  }

  const { email, token } = parsed.data;

  // Verify the token exists and is unclaimed (defense in depth — page already checked)
  const admin = createServiceRoleClient();
  const { data: client } = await admin
    .from('clients')
    .select('id')
    .eq('claim_token', token)
    .is('owner_user_id', null)
    .single();

  if (!client) {
    return NextResponse.json({ error: 'invalid_token' }, { status: 400 });
  }

  // Derive base URL from the incoming request so this works in local dev and prod.
  const origin = req.headers.get('origin') ?? `https://${process.env.PLATFORM_DOMAIN}`;
  // /auth/callback handles PKCE today; /auth/confirm reads ?claim_token=
  // out of this URL once the email template is flipped to token-hash.
  const redirectTo = `${origin}/auth/callback?claim_token=${encodeURIComponent(token)}`;

  // Use the SSR client so PKCE code verifier is stored in cookies —
  // the plain createClient defaults to implicit flow which breaks the callback.
  const supabase = await createServerClient();

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirectTo },
  });

  if (error) {
    console.error('signInWithOtp failed', { error: error.message });
    return NextResponse.json({ error: 'magic_link_failed' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
