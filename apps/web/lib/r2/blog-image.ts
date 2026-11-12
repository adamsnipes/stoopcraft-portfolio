import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

// Blog images (covers + in-content). Cap to a sensible content width and
// convert to webp to keep payloads small. Filenames are unique (uuid) so
// they're immutable and cache forever. SVGs pass through unchanged.
const MAX_WIDTH = 1600;

export async function uploadBlogImage(
  clientId: string,
  buffer: Buffer,
  contentType: string,
): Promise<string | null> {
  let data: Buffer;
  let ext: string;
  let outType: string;

  if (contentType === 'image/svg+xml') {
    data = buffer;
    ext = 'svg';
    outType = 'image/svg+xml';
  } else {
    try {
      data = await sharp(buffer)
        .rotate() // honor EXIF orientation
        .resize({ width: MAX_WIDTH, withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer();
      ext = 'webp';
      outType = 'image/webp';
    } catch {
      return null;
    }
  }

  const key = `clients/${clientId}/blog/${crypto.randomUUID()}.${ext}`;
  try {
    await r2.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME!,
        Key: key,
        Body: data,
        ContentType: outType,
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );
  } catch {
    return null;
  }

  return `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/${key}`;
}
