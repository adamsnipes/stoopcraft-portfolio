// Honeypot abuse guard for public funnel endpoints. The original module
// here also wrapped Cloudflare Turnstile, but live testing showed the
// widget's single-use token refresh failed too often for legitimate users
// (kills conversions on /generate, /claim, etc.), so Turnstile was removed
// from the funnel. Defense-in-depth now relies on: this honeypot + per-IP
// rate limits + per-endpoint guards (e.g. duplicate-place-id) + Stripe's
// own fraud detection at checkout.

export type AbuseCheckResult =
  | { ok: true }
  | { ok: false; reason: 'honeypot' };

/**
 * Reject requests that fill the hidden `website` field — humans never see
 * it (rendered absolutely-positioned off-screen with tabIndex=-1) but
 * form-scraping bots fill every input they find.
 */
export function checkHoneypot(body: Record<string, unknown>): AbuseCheckResult {
  const honey = body.website;
  if (typeof honey === 'string' && honey.trim().length > 0) {
    return { ok: false, reason: 'honeypot' };
  }
  return { ok: true };
}
