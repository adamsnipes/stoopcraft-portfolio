import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server';
import { S3Client, DeleteObjectsCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { deleteStaticBundle } from '@/lib/r2/static-site';

type RouteContext = { params: Promise<{ id: string }> };

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

/**
 * Delete every object under an exact prefix, paginating until exhausted.
 * Redundant safety: the prefix must be non-trivial and end in '/', and every
 * key is re-checked against the prefix before deletion so we can never widen
 * the blast radius to another client's objects.
 */
async function deletePrefix(prefix: string): Promise<number> {
  if (!prefix.endsWith('/') || prefix.length < 3 || prefix.startsWith('/')) {
    throw new Error(`refusing to delete unsafe R2 prefix: "${prefix}"`);
  }
  let deleted = 0;
  let token: string | undefined;
  do {
    const listed = await r2.send(
      new ListObjectsV2Command({
        Bucket: process.env.R2_BUCKET_NAME!,
        Prefix: prefix,
        ContinuationToken: token,
      }),
    );
    const objects = (listed.Contents ?? [])
      .map((o) => o.Key)
      .filter((k): k is string => !!k && k.startsWith(prefix))
      .map((k) => ({ Key: k }));
    if (objects.length > 0) {
      await r2.send(
        new DeleteObjectsCommand({
          Bucket: process.env.R2_BUCKET_NAME!,
          Delete: { Objects: objects },
        }),
      );
      deleted += objects.length;
    }
    token = listed.IsTruncated ? listed.NextContinuationToken : undefined;
  } while (token);
  return deleted;
}

export async function POST(req: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  void req;
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const admin = createServiceRoleClient();

  // Verify client exists
  const { data: client } = await admin
    .from('clients')
    .select('id, business_name, slug')
    .eq('id', id)
    .single();
  if (!client) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  // Log final audit event BEFORE deletion
  await admin.from('events').insert({
    client_id: id,
    type: 'hard_delete',
    metadata: {
      business_name: client.business_name,
      slug: client.slug,
      deleted_by: user.email,
    },
  });

  // Delete this client's R2 objects (photos, logo, favicon, blog images).
  // Scoped to the `clients/<id>/` prefix — id is the verified DB row id.
  const clientAssets = await deletePrefix(`clients/${id}/`);

  // Delete the static site bundle, which lives under a separate slug-based
  // prefix (`static-sites/<slug>/`). deleteStaticBundle paginates + re-checks
  // each key against the prefix; skip if the row somehow has no slug.
  if (client.slug) {
    await deleteStaticBundle(client.slug);
  }

  // Delete DB row — cascades to content, photos, requests, events (on delete cascade/set null)
  await admin.from('clients').delete().eq('id', id);

  return NextResponse.json({
    success: true,
    deleted: client.business_name,
    r2_assets_deleted: clientAssets,
  });
}
