import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import { createServiceRoleClient } from '@/lib/supabase/server';

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

type StoredPhoto = {
  r2_key: string;
  width: number;
  height: number;
  bytes: number;
};

/**
 * Process a raw image buffer (resize, EXIF strip, jpeg encode) and upload to R2
 * under clients/{clientId}/. The buffer is expected to come from a single
 * Place Details Photos fetch — we do not call Google here.
 * Returns null if processing or upload fails.
 */
export async function storePhotoFromBuffer(
  clientId: string,
  rawBuffer: Buffer
): Promise<StoredPhoto | null> {
  let processed: sharp.OutputInfo;
  let data: Buffer;

  try {
    const result = await sharp(rawBuffer)
      .rotate()                                               // honor EXIF orientation
      .resize(1600, 1200, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85, progressive: true })
      .withMetadata({ exif: {} })                            // strip EXIF (empty override)
      .toBuffer({ resolveWithObject: true });
    processed = result.info;
    data = result.data;
  } catch (err) {
    console.error('[photo] sharp threw', { clientId, err: err instanceof Error ? err.message : String(err) });
    return null;
  }

  const photoId = crypto.randomUUID();
  const r2_key = `clients/${clientId}/${photoId}.jpg`;

  try {
    await r2.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME!,
        Key: r2_key,
        Body: data,
        ContentType: 'image/jpeg',
        CacheControl: 'public, max-age=31536000, immutable',
      })
    );
  } catch (err) {
    console.error('[photo] r2 put threw', {
      clientId,
      bucket: process.env.R2_BUCKET_NAME,
      hasAccountId: !!process.env.R2_ACCOUNT_ID,
      hasAccessKey: !!process.env.R2_ACCESS_KEY_ID,
      hasSecret: !!process.env.R2_SECRET_ACCESS_KEY,
      err: err instanceof Error ? err.message : String(err),
    });
    return null;
  }

  return {
    r2_key,
    width: processed.width,
    height: processed.height,
    bytes: processed.size,
  };
}

/**
 * Delete a photo object from R2. Best-effort — swallows errors so a missing
 * R2 object never blocks deleting the DB row. Skips fallback keys (shared
 * across clients — deleting them would break other sites).
 */
export async function deletePhotoFromR2(r2Key: string): Promise<void> {
  if (r2Key.startsWith('_fallback/')) return;
  await r2
    .send(
      new DeleteObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME!,
        Key: r2Key,
      })
    )
    .catch(() => {});
}

// Niches with fallback photos actually uploaded to R2 at _fallback/{niche}/.
// Adding a niche to NICHE_PROFILES is decoupled from uploading photos — until
// a niche appears here, attachFallbackPhotos no-ops for it (no broken keys).
const NICHES_WITH_FALLBACK_PHOTOS = new Set([
  'barber',
  'nail_salon',
  'detailer',
  'mobile_detailer',
  'lawn_care',
  'cleaner',
  'trainer',
  'dog_groomer',
  'power_washing',
  'junk_removal',
  'lash_brow',
]);

/**
 * Insert references to niche fallback photos already stored at _fallback/{niche}/.
 * Used when a business has no Google Places photos. Silently skips niches
 * without uploaded R2 fallbacks — better no photo than a broken key.
 */
export async function attachFallbackPhotos(
  clientId: string,
  niche: string
): Promise<void> {
  if (!NICHES_WITH_FALLBACK_PHOTOS.has(niche)) return;

  const supabase = createServiceRoleClient();

  const fallbackKeys = ['1', '2', '3', '4', '5', '6'].map(
    (n) => `_fallback/${niche}/${n}.jpg`
  );

  for (let i = 0; i < fallbackKeys.length; i++) {
    await supabase.from('photos').insert({
      client_id: clientId,
      r2_key: fallbackKeys[i]!,
      source: 'fallback',
      position: i,
      alt_text: null,
    });
  }
}
