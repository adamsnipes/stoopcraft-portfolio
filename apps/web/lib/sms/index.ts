// Thin Twilio wrapper. We use fetch directly rather than the SDK to avoid
// adding a dependency for what is effectively one POST.

export type SmsResult =
  | { ok: true; sid: string }
  | { ok: false; error: string };

export function isSmsConfigured(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_FROM_NUMBER
  );
}

/**
 * Normalize a US phone number to E.164. Accepts:
 *   - "(415) 555-1212"  -> "+14155551212"
 *   - "415-555-1212"    -> "+14155551212"
 *   - "4155551212"      -> "+14155551212"
 *   - "+14155551212"    -> "+14155551212"
 * Returns null if it doesn't look like a valid 10-digit US number.
 */
export function normalizeUsPhone(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.startsWith('+')) {
    const digits = trimmed.slice(1).replace(/\D/g, '');
    if (digits.length >= 10 && digits.length <= 15) return `+${digits}`;
    return null;
  }
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return null;
}

export async function sendSms(opts: { to: string; body: string }): Promise<SmsResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!sid || !token || !from) {
    return { ok: false, error: 'twilio_not_configured' };
  }

  const auth = Buffer.from(`${sid}:${token}`).toString('base64');
  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
  const form = new URLSearchParams({ To: opts.to, From: from, Body: opts.body });

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form.toString(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    return { ok: false, error: `twilio_${res.status}: ${text.slice(0, 200)}` };
  }

  const data = (await res.json()) as { sid?: string };
  return { ok: true, sid: data.sid ?? '' };
}
