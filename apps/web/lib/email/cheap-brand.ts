import { Resend } from 'resend';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { clientDisplayName } from '@/lib/client-display';
import { CHEAP_BRAND } from '@/lib/marketing-brand';
import { escapeHtml } from './templates';

// Customer emails for Stupid Cheap Websites clients. Deliberately separate from
// the StoopCraft EmailProvider: its own Resend account (RESEND_API_KEY_CHEAP),
// sender, reply-to and copy, so nothing a SCW customer receives names
// StoopCraft. There is no fallback to the StoopCraft account — a missing key
// throws, and the caller logs it.
//
// Same addressing rule as EmailProvider: a clientId, never a raw address; the
// recipient is the client's owner from auth.users.

export type CheapBrandTemplate = 'payment_received' | 'site_live';

type Rendered = { subject: string; paragraphs: string[] };

function render(template: CheapBrandTemplate, businessName: string, vars: Record<string, string>): Rendered {
  switch (template) {
    case 'payment_received':
      return {
        subject: `Payment received. Let’s get ${businessName} live.`,
        paragraphs: [
          `Thanks for launching with ${CHEAP_BRAND.name}. Your $${CHEAP_BRAND.monthly}/month plan is active.`,
          `We’re putting the finishing touches on the website for ${businessName} and will email you as soon as it’s live.`,
          'Want anything changed before launch? Just reply to this email.',
        ],
      };
    case 'site_live':
      return {
        subject: `Your ${businessName} website is live`,
        paragraphs: [
          `Your website for ${businessName} is live at ${vars['site_url']}.`,
          'Need to change your hours, a photo or some text? Just reply to this email and we’ll handle it.',
        ],
      };
  }
}

function html({ paragraphs }: Rendered, extraHtml = ''): string {
  const body = paragraphs
    .map(p => `<p style="margin:0 0 16px;">${escapeHtml(p).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#171717;">$1</a>')}</p>`)
    .join('') + extraHtml;
  return `<div style="background:#faf9f3;padding:32px 16px;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#171717;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border:1.5px solid #171717;border-radius:6px;padding:28px;font-size:15px;line-height:1.6;">
    <p style="margin:0 0 20px;font-size:15px;font-weight:900;letter-spacing:-0.5px;">STUPID <span style="background:#f5ff3b;padding:0 3px;">CHEAP</span> WEBSITES</p>
    ${body}
    <p style="margin:0;color:#69685f;">The ${CHEAP_BRAND.name} team</p>
  </div>
</div>`;
}

function brandKey(): string {
  const apiKey = process.env.RESEND_API_KEY_CHEAP;
  if (!apiKey) throw new Error('RESEND_API_KEY_CHEAP not set');
  return apiKey;
}

async function send(apiKey: string, to: string, rendered: Rendered, extraHtml = '', extraText: string[] = []): Promise<{ id: string }> {
  const { data, error } = await new Resend(apiKey).emails.send({
    from: `${CHEAP_BRAND.name} <${CHEAP_BRAND.sender}>`,
    to,
    replyTo: CHEAP_BRAND.email,
    subject: rendered.subject,
    html: html(rendered, extraHtml),
    text: [...rendered.paragraphs, ...extraText, `The ${CHEAP_BRAND.name} team`].join('\n\n'),
  });
  if (error || !data) throw new Error(`Resend error: ${error?.message ?? 'unknown'}`);
  return { id: data.id };
}

export async function sendCheapBrandClientEmail(opts: {
  clientId: string;
  template: CheapBrandTemplate;
  variables?: Record<string, string>;
}): Promise<{ id: string }> {
  const apiKey = brandKey();
  const admin = createServiceRoleClient();
  const { data: client } = await admin
    .from('clients')
    .select('owner_user_id, business_name, slug, custom_domain, brand')
    .eq('id', opts.clientId)
    .single();

  if (client?.brand !== CHEAP_BRAND.id) {
    throw new Error(`sendCheapBrandClientEmail: client ${opts.clientId} is not a ${CHEAP_BRAND.name} client`);
  }
  if (!client.owner_user_id) {
    throw new Error(`sendCheapBrandClientEmail: no owner for client ${opts.clientId}`);
  }
  const { data: { user }, error } = await admin.auth.admin.getUserById(client.owner_user_id);
  if (error || !user?.email) {
    throw new Error(`sendCheapBrandClientEmail: cannot find email for client ${opts.clientId}`);
  }

  return send(apiKey, user.email, render(opts.template, clientDisplayName(client), opts.variables ?? {}));
}

// A website lead for a brand client's business. The contact route resolves the
// recipient (notification_email or the owner's address); the lead's details go
// in a table, never interpolated into the paragraphs.
export async function sendCheapBrandLeadEmail(opts: {
  to: string;
  businessName: string;
  lead: { name: string; email?: string | null; phone?: string | null; message: string };
}): Promise<{ id: string }> {
  const apiKey = brandKey();
  const rows: [string, string][] = [['Name', opts.lead.name]];
  if (opts.lead.email) rows.push(['Email', opts.lead.email]);
  if (opts.lead.phone) rows.push(['Phone', opts.lead.phone]);
  rows.push(['Message', opts.lead.message]);
  const table = `<table style="width:100%;border-collapse:collapse;margin:0 0 16px;">${rows
    .map(([label, value]) => `<tr><td style="width:80px;padding:8px 0;font-weight:700;vertical-align:top;">${label}</td><td style="padding:8px 0;">${escapeHtml(value)}</td></tr>`)
    .join('')}</table>`;
  return send(
    apiKey,
    opts.to,
    {
      subject: `New website lead — ${opts.lead.name}`,
      paragraphs: [`Someone just filled out the form on the ${opts.businessName} website.`],
    },
    table,
    rows.map(([label, value]) => `${label}: ${value}`),
  );
}
