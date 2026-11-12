// Twilio Lookup v2 with Line Type Intelligence — used to filter for
// mobile-only numbers before adding a lead. ~$0.005 per call, so dedupe
// MUST run before this.

import { BLOCKED_CARRIERS } from './niches';

const LOOKUP_URL = 'https://lookups.twilio.com/v2/PhoneNumbers';
const REQUEST_TIMEOUT_MS = 15000;

export type LookupOutcome =
  | { ok: true; isMobile: boolean; lineType: string; carrierName: string }
  | { ok: false; reason: 'invalid' | 'blocked_carrier' | 'error' | 'rate_limited'; lineType?: string };

// Strip non-digits, normalize to E.164 US. Returns null if length doesn't
// look like a US number.
export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return null;
}

function isBlockedCarrier(carrierName: string): boolean {
  const lower = carrierName.toLowerCase();
  return BLOCKED_CARRIERS.some((c) => lower.includes(c));
}

// Single retry on 429 with a 5s wait. If the second attempt also 429s,
// we bail with rate_limited so the caller can decide whether to back off.
export async function lookupNumber(opts: {
  phoneE164: string;
  sid: string;
  authToken: string;
}): Promise<LookupOutcome> {
  const { phoneE164, sid, authToken } = opts;
  const url = `${LOOKUP_URL}/${encodeURIComponent(phoneE164)}?Fields=line_type_intelligence`;
  const auth = 'Basic ' + Buffer.from(`${sid}:${authToken}`).toString('base64');

  const fetchOnce = async (): Promise<{ status: number; body: unknown } | null> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/json', Authorization: auth },
        signal: controller.signal,
      });
      const body = res.status === 200 || res.status === 404 ? await res.json() : null;
      return { status: res.status, body };
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  };

  let result = await fetchOnce();
  if (result?.status === 429) {
    await new Promise((r) => setTimeout(r, 5000));
    result = await fetchOnce();
    if (result?.status === 429) return { ok: false, reason: 'rate_limited' };
  }

  if (!result) return { ok: false, reason: 'error' };

  if (result.status === 404) return { ok: false, reason: 'invalid' };
  if (result.status !== 200) return { ok: false, reason: 'error' };

  const data = result.body as {
    valid?: boolean;
    line_type_intelligence?: { type?: string; carrier_name?: string };
  };
  if (!data.valid) return { ok: false, reason: 'invalid' };

  const lti = data.line_type_intelligence ?? {};
  const lineType = lti.type ?? 'unknown';
  const carrierName = lti.carrier_name ?? '';

  if (isBlockedCarrier(carrierName)) {
    return { ok: false, reason: 'blocked_carrier', lineType };
  }

  return {
    ok: true,
    isMobile: lineType === 'mobile',
    lineType,
    carrierName,
  };
}
