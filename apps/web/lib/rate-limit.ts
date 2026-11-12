// Tiny in-memory IP rate limiter. Good enough for marketing-launch abuse
// protection on a single Vercel function instance; if traffic spikes across
// many instances we'd need a shared store (KV / Redis). The blast radius for
// instance-local limits is bounded — each instance enforces independently —
// which is acceptable because the underlying generate call already has a
// duplicate-place-id guard that catches the most expensive duplicate spend.

type Bucket = { count: number; resetAt: number; alerted: boolean };

const buckets = new Map<string, Bucket>();

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  // True only on the *first* denied request in a window. Used by routes to
  // fire a single admin alert per (key, window) rather than spamming on every
  // subsequent blocked request. Always false when `allowed` is true.
  firstDenial: boolean;
};

/**
 * Allow up to `max` events per `windowMs` per key. Returns `allowed: false`
 * when the bucket is exhausted; otherwise increments and returns the
 * remaining count.
 */
export function checkRateLimit(
  key: string,
  opts: { max: number; windowMs: number },
): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);
  if (!existing || existing.resetAt < now) {
    const resetAt = now + opts.windowMs;
    buckets.set(key, { count: 1, resetAt, alerted: false });
    return { allowed: true, remaining: opts.max - 1, resetAt, firstDenial: false };
  }
  if (existing.count >= opts.max) {
    const firstDenial = !existing.alerted;
    if (firstDenial) existing.alerted = true;
    return {
      allowed: false,
      remaining: 0,
      resetAt: existing.resetAt,
      firstDenial,
    };
  }
  existing.count += 1;
  return {
    allowed: true,
    remaining: opts.max - existing.count,
    resetAt: existing.resetAt,
    firstDenial: false,
  };
}

/**
 * Extract a usable IP from Next request headers. Vercel sets x-forwarded-for
 * (comma-separated chain); we take the first hop. Falls back to a constant
 * so unit tests don't crash, but in prod the header is always present.
 */
export function clientIpFromHeaders(headers: Headers): string {
  const xff = headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0]!.trim();
  return headers.get('x-real-ip') ?? '127.0.0.1';
}
