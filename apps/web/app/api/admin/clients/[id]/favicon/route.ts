import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server';
import { uploadFavicon, deleteFavicon } from '@/lib/r2/favicon';
import { revalidateClientSite } from '@/lib/revalidation';

type RouteContext = { params: Promise<{ id: string }> };

async function assertAdmin(req: NextRequest): Promise<boolean> {
  void req;
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.email === process.env.ADMIN_EMAIL;
}

export async function POST(req: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  if (!(await assertAdmin(req))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const form = await req.formData();
  const file = form.get('favicon');

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'missing_file' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const faviconUrl = await uploadFavicon(id, buffer);

  if (!faviconUrl) {
    return NextResponse.json({ error: 'upload_failed' }, { status: 500 });
  }

  const supabase = createServiceRoleClient();
  const { data: client, error } = await supabase
    .from('clients')
    .update({ favicon_url: faviconUrl })
    .eq('id', id)
    .select('slug, custom_domain')
    .single();

  if (error || !client) {
    return NextResponse.json({ error: 'db_update_failed' }, { status: 500 });
  }

  revalidateClientSite(client.slug, client.custom_domain);

  return NextResponse.json({ favicon_url: faviconUrl });
}

export async function DELETE(req: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  if (!(await assertAdmin(req))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const supabase = createServiceRoleClient();

  const { data: client } = await supabase
    .from('clients')
    .select('slug, custom_domain')
    .eq('id', id)
    .single();

  await deleteFavicon(id);

  await supabase
    .from('clients')
    .update({ favicon_url: null })
    .eq('id', id);

  if (client) revalidateClientSite(client.slug, client.custom_domain);

  return NextResponse.json({ success: true });
}
