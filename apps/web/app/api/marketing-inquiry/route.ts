import { NextRequest, NextResponse, after } from 'next/server';
import { z } from 'zod';
import { Resend } from 'resend';
import { escapeHtml } from '@/lib/email';
import { sendLeadCapiEvent } from '@/lib/meta';

// Lead capture for the StoopCraft Marketing ad-management funnel (/marketing).
// Same shape as /api/agency-inquiry — forwards a new prospect to StoopCraft's
// own inbox, fires the browser-deduped CAPI Lead, and posts to SecureMyLead —
// but this is the $499/mo done-for-you ads offer (3-day free trial), so it
// tags the webhook lead with quoteAmount 499 and collects a leaner form: just
// the contact essentials, since the close happens on the booked call.

// Where marketing leads land. Hard-coded (not env-driven) so the team can reply
// straight from this Gmail inbox regardless of platform admin config — matches
// /api/agency-inquiry.
const LEAD_INBOX = process.env.PORTFOLIO_LEAD_INBOX || 'leads@example.com';

// SecureMyLead webhook — the SAME endpoint the homepage funnel hits, so every
// lead (website + ads) lands in one CRM. Fired server-side, so it's exempt from
// any page CSP. Best-effort: failures are logged and swallowed.
const SECUREMYLEAD_WEBHOOK_URL =
  process.env.SECUREMYLEAD_WEBHOOK_URL || undefined;

async function postToSecureMyLead(payload: Record<string, unknown>): Promise<void> {
  if (!SECUREMYLEAD_WEBHOOK_URL) return;
  try {
    const res = await fetch(SECUREMYLEAD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.error('marketing securemylead webhook failed', res.status, detail);
    }
  } catch (err) {
    console.error('marketing securemylead webhook error', err instanceof Error ? err.message : String(err));
  }
}

const schema = z.object({
  name: z.string().min(1).max(100),
  business_name: z.string().min(1).max(120),
  email: z.string().email().max(120),
  // Phone is required — this funnel closes over the phone, so a bad or missing
  // number costs us the conversation. Kept lenient on format.
  phone: z.string().min(5).max(40),
  // Qualifying signal. `budget` is gated required in the UI, the rest optional;
  // all kept lenient here so a stray client value never costs us a real lead.
  website: z.string().max(200).optional().or(z.literal('')),
  service: z.string().max(160).optional().or(z.literal('')),
  budget: z.string().max(40).optional().or(z.literal('')),
  // Honeypot — real visitors never see this field, bots fill everything.
  company_site: z.string().max(200).optional(),
  // Client-generated id shared with the browser Meta Pixel so the server-side
  // Conversions API copy of the Lead event dedupes against it.
  event_id: z.string().max(100).optional(),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: 'validation_failed' }, { status: 400 });
  }

  // Honeypot tripped — fake success so the bot doesn't probe further.
  if (parsed.data.company_site) {
    return NextResponse.json({ success: true });
  }

  const d = parsed.data;

  // Independent fire-and-forget sinks (pixel → email → webhook), none blocking
  // the response — same pattern and reasoning as /api/agency-inquiry.

  // 1. Pixel — server-side CAPI copy of the browser Lead event, deduped via the
  //    shared event_id. Capture request-derived values now (req isn't reliably
  //    usable inside after()).
  if (d.event_id) {
    const [firstName, ...lastParts] = d.name.trim().split(/\s+/);
    const capiInput = {
      eventId: d.event_id,
      email: d.email,
      phone: d.phone || undefined,
      firstName,
      lastName: lastParts.length ? lastParts.join(' ') : undefined,
      clientIp: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
      userAgent: req.headers.get('user-agent') ?? undefined,
      fbp: req.cookies.get('_fbp')?.value,
      fbc: req.cookies.get('_fbc')?.value,
      eventSourceUrl: req.headers.get('referer') ?? undefined,
    };
    after(() => sendLeadCapiEvent(capiInput));
  }

  // 2. Email — forward the lead to the StoopCraft inbox.
  after(() => sendLeadEmail(d));

  // 3. Webhook — SecureMyLead, tagged as the $499/mo ads offer so the CRM can
  //    tell it apart from the $99/mo website leads coming off the homepage. The
  //    optional qualifiers fold into free-text notes (blanks skipped), matching
  //    how /api/agency-inquiry surfaces its qualifying answers.
  const notes = [
    'Source: StoopCraft Marketing (/marketing) — 3-day free ad trial → $499/mo',
    d.budget ? `Monthly ad budget: ${d.budget}` : '',
    d.website ? `Website / social: ${d.website}` : '',
    d.service ? `Wants leads for: ${d.service}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  after(() =>
    postToSecureMyLead({
      name: d.name,
      business_name: d.business_name,
      email: d.email,
      phone: d.phone,
      notes,
      quoteAmount: 499,
      event_id: d.event_id ?? '',
    }),
  );

  return NextResponse.json({ success: true });
}

// Email the lead to the StoopCraft inbox. Self-handling (logs, never throws) so
// it can run as an independent post-response sink without affecting the others.
async function sendLeadEmail(d: z.infer<typeof schema>): Promise<void> {
  const from = process.env.RESEND_FROM_EMAIL || 'notifications@stoopcraft.com';
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.info('marketing-inquiry (no RESEND_API_KEY, not emailed):', d);
    return;
  }

  const rows: [string, string | undefined][] = [
    ['Name', d.name],
    ['Business', d.business_name],
    ['Phone', d.phone],
    ['Email', d.email],
    ['Ad budget', d.budget || undefined],
    ['Website / social', d.website || undefined],
    ['Wants leads for', d.service || undefined],
  ];

  const rowsHtml = rows
    .filter(([, v]) => v)
    .map(
      ([label, value]) =>
        `<tr><td style="width:120px;padding:10px 14px;background:#fafafa;font-weight:600;color:#52525b;border-bottom:1px solid #e4e4e7;vertical-align:top;">${label}</td><td style="padding:10px 14px;border-bottom:1px solid #e4e4e7;color:#18181b;">${escapeHtml(value!)}</td></tr>`,
    )
    .join('');

  const html = `
    <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;">
      <h2 style="color:#0a0a0a;font-size:20px;margin:0 0 4px;">New ad-management lead</h2>
      <p style="color:#71717a;margin:0 0 18px;font-size:14px;">From the StoopCraft Marketing page (/marketing) — wants the 3-day free ad trial ($499/mo). Reply to this email to reach them directly.</p>
      <table style="width:100%;border-collapse:collapse;border:1px solid #e4e4e7;border-radius:8px;overflow:hidden;font-size:14px;">${rowsHtml}</table>
    </div>`;

  try {
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from,
      to: LEAD_INBOX,
      replyTo: d.email,
      subject: `New ad-management lead — ${d.business_name}`,
      html,
    });
  } catch (err) {
    console.error('marketing-inquiry email failed', err);
  }
}
