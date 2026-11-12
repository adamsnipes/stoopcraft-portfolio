// Allowed external image hosts for MenuItem.photo_url. Hotlinking arbitrary
// URLs is risky (link rot, CSP, no resizing) — we only permit hosts whose
// images we know we want to embed (today: Uber Eats CDN for seed/import).
//
// To extend: add a suffix to ALLOWED_HOST_SUFFIXES and add the matching CSP
// img-src entry in proxy.ts. The two MUST be kept in sync — a host added here
// without a CSP entry will save successfully but render blank in production.
const ALLOWED_HOST_SUFFIXES = ['.uber.com'] as const;

export function isAllowedPhotoUrl(input: string): boolean {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:') return false;
  if (url.username || url.password) return false;
  const host = url.hostname.toLowerCase();
  return ALLOWED_HOST_SUFFIXES.some(
    (suffix) => host === suffix.slice(1) || host.endsWith(suffix),
  );
}
