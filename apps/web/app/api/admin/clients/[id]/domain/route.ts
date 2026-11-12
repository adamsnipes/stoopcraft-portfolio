import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server';
import { addDomainToVercel, removeDomainFromVercel } from '@/lib/vercel/domains';
import { revalidateClientSite } from '@/lib/revalidation';
import { logFunnel, requestIdFromHeaders } from '@/lib/funnel-log';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email || user.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const request_id = requestIdFromHeaders(req.headers);
  const admin = createServiceRoleClient();

  const { data: client } = await admin
    .from('clients')
    .select('id, slug, custom_domain, funnel_session_id')
    .eq('id', id)
    .single();

  const funnel_session_id = client?.funnel_session_id ?? null;

  if (!client?.custom_domain) {
    return NextResponse.json({ error: 'no_custom_domain_set' }, { status: 400 });
  }

  let result: Awaited<ReturnType<typeof addDomainToVercel>>;
  try {
    result = await addDomainToVercel(client.custom_domain);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logFunnel({
      flow: 'dns-provisioning',
      event: 'error',
      request_id,
      funnel_session_id,
      client_id: id,
      domain: client.custom_domain,
      error: message,
    });
    return NextResponse.json(
      { error: 'vercel_api_failed', detail: message },
      { status: 500 }
    );
  }

  await admin.from('events').insert({
    client_id: id,
    type: 'domain_provisioned',
    metadata: {
      domain: client.custom_domain,
      verified: result.verified,
      verification: result.verification ?? null,
      admin: user.email,
    },
  });

  if (result.verified) {
    revalidateClientSite(client.slug, client.custom_domain);
  }

  logFunnel({
    flow: 'dns-provisioning',
    event: 'ok',
    request_id,
    funnel_session_id,
    client_id: id,
    domain: client.custom_domain,
    verified: result.verified,
  });

  return NextResponse.json({ success: true, ...result });
}

export async function DELETE(req: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  void req;
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email || user.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const admin = createServiceRoleClient();

  const { data: client } = await admin
    .from('clients')
    .select('id, slug, custom_domain')
    .eq('id', id)
    .single();

  if (!client) {
    return NextResponse.json({ error: 'client_not_found' }, { status: 404 });
  }

  const previousDomain = client.custom_domain;

  if (previousDomain) {
    try {
      await removeDomainFromVercel(previousDomain);
    } catch (err) {
      // Non-fatal — we still want to clear the DB row so the operator can
      // re-attempt or move on. Log so the failure is visible in events.
      console.error('removeDomainFromVercel failed', err);
    }
  }

  await admin
    .from('clients')
    .update({ custom_domain: null })
    .eq('id', id);

  await admin.from('events').insert({
    client_id: id,
    type: 'domain_removed',
    metadata: { domain: previousDomain, admin: user.email },
  });

  revalidateClientSite(client.slug, previousDomain);

  return NextResponse.json({ success: true });
}
