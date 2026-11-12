import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server';
import { revalidateClientSite } from '@/lib/revalidation';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  void req;
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const admin = createServiceRoleClient();

  const { data: client } = await admin
    .from('clients')
    .select('id, slug, custom_domain, owner_user_id, status')
    .eq('id', id)
    .single();
  if (!client) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const { error } = await admin
    .from('clients')
    .update({
      owner_user_id: null,
      status: 'live',
      plan: null,
      claimed_at: null,
      stripe_customer_id: null,
      stripe_subscription_id: null,
      cancelled_at: null,
      expires_at: null,
      hard_delete_at: null,
    })
    .eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin.from('events').insert({
    client_id: id,
    type: 'admin_unclaim',
    metadata: {
      admin: user.email,
      prior_status: client.status,
      prior_owner_user_id: client.owner_user_id,
    },
  });

  revalidateClientSite(client.slug, client.custom_domain);

  return NextResponse.json({ success: true });
}
