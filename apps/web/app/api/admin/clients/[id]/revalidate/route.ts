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
    .select('slug, custom_domain')
    .eq('id', id)
    .single();

  if (!client) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  revalidateClientSite(client.slug, client.custom_domain);

  return NextResponse.json({ success: true, revalidated: true });
}
