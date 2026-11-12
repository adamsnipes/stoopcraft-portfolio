import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server';
import { storePhotoFromBuffer } from '@/lib/r2/photos';
import { revalidateClientSite } from '@/lib/revalidation';
import { getPhotoLimit } from '@/lib/photos/limits';
import type { PhotoPurpose } from '@dfy/db';

type RouteContext = { params: Promise<{ id: string }> };

const MAX_FILE_BYTES = 15 * 1024 * 1024;
const ACCEPTED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);

const VALID_PURPOSES: PhotoPurpose[] = ['gallery', 'menu_item', 'hero', 'logo'];

function purposeFromForm(form: FormData): PhotoPurpose {
  const raw = form.get('purpose');
  if (typeof raw === 'string' && (VALID_PURPOSES as string[]).includes(raw)) {
    return raw as PhotoPurpose;
  }
  return 'gallery';
}

async function assertAdmin(): Promise<boolean> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.email === process.env.ADMIN_EMAIL;
}

// Upload one or more photos. Files arrive under "photos" multipart key. Each
// uploaded photo is appended to the end of the gallery (position = current
// max + 1). Hard cap at MAX_PHOTOS — Gallery only renders the first 12 anyway.
export async function POST(req: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  if (!(await assertAdmin())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const supabase = createServiceRoleClient();

  const { data: client } = await supabase
    .from('clients')
    .select('id, slug, custom_domain, business_vertical')
    .eq('id', id)
    .single();
  if (!client) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const form = await req.formData();
  const purpose = purposeFromForm(form);
  const files = form.getAll('photos').filter((f): f is File => f instanceof File);
  if (files.length === 0) {
    return NextResponse.json({ error: 'missing_files' }, { status: 400 });
  }

  // Position is per-purpose so the gallery's first 12 stay first; menu-item
  // photos have their own ordering (one-per-item, position is irrelevant but
  // we keep the column populated for consistency).
  const { data: existing } = await supabase
    .from('photos')
    .select('id, position')
    .eq('client_id', id)
    .eq('purpose', purpose)
    .order('position', { ascending: false })
    .limit(1);
  const startPosition = (existing?.[0]?.position ?? -1) + 1;

  const limit = getPhotoLimit(purpose, client.business_vertical);
  const { count: existingCount } = await supabase
    .from('photos')
    .select('id', { count: 'exact', head: true })
    .eq('client_id', id)
    .eq('purpose', purpose);
  const remaining = limit - (existingCount ?? 0);
  if (remaining <= 0) {
    return NextResponse.json(
      { error: 'limit_reached', message: `Already at ${limit} ${purpose} photos. Delete one first.` },
      { status: 422 }
    );
  }

  const accepted = files.slice(0, remaining);
  const skipped = files.length - accepted.length;
  const errors: string[] = [];
  let stored = 0;

  for (let i = 0; i < accepted.length; i++) {
    const file = accepted[i]!;
    if (!ACCEPTED_MIME.has(file.type)) {
      errors.push(`${file.name}: unsupported type ${file.type}`);
      continue;
    }
    if (file.size > MAX_FILE_BYTES) {
      errors.push(`${file.name}: too large (${Math.round(file.size / 1024 / 1024)}MB)`);
      continue;
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await storePhotoFromBuffer(id, buffer);
    if (!result) {
      errors.push(`${file.name}: processing failed`);
      continue;
    }
    const { error: insertError } = await supabase.from('photos').insert({
      client_id: id,
      ...result,
      position: startPosition + stored,
      source: 'manual',
      purpose,
    });
    if (insertError) {
      errors.push(`${file.name}: db insert failed`);
      continue;
    }
    stored++;
  }

  if (stored > 0) {
    revalidateClientSite(client.slug, client.custom_domain);
  }

  return NextResponse.json({ stored, skipped, errors });
}

// Reorder. Body: { order: string[] } — array of photo IDs in desired order.
// IDs not in the order array keep their existing position. Two-phase update
// avoids ever colliding on a unique-position constraint if one is added later
// (offset positions by +1000, then write final values).
export async function PATCH(req: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  if (!(await assertAdmin())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = (await req.json().catch(() => null)) as { order?: unknown } | null;
  if (!body || !Array.isArray(body.order) || !body.order.every((x) => typeof x === 'string')) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }
  const order = body.order as string[];

  const supabase = createServiceRoleClient();

  const { data: client } = await supabase
    .from('clients')
    .select('id, slug, custom_domain')
    .eq('id', id)
    .single();
  if (!client) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const { data: ownedPhotos } = await supabase
    .from('photos')
    .select('id')
    .eq('client_id', id);
  const ownedIds = new Set((ownedPhotos ?? []).map((p) => p.id));
  for (const pid of order) {
    if (!ownedIds.has(pid)) {
      return NextResponse.json({ error: 'photo_not_owned', photo_id: pid }, { status: 422 });
    }
  }

  for (let i = 0; i < order.length; i++) {
    const pid = order[i]!;
    await supabase
      .from('photos')
      .update({ position: 1000 + i })
      .eq('id', pid)
      .eq('client_id', id);
  }
  for (let i = 0; i < order.length; i++) {
    const pid = order[i]!;
    await supabase
      .from('photos')
      .update({ position: i })
      .eq('id', pid)
      .eq('client_id', id);
  }

  revalidateClientSite(client.slug, client.custom_domain);

  return NextResponse.json({ success: true });
}
