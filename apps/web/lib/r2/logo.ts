import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

// Logos render at max 40px tall in the nav. Resize to 2x that (80px) and
// preserve aspect ratio so wide and square logos both look right. Format
// stays whatever was uploaded — PNG/SVG transparency is preserved by sharp's
// default behavior, and we don't force a single format because some logos
// (text-only wordmarks) read better as SVG passthrough. Cap height, not
// width, since horizontal nav bars accommodate width naturally.
const MAX_LOGO_HEIGHT = 80;

export async function uploadLogo(
  clientId: string,
  buffer: Buffer,
  contentType: string,
): Promise<string | null> {
  // SVGs go through unchanged — sharp's SVG handling rasterizes, which would
  // defeat the purpose of an SVG upload. The original bytes ride to R2 as-is.
  let data: Buffer;
  let outputContentType: string;
  let extension: string;

  if (contentType === 'image/svg+xml') {
    data = buffer;
    outputContentType = 'image/svg+xml';
    extension = 'svg';
  } else {
    try {
      const result = await sharp(buffer)
        .resize({ height: MAX_LOGO_HEIGHT, withoutEnlargement: true })
        .png()
        .toBuffer();
      data = result;
      outputContentType = 'image/png';
      extension = 'png';
    } catch {
      return null;
    }
  }

  const r2Key = `clients/${clientId}/logo.${extension}`;

  try {
    await r2.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME!,
        Key: r2Key,
        Body: data,
        ContentType: outputContentType,
        CacheControl: 'public, max-age=86400',
      }),
    );
  } catch {
    return null;
  }

  return `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/${r2Key}`;
}

export async function deleteLogo(clientId: string): Promise<void> {
  // Both extensions get a delete attempt — we don't track which format was
  // last uploaded, and the alternative (querying the row, then deleting the
  // matching extension) adds a roundtrip without buying anything.
  await Promise.all(
    ['png', 'svg'].map((ext) =>
      r2
        .send(
          new DeleteObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME!,
            Key: `clients/${clientId}/logo.${ext}`,
          }),
        )
        .catch(() => {}),
    ),
  );
}
