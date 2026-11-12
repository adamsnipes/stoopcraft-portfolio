import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server';
import { storePhotoFromBuffer } from '@/lib/r2/photos';
import { fetchPlaceData, fetchAndRankPhotos } from '@/lib/places';

type RouteContext = { params: Promise<{ id: string }> };

async function assertAdmin(req: NextRequest): Promise<boolean> {
  void req;
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.email === process.env.ADMIN_EMAIL;
}

export async function POST(req: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  if (!(await assertAdmin(req))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const supabase = createServiceRoleClient();

  const { data: client } = await supabase
    .from('clients')
    .select('id, niche, google_place_id')
    .eq('id', id)
    .single();

  if (!client) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  if (!client.google_place_id) {
    return NextResponse.json({ error: 'no_place_id' }, { status: 422 });
  }

  const place = await fetchPlaceData(client.google_place_id);
  const rawRefs = place?.photo_references ?? [];
  const photos = rawRefs.length > 0 ? await fetchAndRankPhotos(rawRefs, client.niche) : [];

  if (photos.length === 0) {
    return NextResponse.json(
      { error: 'no_photo_refs', message: 'No photo references found for this place.' },
      { status: 422 }
    );
  }

  // Refetch only replaces gallery photos. Menu-item / hero / logo photos
  // belong to the customer post-claim and must not be wiped by an admin
  // re-pulling from Google Places.
  await supabase.from('photos').delete().eq('client_id', id).eq('purpose', 'gallery');

  let stored = 0;
  for (let i = 0; i < photos.length; i++) {
    const result = await storePhotoFromBuffer(id, photos[i]!.buffer);
    if (result) {
      await supabase.from('photos').insert({
        client_id: id,
        ...result,
        position: i,
        source: 'google',
        purpose: 'gallery',
      });
      stored++;
    }
  }

  await supabase.from('events').insert({
    client_id: id,
    type: 'photos_refetched',
    metadata: { refs_found: photos.length, stored },
  });

  return NextResponse.json({ success: true, refs_found: photos.length, stored });
}
