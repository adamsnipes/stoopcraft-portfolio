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

export async function uploadFavicon(clientId: string, buffer: Buffer): Promise<string | null> {
  let data: Buffer;
  try {
    const result = await sharp(buffer)
      .resize(64, 64, { fit: 'cover' })
      .png()
      .toBuffer();
    data = result;
  } catch {
    return null;
  }

  const r2Key = `clients/${clientId}/favicon.png`;

  try {
    await r2.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME!,
        Key: r2Key,
        Body: data,
        ContentType: 'image/png',
        CacheControl: 'public, max-age=86400',
      })
    );
  } catch {
    return null;
  }

  return `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/${r2Key}`;
}

export async function deleteFavicon(clientId: string): Promise<void> {
  await r2.send(
    new DeleteObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: `clients/${clientId}/favicon.png`,
    })
  ).catch(() => {});
}
