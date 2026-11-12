import { NextRequest, NextResponse } from 'next/server';
import { Resolver } from 'node:dns/promises';
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server';

type RouteContext = { params: Promise<{ id: string }> };

type RecordStatus = 'match' | 'wrong' | 'missing';

type RecordCheck = {
  status: RecordStatus;
  resolved: string[];
  expected: string;
};

// Use a public resolver to bypass any stale local cache. DNS propagation
// changes need to be visible immediately when the operator clicks Check.
function makeResolver(): Resolver {
  const resolver = new Resolver({ timeout: 3000, tries: 1 });
  resolver.setServers(['1.1.1.1', '8.8.8.8']);
  return resolver;
}

function normalize(host: string): string {
  return host.toLowerCase().replace(/\.$/, '');
}

async function checkApex(
  resolver: Resolver,
  domain: string,
  expectedA: string,
): Promise<RecordCheck> {
  try {
    const a = await resolver.resolve4(domain);
    return {
      status: a.includes(expectedA) ? 'match' : 'wrong',
      resolved: a,
      expected: expectedA,
    };
  } catch {
    return { status: 'missing', resolved: [], expected: expectedA };
  }
}

async function checkWww(
  resolver: Resolver,
  wwwHost: string,
  expectedCname: string,
): Promise<RecordCheck> {
  const target = normalize(expectedCname);
  try {
    const cnames = await resolver.resolveCname(wwwHost);
    const matches = cnames.some((c) => normalize(c) === target);
    return {
      status: matches ? 'match' : 'wrong',
      resolved: cnames,
      expected: expectedCname,
    };
  } catch {
    return { status: 'missing', resolved: [], expected: expectedCname };
  }
}

export async function GET(req: NextRequest, { params }: RouteContext): Promise<NextResponse> {
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
    .select('custom_domain')
    .eq('id', id)
    .single();

  if (!client?.custom_domain) {
    return NextResponse.json({ error: 'no_custom_domain_set' }, { status: 400 });
  }

  const expectedA = process.env.VERCEL_PROJECT_A_RECORD;
  const expectedCname = process.env.VERCEL_PROJECT_CNAME;
  if (!expectedA || !expectedCname) {
    return NextResponse.json(
      { error: 'env_not_configured', detail: 'VERCEL_PROJECT_A_RECORD or VERCEL_PROJECT_CNAME missing' },
      { status: 500 },
    );
  }

  const resolver = makeResolver();
  const [apex, www] = await Promise.all([
    checkApex(resolver, client.custom_domain, expectedA),
    checkWww(resolver, `www.${client.custom_domain}`, expectedCname),
  ]);

  return NextResponse.json({ apex, www });
}
