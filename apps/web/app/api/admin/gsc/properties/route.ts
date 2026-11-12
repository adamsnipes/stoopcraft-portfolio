import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { assertAdmin } from '@/lib/gsc/admin-auth';
import { GscNotConfiguredError, serviceAccountEmail } from '@/lib/gsc/auth';
import { GscApiError, listProperties } from '@/lib/gsc/client';

// Every Search Console property the service account can read, cross-referenced
// against the clients table. Doubles as the connection audit: `unmatched`
// properties have no client, and the admin SEO page flags clients with no
// property — usually one nobody remembered to add to the agency account.

export const dynamic = 'force-dynamic';

/** Reduces both a property ID and a domain to a bare comparable host. */
function normaliseHost(value: string): string {
  return value
    .replace(/^sc-domain:/, '')
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/$/, '')
    .toLowerCase();
}

export async function GET(): Promise<NextResponse> {
  if (!(await assertAdmin())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let properties;
  try {
    properties = await listProperties();
  } catch (err) {
    if (err instanceof GscNotConfiguredError) {
      return NextResponse.json({ error: 'not_configured', detail: err.message }, { status: 503 });
    }
    if (err instanceof GscApiError) {
      return NextResponse.json({ error: 'gsc_error', detail: err.hint }, { status: 502 });
    }
    throw err;
  }

  const admin = createServiceRoleClient();
  const { data: clients } = await admin
    .from('clients')
    .select('id, slug, business_name, custom_domain, gsc_property, status')
    .eq('status', 'claimed');

  const byHost = new Map((clients ?? []).map((c) => [normaliseHost(c.custom_domain ?? c.slug), c]));

  const matched = properties.map((p) => {
    const client = byHost.get(normaliseHost(p.siteUrl));
    return {
      siteUrl: p.siteUrl,
      permissionLevel: p.permissionLevel,
      // Restricted users can read Search Analytics but not the URL Inspection
      // API — surfaced so the operator can upgrade the grant if they want it.
      readOnly: p.permissionLevel === 'siteRestrictedUser',
      clientId: client?.id ?? null,
      clientName: client?.business_name ?? null,
      /** True when the client already has this exact string persisted. */
      linked: client?.gsc_property === p.siteUrl,
    };
  });

  const linkedProperties = new Set((clients ?? []).map((c) => c.gsc_property).filter(Boolean));

  return NextResponse.json({
    serviceAccount: serviceAccountEmail(),
    properties: matched,
    /** Claimed clients with nothing linked — the "add these to GSC" worklist. */
    unlinkedClients: (clients ?? [])
      .filter((c) => !c.gsc_property)
      .map((c) => ({ id: c.id, name: c.business_name, domain: c.custom_domain ?? c.slug })),
    /** Persisted property IDs the service account can no longer see — usually
     *  access was revoked, or the property was deleted and recreated. */
    stale: [...linkedProperties].filter(
      (p) => !properties.some((prop) => prop.siteUrl === p),
    ),
  });
}
