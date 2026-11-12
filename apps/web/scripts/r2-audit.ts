/**
 * R2 orphan audit — READ ONLY. Deletes nothing.
 *
 * Lists every folder under `clients/<id>/` and `static-sites/<slug>/` in R2,
 * diffs them against live rows in the `clients` table, and reports which R2
 * folders are orphans (no matching DB row) vs. which are still live.
 *
 * Run from apps/web:
 *   node_modules/.bin/tsx --env-file=../../.env.local scripts/r2-audit.ts
 *
 * Outputs a report only. To actually delete, that's a separate explicit step.
 */
import {
  S3Client,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from '@aws-sdk/client-s3';
import { createClient } from '@supabase/supabase-js';

const DELETE = process.argv.includes('--delete');

// A client we must NEVER touch — live paying customer. Used as a tripwire.
const PROTECTED_SLUGS = ['pour-mobile-events'];

const BUCKET = process.env.R2_BUCKET_NAME!;

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

type Folder = { name: string; objects: number; bytes: number };

/** Scan every object under a top-level prefix, grouped by the next path segment. */
async function scanByFolder(topPrefix: string): Promise<Map<string, Folder>> {
  const folders = new Map<string, Folder>();
  let token: string | undefined;
  do {
    const listed = await r2.send(
      new ListObjectsV2Command({
        Bucket: BUCKET,
        Prefix: topPrefix,
        ContinuationToken: token,
      }),
    );
    for (const o of listed.Contents ?? []) {
      if (!o.Key) continue;
      const rest = o.Key.slice(topPrefix.length); // e.g. "<id>/photo.jpg"
      const segment = rest.split('/')[0];
      if (!segment) continue;
      const f = folders.get(segment) ?? { name: segment, objects: 0, bytes: 0 };
      f.objects += 1;
      f.bytes += o.Size ?? 0;
      folders.set(segment, f);
    }
    token = listed.IsTruncated ? listed.NextContinuationToken : undefined;
  } while (token);
  return folders;
}

function human(bytes: number): string {
  const u = ['B', 'KB', 'MB', 'GB'];
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < u.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(1)} ${u[i]}`;
}

function report(
  title: string,
  folders: Map<string, Folder>,
  liveKeys: Set<string>,
  protectedKeys: Set<string>,
) {
  const rows = [...folders.values()].sort((a, b) => b.bytes - a.bytes);
  let orphanBytes = 0;
  let liveBytes = 0;
  const orphans: Folder[] = [];

  console.log(`\n${'='.repeat(70)}\n${title}\n${'='.repeat(70)}`);
  for (const f of rows) {
    const isProtected = protectedKeys.has(f.name);
    const isLive = liveKeys.has(f.name);
    const status = isProtected
      ? '🛡  PROTECTED'
      : isLive
        ? '✅ LIVE     '
        : '🗑  ORPHAN   ';
    if (isProtected && !isLive) {
      console.log(`\n⚠️  WARNING: protected "${f.name}" not found in DB live set! Aborting recommendation.\n`);
    }
    if (!isLive && !isProtected) {
      orphanBytes += f.bytes;
      orphans.push(f);
    } else {
      liveBytes += f.bytes;
    }
    console.log(
      `${status}  ${f.name.padEnd(40)} ${String(f.objects).padStart(5)} objs  ${human(f.bytes).padStart(10)}`,
    );
  }

  console.log(`\n  Live/kept:   ${human(liveBytes)}`);
  console.log(`  Orphaned:    ${human(orphanBytes)}  (${orphans.length} folders) <- reclaimable`);
  return { orphans, orphanBytes };
}

/**
 * Delete every object under an exact `<topPrefix><name>/` prefix.
 * Layered safety: prefix must end in '/', every listed key is re-checked
 * against the prefix before deletion, and the caller has already re-verified
 * `name` is absent from a freshly-fetched live DB set.
 */
async function deleteFolder(topPrefix: string, name: string): Promise<number> {
  const prefix = `${topPrefix}${name}/`;
  if (!prefix.endsWith('/') || prefix.length < 4 || prefix.startsWith('/') || !name) {
    throw new Error(`refusing unsafe prefix: "${prefix}"`);
  }
  let deleted = 0;
  let token: string | undefined;
  do {
    const listed = await r2.send(
      new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefix, ContinuationToken: token }),
    );
    const objects = (listed.Contents ?? [])
      .map((o) => o.Key)
      .filter((k): k is string => !!k && k.startsWith(prefix))
      .map((k) => ({ Key: k }));
    if (objects.length > 0) {
      await r2.send(
        new DeleteObjectsCommand({ Bucket: BUCKET, Delete: { Objects: objects } }),
      );
      deleted += objects.length;
    }
    token = listed.IsTruncated ? listed.NextContinuationToken : undefined;
  } while (token);
  return deleted;
}

async function performDeletes(
  clientOrphans: Folder[],
  siteOrphans: Folder[],
  protectedIds: Set<string>,
  protectedSlugs: Set<string>,
) {
  console.log(`\n${'#'.repeat(70)}\nDELETE MODE — re-verifying against a FRESH DB snapshot\n${'#'.repeat(70)}`);

  // Re-fetch the live set immediately before deleting — never trust the
  // snapshot taken at the start of the run.
  const { data: fresh, error } = await db.from('clients').select('id, slug');
  if (error) throw new Error(`re-verify DB fetch failed: ${error.message}`);
  const liveIds = new Set((fresh ?? []).map((c) => c.id));
  const liveSlugs = new Set((fresh ?? []).map((c) => c.slug).filter(Boolean));

  let totalObjs = 0;
  let skipped = 0;

  const run = async (
    label: string,
    topPrefix: string,
    orphans: Folder[],
    live: Set<string>,
    prot: Set<string>,
  ) => {
    for (const f of orphans) {
      if (live.has(f.name) || prot.has(f.name)) {
        console.log(`  ⏭  SKIP ${label} ${f.name} — now live/protected, not deleting`);
        skipped++;
        continue;
      }
      const n = await deleteFolder(topPrefix, f.name);
      totalObjs += n;
      console.log(`  🗑  ${label} ${f.name} — ${n} objects deleted`);
    }
  };

  await run('clients/', 'clients/', clientOrphans, liveIds, protectedIds);
  await run('static-sites/', 'static-sites/', siteOrphans, liveSlugs, protectedSlugs);

  console.log(`\nDeleted ${totalObjs} objects across ${clientOrphans.length + siteOrphans.length - skipped} folders. Skipped ${skipped}.`);
}

async function main() {
  console.log('Fetching live clients from DB...');
  const { data: clients, error } = await db
    .from('clients')
    .select('id, slug, business_name');
  if (error) throw new Error(`DB fetch failed: ${error.message}`);

  const liveIds = new Set((clients ?? []).map((c) => c.id));
  const liveSlugs = new Set((clients ?? []).map((c) => c.slug).filter(Boolean));
  console.log(`  ${clients?.length ?? 0} live clients (${liveIds.size} ids, ${liveSlugs.size} slugs)`);

  // Tripwire: confirm the protected customer is actually present in the DB.
  const protectedRows = (clients ?? []).filter((c) =>
    PROTECTED_SLUGS.includes(c.slug),
  );
  console.log(`\n🛡  Protected customers:`);
  for (const slug of PROTECTED_SLUGS) {
    const row = protectedRows.find((c) => c.slug === slug);
    if (row) {
      console.log(`   ${slug}  ->  id=${row.id}  ("${row.business_name}")  FOUND in DB ✅`);
    } else {
      console.log(`   ${slug}  ->  NOT FOUND in DB ❌  (will be treated as protected anyway)`);
    }
  }

  // Protected id set (so its clients/<id>/ folder is also shielded).
  const protectedIds = new Set(protectedRows.map((c) => c.id));
  const protectedSlugSet = new Set(PROTECTED_SLUGS);

  console.log('\nScanning R2 clients/ ...');
  const clientFolders = await scanByFolder('clients/');
  console.log('Scanning R2 static-sites/ ...');
  const siteFolders = await scanByFolder('static-sites/');

  const a = report('clients/<id>/  (AI-generated site assets)', clientFolders, liveIds, protectedIds);
  const b = report('static-sites/<slug>/  (uploaded static bundles)', siteFolders, liveSlugs, protectedSlugSet);

  console.log(`\n${'='.repeat(70)}`);
  console.log(`TOTAL RECLAIMABLE: ${human(a.orphanBytes + b.orphanBytes)}`);
  console.log(`${'='.repeat(70)}`);

  if (!DELETE) {
    console.log('\nNo objects were deleted. This was a read-only audit.');
    console.log('Re-run with --delete to remove the 🗑 ORPHAN folders above.');
    return;
  }

  await performDeletes(a.orphans, b.orphans, protectedIds, protectedSlugSet);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
