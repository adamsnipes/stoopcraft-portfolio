import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server';
import { uploadStaticBundle } from '@/lib/r2/static-site';
import { CHEAP_BRAND, type ClientBrand } from '@/lib/marketing-brand';

// Create a static-site client: a normal `clients` row with render_mode='static',
// plus the uploaded HTML/zip bundle in R2. Reuses the full client lifecycle
// (domain, claim, billing, contact) — only rendering differs.

async function assertAdmin(): Promise<boolean> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.email === process.env.ADMIN_EMAIL;
}

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const BRANDS: readonly ClientBrand[] = ['stoopcraft', CHEAP_BRAND.id];

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!(await assertAdmin())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const form = await req.formData();
  const businessName = String(form.get('business_name') ?? '').trim();
  const slug = String(form.get('slug') ?? '').trim().toLowerCase();
  const file = form.get('file');
  // Sales brand, chosen at creation so the site is on the right domain from
  // the first request. Omitted = StoopCraft (older callers).
  const brand = String(form.get('brand') ?? 'stoopcraft') as ClientBrand;

  if (!businessName) {
    return NextResponse.json({ error: 'missing_business_name' }, { status: 400 });
  }
  if (!SLUG_RE.test(slug)) {
    return NextResponse.json({ error: 'invalid_slug' }, { status: 400 });
  }
  if (!BRANDS.includes(brand)) {
    return NextResponse.json({ error: 'invalid_brand' }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'missing_file' }, { status: 400 });
  }
  if (!/\.(html?|zip)$/i.test(file.name)) {
    return NextResponse.json({ error: 'unsupported_file' }, { status: 400 });
  }

  const admin = createServiceRoleClient();

  // Slug + custom-domain uniqueness is enforced by the DB, but check slug up
  // front for a clean error before we touch R2.
  const { data: existing } = await admin
    .from('clients')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ error: 'slug_taken' }, { status: 409 });
  }

  const claim_token = `tok_${crypto.randomUUID().replace(/-/g, '')}`;

  const { data: client, error: insertError } = await admin
    .from('clients')
    .insert({
      slug,
      status: 'live',
      render_mode: 'static',
      brand,
      business_name: businessName,
      claim_token,
      // No Google-Places data for an uploaded site; columns are NOT NULL.
      niche: '',
      city: '',
      state: '',
    })
    .select('id')
    .single();

  if (insertError || !client) {
    return NextResponse.json({ error: 'db_insert_failed' }, { status: 500 });
  }

  // Upload the bundle. Roll back the row if storage fails so we never leave a
  // client pointing at an empty bundle.
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    await uploadStaticBundle(slug, { buffer, filename: file.name });
  } catch (err) {
    await admin.from('clients').delete().eq('id', client.id);
    const msg = err instanceof Error && err.message === 'NO_HTML_ENTRY'
      ? 'no_html_entry'
      : 'upload_failed';
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  return NextResponse.json({ id: client.id });
}
