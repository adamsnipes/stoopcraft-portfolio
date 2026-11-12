import { NextRequest, NextResponse, after } from 'next/server';
import { z } from 'zod';
import { Resend } from 'resend';
import { escapeHtml } from '@/lib/email';
import { sendLeadCapiEvent } from '@/lib/meta';
import { PRICING } from '@/lib/pricing';
import { CHEAP_BRAND } from '@/lib/marketing-brand';

// Lead capture for the StoopCraft agency marketing site (the homepage lead
// forms). Unlike /api/contact — which routes a message to a specific
// *customer's* inbox by host — this forwards a new prospect to StoopCraft's
// own inbox. That's why it instantiates Resend directly instead of going
// through the clientId-locked EmailProvider (there is no client yet, only a
// lead). replyTo is set to the lead's address so the team can reply directly.

// Where homepage leads land. Hard-coded (not env-driven) so the team can reply
// straight from this Gmail inbox regardless of platform admin config.
const LEAD_INBOX = process.env.PORTFOLIO_LEAD_INBOX || 'leads@example.com';

// SecureMyLead webhooks, one per brand so each brand's leads land in its own
// CRM pipeline. Fired server-side (not from the browser), so they're exempt
// from any page CSP — connect-src never has to allow this origin. StoopCraft's
// webhook URL is supplied through environment configuration. The $40
// brand uses SECUREMYLEAD_WEBHOOK_URL_CHEAP, and when that is unset
// its leads skip the CRM rather than fall back to StoopCraft's pipeline.
// Best-effort: failures are logged and swallowed so they never affect the
// lead, pixel, or UI.
function secureMyLeadUrl(cheapBrand: boolean): string | undefined {
  return cheapBrand
    ? process.env.SECUREMYLEAD_WEBHOOK_URL_CHEAP || undefined
    : process.env.SECUREMYLEAD_WEBHOOK_URL || undefined;
}

async function postToSecureMyLead(url: string, payload: Record<string, unknown>): Promise<void> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.error('securemylead webhook failed', res.status, detail);
    }
  } catch (err) {
    console.error('securemylead webhook error', err instanceof Error ? err.message : String(err));
  }
}

