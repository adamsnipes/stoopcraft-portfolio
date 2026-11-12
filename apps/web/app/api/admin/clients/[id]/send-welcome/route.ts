import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server';
import { getEmailProvider } from '@/lib/email';
import { sendCheapBrandClientEmail } from '@/lib/email/cheap-brand';
import { clientSubdomainHost, isCheapBrandClient } from '@/lib/marketing-brand';
import { logFunnel, requestIdFromHeaders } from '@/lib/funnel-log';
import { signPortalEntry } from '@/lib/auth/portal-entry-token';

type RouteContext = { params: Promise<{ id: string }> };

async function assertAdmin(): Promise<string | null> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return null;
  return user.email === process.env.ADMIN_EMAIL ? user.email : null;
}

export async function POST(req: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  if (!(await assertAdmin())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const request_id = requestIdFromHeaders(req.headers);
  const admin = createServiceRoleClient();

  const { data: client } = await admin
    .from('clients')
    .select('id, slug, custom_domain, status, owner_user_id, funnel_session_id, brand')
    .eq('id', id)
    .single();
  if (!client) return NextResponse.json({ error: 'client_not_found' }, { status: 404 });

  const funnel_session_id = client.funnel_session_id ?? null;

  if (client.status !== 'claimed') {
    return NextResponse.json({ error: 'not_claimed' }, { status: 400 });
  }
  if (!client.owner_user_id) {
    return NextResponse.json({ error: 'no_owner' }, { status: 400 });
  }

  // The fallback URL is a stoopcraft.com subdomain, which would expose the
  // connection to a Stupid Cheap Websites customer. Their site goes live on
  // their own domain only.

  const platformDomain = process.env.PLATFORM_DOMAIN ?? 'stoopcraft.com';
  const siteUrl = client.custom_domain
    ? `https://${client.custom_domain}`
    : `https://${clientSubdomainHost(client)}`;

  // One-click portal link. A plain /portal link dumps an unauthenticated
  // customer at /login (re-enter email, wait for a second link). Instead, point
  // "Open your portal" at /portal-entry with a signed token — that route mints a
  // fresh OTP per click and signs them in, so it's safe against email link
  // scanners that prefetch (and burn) one-time magic tokens. Falls back to the
  // plain /portal link if signing fails (then they just sign in normally).
  let portalUrl = `https://${platformDomain}/portal`;
  try {
    const token = signPortalEntry(client.owner_user_id);
    portalUrl = `https://${platformDomain}/portal-entry?t=${encodeURIComponent(token)}`;
  } catch (err) {
    console.error('portal-entry token signing failed; using plain portal link', err);
  }

  try {
    // Stupid Cheap Websites clients get that brand's "site is live" email from
    // its own Resend account — no StoopCraft portal link.
    if (isCheapBrandClient(client.brand)) {
      await sendCheapBrandClientEmail({ clientId: id, template: 'site_live', variables: { site_url: siteUrl } });
    } else {
      await getEmailProvider().send({
        clientId: id,
        template: 'welcome',
        variables: {
          site_url: siteUrl,
          portal_url: portalUrl,
        },
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown';
    logFunnel({
      flow: 'welcome-email',
      event: 'error',
      request_id,
      funnel_session_id,
      client_id: id,
      error: message,
    });
    return NextResponse.json({ error: 'send_failed', detail: message }, { status: 500 });
  }

  await admin.from('events').insert({
    client_id: id,
    type: 'welcome_email_sent',
    metadata: { site_url: siteUrl, manual: true },
  });

  logFunnel({
    flow: 'welcome-email',
    event: 'ok',
    request_id,
    funnel_session_id,
    client_id: id,
    site_url: siteUrl,
  });

  return NextResponse.json({ ok: true, site_url: siteUrl });
}
