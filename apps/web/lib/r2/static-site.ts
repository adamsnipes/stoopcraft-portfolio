import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import JSZip from 'jszip';

// ============================================================================
// Static HTML site storage (R2)
//
// Each static client's bundle lives under  static-sites/<slug>/…  in R2.
// The entry document is always normalized to `index.html`. We inject a
// <base href="/h/<slug>/"> into it so relative asset paths (`assets/pic.png`)
// resolve against the site's own namespace even when it's served at the
// customer's bare host. The serving route handler (app/h/[slug]) streams these
// objects back out — R2 is never public for static sites.
// ============================================================================

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = () => process.env.R2_BUCKET_NAME!;
export const ENTRY = 'index.html';
const prefixFor = (slug: string) => `static-sites/${slug}`;

// ---------------------------------------------------------------------------
// MIME — small map keyed on extension. Unknowns fall back to octet-stream so
// the browser downloads rather than mis-renders.
// ---------------------------------------------------------------------------
const MIME: Record<string, string> = {
  html: 'text/html; charset=utf-8',
  htm: 'text/html; charset=utf-8',
  css: 'text/css; charset=utf-8',
  js: 'text/javascript; charset=utf-8',
  mjs: 'text/javascript; charset=utf-8',
  json: 'application/json; charset=utf-8',
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  ico: 'image/x-icon',
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
  otf: 'font/otf',
  eot: 'application/vnd.ms-fontobject',
  txt: 'text/plain; charset=utf-8',
  pdf: 'application/pdf',
  mp4: 'video/mp4',
  webm: 'video/webm',
  xml: 'application/xml; charset=utf-8',
};

export function mimeForPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  return MIME[ext] ?? 'application/octet-stream';
}

function isHtmlPath(path: string): boolean {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  return ext === 'html' || ext === 'htm';
}

// Inject <base href> into the entry document so relative paths resolve into the
// site's /h/<slug>/ namespace. Idempotent: skips if a <base> already exists.
export function injectBaseHref(html: string, slug: string): string {
  if (/<base\s/i.test(html)) return html;
  const base = `<base href="/h/${slug}/">`;
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head([^>]*)>/i, `<head$1>\n  ${base}`);
  }
  if (/<html[^>]*>/i.test(html)) {
    return html.replace(/<html([^>]*)>/i, `<html$1>\n<head>\n  ${base}\n</head>`);
  }
  return `${base}\n${html}`;
}

async function putObject(key: string, body: Buffer, contentType: string): Promise<void> {
  await r2.send(
    new PutObjectCommand({
      Bucket: BUCKET(),
      Key: key,
      Body: body,
      ContentType: contentType,
      // Served through our route handler, which sets its own cache headers;
      // keep the stored object uncacheable so replaces take effect immediately.
      CacheControl: 'no-cache',
    }),
  );
}

export type UploadResult = { fileCount: number; entry: string };

/**
 * Upload a static bundle for a slug. Accepts either a single .html file or a
 * .zip containing index.html (+ assets). Clears any previous bundle first so a
 * re-upload fully replaces the old site rather than leaving orphans.
 */
export async function uploadStaticBundle(
  slug: string,
  file: { buffer: Buffer; filename: string },
): Promise<UploadResult> {
  await deleteStaticBundle(slug);

  const isZip = /\.zip$/i.test(file.filename);
  const prefix = prefixFor(slug);

  if (!isZip) {
    // Single document → normalize to index.html with the base href injected.
    const html = injectBaseHref(file.buffer.toString('utf8'), slug);
    await putObject(`${prefix}/${ENTRY}`, Buffer.from(html, 'utf8'), mimeForPath(ENTRY));
    return { fileCount: 1, entry: ENTRY };
  }

  const zip = await JSZip.loadAsync(file.buffer);

  // Collect real (non-directory) entries, ignoring junk like __MACOSX/.
  const entries = Object.values(zip.files).filter(
    (f) => !f.dir && !f.name.startsWith('__MACOSX/') && !f.name.split('/').pop()!.startsWith('.'),
  );

  // Find the entry HTML and treat its directory as the bundle root, so a zip
  // of `index.html` and a zip of `my-site/index.html` both work.
  const indexEntry =
    entries.find((f) => f.name.toLowerCase().endsWith('/' + ENTRY)) ??
    entries.find((f) => f.name.toLowerCase() === ENTRY) ??
    entries.find((f) => isHtmlPath(f.name));
  if (!indexEntry) {
    throw new Error('NO_HTML_ENTRY');
  }
  const root = indexEntry.name.includes('/')
    ? indexEntry.name.slice(0, indexEntry.name.lastIndexOf('/') + 1)
    : '';

  let count = 0;
  for (const entry of entries) {
    if (root && !entry.name.startsWith(root)) continue; // outside the bundle root
    const rel = root ? entry.name.slice(root.length) : entry.name;
    if (!rel) continue;
    const buf = Buffer.from(await entry.async('nodebuffer'));
    // The single entry document becomes index.html with base href injected.
    if (entry.name === indexEntry.name) {
      const html = injectBaseHref(buf.toString('utf8'), slug);
      await putObject(`${prefix}/${ENTRY}`, Buffer.from(html, 'utf8'), mimeForPath(ENTRY));
    } else {
      await putObject(`${prefix}/${rel}`, buf, mimeForPath(rel));
    }
    count++;
  }

  return { fileCount: count, entry: ENTRY };
}

/** Fetch one object from a slug's bundle. Returns null if missing. */
export async function getStaticObject(
  slug: string,
  relPath: string,
): Promise<{ body: Uint8Array; contentType: string } | null> {
  // Normalize: strip leading slashes, default to the entry document, reject
  // path traversal.
  let rel = relPath.replace(/^\/+/, '');
  if (rel === '' || rel.endsWith('/')) rel += ENTRY;
  if (rel.split('/').some((seg) => seg === '..')) return null;

  try {
    const res = await r2.send(
      new GetObjectCommand({ Bucket: BUCKET(), Key: `${prefixFor(slug)}/${rel}` }),
    );
    if (!res.Body) return null;
    const body = await res.Body.transformToByteArray();
    return { body, contentType: mimeForPath(rel) };
  } catch {
    return null;
  }
}

/** Delete every object under a slug's bundle. */
export async function deleteStaticBundle(slug: string): Promise<void> {
  // Redundant safety: never run with a missing/blank slug — that would build a
  // prefix matching every bundle. Require a real slug + trailing slash so we
  // can't widen the blast radius to another client's bundle.
  if (!slug || !slug.trim()) {
    throw new Error('deleteStaticBundle: refusing to run with empty slug');
  }
  const prefix = prefixFor(slug) + '/';
  let token: string | undefined;
  do {
    const listed = await r2
      .send(
        new ListObjectsV2Command({
          Bucket: BUCKET(),
          Prefix: prefix,
          ContinuationToken: token,
        }),
      )
      .catch(() => null);
    if (!listed?.Contents?.length) return;
    // Re-check every key against the exact prefix before deleting.
    const objects = listed.Contents.map((o) => o.Key)
      .filter((k): k is string => !!k && k.startsWith(prefix))
      .map((k) => ({ Key: k }));
    if (objects.length > 0) {
      await r2
        .send(
          new DeleteObjectsCommand({
            Bucket: BUCKET(),
            Delete: { Objects: objects },
          }),
        )
        .catch(() => {});
    }
    token = listed.IsTruncated ? listed.NextContinuationToken : undefined;
  } while (token);
}