const schema = z.object({
  brand: z.enum(['stoopcraft', CHEAP_BRAND.id]).optional(),
  name: z.string().min(1).max(100),
  business_name: z.string().max(120).optional().or(z.literal('')),
  email: z.string().email().max(120),
  phone: z.string().max(40).optional().or(z.literal('')),
  // Qualifying signal collected by the homepage form. `need` and the contact
  // preferences are gated required in the UI, but kept lenient here so a stray
  // client never costs us a real lead — a missing qualifier just emails through
  // blank.
  need: z.string().max(120).optional().or(z.literal('')),
  contact_method: z.string().max(20).optional().or(z.literal('')),
  contact_time: z.string().max(20).optional().or(z.literal('')),
  // Honeypot — real visitors never see this field, bots fill everything.
  // Accept any value so a filled honeypot doesn't surface a tell-tale
  // validation error; the manual check below fakes success instead.
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

  // The browser Meta Pixel, the server-side CAPI copy, the lead email, and the
  // webhook are independent fire-and-forget sinks: none waits on another, and
  // the HTTP response waits on none of them. We return success immediately so
  // the client's browser pixel (fired on this request resolving) isn't gated by
  // anything downstream. The three server-side sinks each run in their own
  // after() — Vercel's waitUntil keeps the invocation alive long enough for each
  // POST to land even if the visitor navigates away — and each swallows its own
  // errors. Priority, if it ever matters under a tight invocation budget, is
  // pixel → email → webhook, matching registration order.

  // 1. Pixel — server-side CAPI copy of the browser Lead event. Fires here too
  //    so ad/tracking blockers and Safari ITP can't silently drop it; the shared
  //    event_id lets Meta dedupe it against the browser pixel. Skipped when no
  //    event_id was sent (older client) since there'd be nothing to dedupe.
  //    Capture request-derived values now — req isn't reliably usable in after().
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

  // 2. Email — alert the brand's team inbox, and send the lead an
  //    auto-reply from whichever brand they applied through.
  after(() => sendLeadEmail(d));
  after(() => sendLeadConfirmation(d));

  // 3. Webhook — the brand's SecureMyLead pipeline. It maps name/business/email/phone to its own
  //    fields and drops unrecognised keys, so fold the qualifying answers into a
  //    single free-text `notes` blob (one "Label: value" line each, blanks
  //    skipped) where the CRM will actually surface them.
  const notes = ([
    ['Source brand', d.brand === CHEAP_BRAND.id ? CHEAP_BRAND.name : 'StoopCraft'],
    ['Offer', d.brand === CHEAP_BRAND.id ? `$${CHEAP_BRAND.monthly}/month` : `$${PRICING.starter.monthly}/month`],
    ['Needs help with', d.need],
    ['Preferred contact', d.contact_method],
    ['Best time to reach', d.contact_time],
  ] as [string, string | undefined][])
    .filter(([, v]) => v)
    .map(([label, v]) => `${label}: ${v}`)
    .join('\n');

  const crmUrl = secureMyLeadUrl(d.brand === CHEAP_BRAND.id);
  if (!crmUrl) console.info(`agency-inquiry (no CRM webhook for ${d.brand}, not forwarded)`);
  else after(() =>
    postToSecureMyLead(crmUrl, {
      name: d.name,
      business_name: d.business_name || '',
      email: d.email,
      phone: d.phone || '',
      notes,
      // Deal value tagged onto the lead for the CRM. Homepage leads are the
      // $99/mo done-for-you website offer; the /marketing ad-management funnel
      // sends 499 from its own route.
      quoteAmount: d.brand === CHEAP_BRAND.id ? CHEAP_BRAND.monthly : PRICING.starter.monthly,
      event_id: d.event_id ?? '',
    }),
  );

  return NextResponse.json({ success: true });
}

// Each brand's mail — the team alert and the lead auto-reply — goes out through
// its OWN Resend account and sender, and its alert lands in its own inbox.
// Resolved strictly from the submitted brand: a brand whose key is missing sends
// nothing rather than falling back to the other brand's account, so no email
// ever ties the two brands together.
type Brand = NonNullable<z.infer<typeof schema>['brand']>;
const BRAND_MAIL: Record<Brand, () => { apiKey?: string; from: string; replyTo?: string; signature: string; inbox: string }> = {
  stoopcraft: () => ({
    apiKey: process.env.RESEND_API_KEY,
    from: `StoopCraft <${process.env.RESEND_FROM_EMAIL || 'notifications@stoopcraft.com'}>`,
    replyTo: process.env.REPLY_TO_EMAIL || LEAD_INBOX,
    signature: 'StoopCraft',
    inbox: LEAD_INBOX,
  }),
  [CHEAP_BRAND.id]: () => ({
    apiKey: process.env.RESEND_API_KEY_CHEAP,
    from: `${CHEAP_BRAND.name} <${CHEAP_BRAND.sender}>`,
    replyTo: CHEAP_BRAND.email,
    signature: CHEAP_BRAND.name,
    inbox: CHEAP_BRAND.inbox,
  }),
};

// Email the lead to its brand's team inbox. Self-handling (logs, never throws)
// so it can run as an independent post-response sink without affecting the others.
async function sendLeadEmail(d: z.infer<typeof schema>): Promise<void> {
  const brand: Brand = d.brand ?? 'stoopcraft';
  const sender = BRAND_MAIL[brand]();

  // No mail configured (e.g. local dev) — log it; the lead is visible in logs.
  if (!sender.apiKey) {
    console.info(`agency-inquiry (no Resend key for ${brand}, not emailed):`, d);
    return;
  }

  const rows: [string, string | undefined][] = [
    ['Brand', d.brand === CHEAP_BRAND.id ? CHEAP_BRAND.name : 'StoopCraft'],
    ['Monthly offer', d.brand === CHEAP_BRAND.id ? `$${CHEAP_BRAND.monthly}/month` : `$${PRICING.starter.monthly}/month`],
    ['Name', d.name],
    ['Business', d.business_name || undefined],
    ['Email', d.email],
    ['Phone', d.phone || undefined],
    ['Needs help with', d.need || undefined],
    ['Preferred contact', d.contact_method || undefined],
    ['Best time', d.contact_time || undefined],
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
      <h2 style="color:#0a0a0a;font-size:20px;margin:0 0 4px;">New free-website lead</h2>
      <p style="color:#71717a;margin:0 0 18px;font-size:14px;">From ${d.brand === CHEAP_BRAND.id ? CHEAP_BRAND.name : 'the StoopCraft homepage'}. Reply to this email to reach them directly.</p>
      <table style="width:100%;border-collapse:collapse;border:1px solid #e4e4e7;border-radius:8px;overflow:hidden;font-size:14px;">${rowsHtml}</table>
    </div>`;

  try {
    const resend = new Resend(sender.apiKey);
    const { error } = await resend.emails.send({
      from: sender.from,
      to: sender.inbox,
      replyTo: d.email,
      subject: `${d.brand === CHEAP_BRAND.id ? '[Stupid Cheap Websites · $40/mo] ' : ''}New free-website lead — ${d.business_name || d.name}`,
      html,
    });
    // Resend reports API failures (bad key, unverified domain) in the result, not by throwing.
    if (error) console.error(`agency-inquiry email rejected (${brand})`, error);
  } catch (err) {
    console.error('agency-inquiry email failed', err);
  }
}

// Auto-reply asking the lead for the details needed to start their site.
// Self-handling like sendLeadEmail.
async function sendLeadConfirmation(d: z.infer<typeof schema>): Promise<void> {
  const brand: Brand = d.brand ?? 'stoopcraft';
  const sender = BRAND_MAIL[brand]();
  if (!sender.apiKey) {
    console.info(`agency-inquiry (no Resend key for ${brand}, auto-reply not sent)`);
    return;
  }

  const firstName = d.name.trim().split(/\s+/)[0] || 'there';
  const questions = [
    'What your business does / services you provide',
    'Which area(s) you serve?',
    'Any color schemes you prefer (if any).',
  ];
  // Copy is per brand; each brand's wording names only itself.
  const intro = brand === CHEAP_BRAND.id
    ? `Hey ${firstName}, ${CHEAP_BRAND.name} here - we got your request to build your website. Can you please let us know:`
    : `Hey ${firstName}, we got your request to build your website. Can you please let us know:`;
  const closing = brand === CHEAP_BRAND.id
    ? "We're only accepting a handful of applicants, so please let us know at your earliest convenience."
    : null;

  const html = `
    <div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#171717;font-size:15px;line-height:1.6;max-width:520px;">
      <p style="margin:0 0 16px;">${escapeHtml(intro)}</p>
      <ul style="margin:0 0 16px;padding-left:20px;">${questions.map(q => `<li>${q}</li>`).join('')}</ul>
      ${closing ? `<p style="margin:0 0 16px;">${escapeHtml(closing)}</p>` : ''}
      <p style="margin:0 0 4px;">Thank you!</p>
      <p style="margin:0;color:#69685f;">${sender.signature}</p>
    </div>`;

  const text = [
    intro,
    '',
    ...questions.map(q => `- ${q}`),
    '',
    ...(closing ? [closing, ''] : []),
    'Thank you!',
    sender.signature,
  ].join('\n');

  try {
    const resend = new Resend(sender.apiKey);
    const { error } = await resend.emails.send({
      from: sender.from,
      to: d.email,
      replyTo: sender.replyTo,
      subject: 'We got your website request',
      html,
      text,
    });
    if (error) console.error(`agency-inquiry auto-reply rejected (${brand})`, error);
  } catch (err) {
    console.error(`agency-inquiry auto-reply failed (${brand})`, err);
  }
}
