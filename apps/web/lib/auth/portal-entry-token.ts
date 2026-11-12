import { createHmac, timingSafeEqual } from 'crypto';

// Signed, reusable token for the welcome email's "Open your portal" link.
//
// Why not a Supabase one-time magic token in the email? Email link scanners
// (Gmail Safe Links, Outlook ATP, antivirus) prefetch links on delivery and
// burn a single-use token before the human ever clicks — yielding
// verify_failed. This token instead just identifies the owner; the
// /portal-entry route mints a FRESH Supabase OTP per request and verifies it
// immediately (same prefetch-safe pattern as /welcome). Possession of the
// token = ability to sign in as that owner until it expires, exactly like any
// magic link — it lives in the customer's own inbox.
//
// HMAC key: a dedicated PORTAL_ENTRY_SECRET if set, else the service-role key
// (server-only, never shipped to the client; the token is the HMAC, not the key).

const TTL_SECONDS = 72 * 3600; // 3 days — long enough to click a welcome email

function secret(): string {
  return process.env.PORTAL_ENTRY_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
}

function b64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromB64url(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

export function signPortalEntry(userId: string, ttlSeconds = TTL_SECONDS): string {
  const payload = { uid: userId, exp: Math.floor(Date.now() / 1000) + ttlSeconds };
  const body = b64url(Buffer.from(JSON.stringify(payload)));
  const sig = b64url(createHmac('sha256', secret()).update(body).digest());
  return `${body}.${sig}`;
}

export function verifyPortalEntry(token: string): { uid: string } | null {
  const parts = token.split('.');
  const body = parts[0];
  const sig = parts[1];
  if (parts.length !== 2 || !body || !sig) return null;

  const expected = b64url(createHmac('sha256', secret()).update(body).digest());
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(fromB64url(body).toString('utf8')) as { uid?: string; exp?: number };
    if (!payload.uid || typeof payload.exp !== 'number') return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return { uid: payload.uid };
  } catch {
    return null;
  }
}
