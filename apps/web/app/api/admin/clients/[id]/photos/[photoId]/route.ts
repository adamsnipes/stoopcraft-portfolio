import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server';
import { deletePhotoFromR2 } from '@/lib/r2/photos';
import { revalidateClientSite } from '@/lib/revalidation';

type RouteContext = { params: Promise<{ id: string; photoId: string }> };

async function assertAdmin(): Promise<boolean> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.email === process.env.ADMIN_EMAIL;
}

export async function DELETE(_req: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  if (!(await assertAdmin())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const { id, photoId } = await params;
  const supabase = createServiceRoleClient();

  const { data: photo } = await supabase
    .from('photos')
    .select('id, r2_key, client_id')
    .eq('id', photoId)
    .eq('client_id', id)
    .single();
  if (!photo) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const { data: client } = await supabase
    .from('clients')
    .select('slug, custom_domain')
    .eq('id', id)
    .single();

  await supabase.from('photos').delete().eq('id', photoId).eq('client_id', id);
  await deletePhotoFromR2(photo.r2_key);

  if (client) revalidateClientSite(client.slug, client.custom_domain);

  return NextResponse.json({ success: true });
}

// Update editable fields on a single photo (currently only alt_text).
export async function PATCH(req: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  if (!(await assertAdmin())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const { id, photoId } = await params;
  const body = (await req.json().catch(() => null)) as { alt_text?: unknown } | null;
  if (!body) return NextResponse.json({ error: 'invalid_body' }, { status: 400 });

  const update: { alt_text?: string | null } = {};
  if ('alt_text' in body) {
    if (body.alt_text === null || body.alt_text === '') {
      update.alt_text = null;
    } else if (typeof body.alt_text === 'string') {
      update.alt_text = body.alt_text.slice(0, 200);
    } else {
      return NextResponse.json({ error: 'invalid_alt_text' }, { status: 400 });
    }
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'no_fields' }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  const { error } = await supabase
    .from('photos')
    .update(update)
    .eq('id', photoId)
    .eq('client_id', id);
  if (error) return NextResponse.json({ error: 'db_error' }, { status: 500 });

  const { data: client } = await supabase
    .from('clients')
    .select('slug, custom_domain')
    .eq('id', id)
    .single();
  if (client) revalidateClientSite(client.slug, client.custom_domain);

  return NextResponse.json({ success: true });
}
