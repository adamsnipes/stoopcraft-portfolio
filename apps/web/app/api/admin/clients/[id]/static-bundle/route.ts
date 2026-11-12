import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server';
import { uploadStaticBundle } from '@/lib/r2/static-site';
import { revalidateClientSite } from '@/lib/revalidation';

// Replace the uploaded bundle for an existing static client.

type RouteContext = { params: Promise<{ id: string }> };

async function assertAdmin(): Promise<boolean> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.email === process.env.ADMIN_EMAIL;
}

export async function POST(req: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  if (!(await assertAdmin())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const admin = createServiceRoleClient();
  const { data: client } = await admin
    .from('clients')
    .select('slug, custom_domain, render_mode')
    .eq('id', id)
    .single();

  if (!client || client.render_mode !== 'static') {
    return NextResponse.json({ error: 'not_a_static_site' }, { status: 400 });
  }

  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File) || !/\.(html?|zip)$/i.test(file.name)) {
    return NextResponse.json({ error: 'missing_or_unsupported_file' }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    await uploadStaticBundle(client.slug, { buffer, filename: file.name });
  } catch (err) {
    const msg = err instanceof Error && err.message === 'NO_HTML_ENTRY'
      ? 'no_html_entry'
      : 'upload_failed';
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  revalidateClientSite(client.slug, client.custom_domain);
  return NextResponse.json({ success: true });
}
