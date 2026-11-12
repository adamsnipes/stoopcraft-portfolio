import { notFound } from 'next/navigation';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { getPhotoLimit } from '@/lib/photos/limits';
import { RefetchPhotosButton } from './RefetchPhotosButton';
import { PhotoManager } from './PhotoManager';

type Params = Promise<{ id: string }>;

export default async function PhotoManagerPage({ params }: { params: Params }) {
  const { id } = await params;
  const supabase = createServiceRoleClient();

  const { data: client } = await supabase
    .from('clients')
    .select('id, business_name, google_place_id, business_vertical')
    .eq('id', id)
    .single();
  if (!client) notFound();

  const galleryLimit = getPhotoLimit('gallery', client.business_vertical);

  // Gallery manager only shows gallery photos. Menu-item photos are managed
  // inline on the menu editor (per-item upload), not here.
  const { data: photos } = await supabase
    .from('photos')
    .select('id, r2_key, alt_text, source, position, bytes')
    .eq('client_id', id)
    .eq('purpose', 'gallery')
    .order('position', { ascending: true });

  const r2PublicUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? '';

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-medium">Gallery photos</h2>
          <p className="mt-1 text-sm text-ink-700/70">
            Drag to reorder. The first {galleryLimit} appear in the gallery, in order.
          </p>
        </div>
        {client.google_place_id && <RefetchPhotosButton clientId={id} />}
      </div>

      <PhotoManager
        clientId={id}
        initialPhotos={photos ?? []}
        r2PublicUrl={r2PublicUrl}
        maxPhotos={galleryLimit}
      />
    </div>
  );
}
