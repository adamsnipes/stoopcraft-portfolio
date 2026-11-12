import type { PhotoPurpose } from '@dfy/db';

// ============================================================================
// Per-purpose photo limits.
//
// Gallery: upload constraint — admin/portal photo upload rejects past this.
//   Beauty clients: 12 (current behavior).
//   Restaurants:    48 (food-heavy menus + ambiance shots; doubled from 24
//                       once the Menu section started rendering its own photos
//                       and freed gallery from carrying menu visuals). R2
//                       egress is free, so the marginal cost is storage only
//                       (~negligible at expected fleet size).
// Menu items: per-item, one photo per item. Soft cap on total is just to
//   prevent abuse (a malicious client uploading thousands of photos).
// Hero / logo: 1 each. Future use; v1 doesn't surface them in the UI yet.
// ============================================================================

const RESTAURANT_GALLERY_CAP = 48;
const BEAUTY_GALLERY_CAP = 12;
const MENU_ITEM_TOTAL_CAP = 200;

export function getPhotoLimit(
  purpose: PhotoPurpose,
  vertical: string | null,
): number {
  if (purpose === 'gallery') {
    return vertical === 'restaurant' ? RESTAURANT_GALLERY_CAP : BEAUTY_GALLERY_CAP;
  }
  if (purpose === 'menu_item') return MENU_ITEM_TOTAL_CAP;
  if (purpose === 'hero') return 1;
  if (purpose === 'logo') return 1;
  return 0;
}
