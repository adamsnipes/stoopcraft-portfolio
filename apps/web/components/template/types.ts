import type { ContentRow, PhotoRow } from '@dfy/db';
import type { PublicClient } from '@/lib/tenant';

export type SectionProps = {
  // Legacy field, still required so older content rows render.
  variant: string;
  // New: bespoke composition name. Optional — when missing, sections fall
  // back to dispatching on `variant`.
  composition?: string;
  content: ContentRow;
  client: PublicClient;
  photos: PhotoRow[];
  // Menu-item photos (purpose='menu_item'), kept separate so Hero/About/Gallery
  // don't accidentally pull them when reading photos[0]. Empty for non-restaurant
  // clients.
  menuPhotos: PhotoRow[];
};
