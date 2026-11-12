import { Resend } from 'resend';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { clientDisplayName } from '@/lib/client-display';
import { renderTemplate, type EmailTemplate } from './templates';

// ============================================================================
// Interface — enforces that email functions can NEVER accept a raw address.
// clientId is the only way to address a recipient; the implementation looks
// up the email address from auth.users via the service role client.
// ============================================================================
export interface EmailProvider {
  send(opts: {
    clientId: string;
    template: EmailTemplate;
    variables: Record<string, string>;
  }): Promise<{ id: string }>;
}

// Shared Resend client + from-address. Lazily initialized so envs absent at
// import time (e.g. during static analysis) don't throw.
let resendInstance: Resend | null = null;
function getResend(): Resend {
  if (!resendInstance) resendInstance = new Resend(process.env.RESEND_API_KEY!);
  return resendInstance;
}
function fromAddress(): string {
  return process.env.RESEND_FROM_EMAIL ?? 'notifications@yourdomain.com';
}
function replyToAddress(): string | undefined {
  return process.env.REPLY_TO_EMAIL || undefined;
}

class ResendEmailProvider implements EmailProvider {
  async send(opts: {
    clientId: string;
    template: EmailTemplate;
    variables: Record<string, string>;
  }): Promise<{ id: string }> {
    const admin = createServiceRoleClient();

    // Look up owner email from DB — NEVER accept a raw address parameter
    const { data: client } = await admin
      .from('clients')
      .select('owner_user_id, business_name, slug, custom_domain')
      .eq('id', opts.clientId)
      .single();

    if (!client?.owner_user_id) {
      throw new Error(`EmailProvider.send: no owner for client ${opts.clientId}`);
    }

    const { data: { user }, error } = await admin.auth.admin.getUserById(client.owner_user_id);
    if (error || !user?.email) {
      throw new Error(`EmailProvider.send: cannot find email for client ${opts.clientId}`);
    }

    const { subject, html } = renderTemplate(opts.template, {
      business_name: clientDisplayName(client),
      ...opts.variables,
    });

    const { data, error: sendError } = await getResend().emails.send({
      from: fromAddress(),
      to: user.email,
      replyTo: replyToAddress(),
      subject,
      html,
    });

    if (sendError || !data) {
      throw new Error(`Resend error: ${sendError?.message ?? 'unknown'}`);
    }

    return { id: data.id };
  }
}

let providerInstance: EmailProvider | null = null;

export function getEmailProvider(): EmailProvider {
  if (!providerInstance) {
    providerInstance = new ResendEmailProvider();
  }
  return providerInstance;
}

/**
 * Manual admin-composed email. Unlike EmailProvider.send (which is locked to a
 * client's owner via clientId), this sends a free-typed subject + HTML body to
 * an arbitrary address the admin entered. Gated behind admin auth at the route
 * layer — never expose it to user-supplied input without that gate. Sends from
 * the shared from-address (notifications@) with the standard reply-to.
 */
export async function sendManualEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ id: string }> {
  const { data, error } = await getResend().emails.send({
    from: fromAddress(),
    to: opts.to,
    replyTo: replyToAddress(),
    subject: opts.subject,
    html: opts.html,
  });
  if (error || !data) {
    throw new Error(`Resend error: ${error?.message ?? 'unknown'}`);
  }
  return { id: data.id };
}

/**
 * Alert email directly to the platform admin.
 * The only function that targets ADMIN_EMAIL — never user-supplied.
 */
export async function sendAdminAlert(opts: { subject: string; html: string }): Promise<void> {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) return;
  await getResend().emails.send({
    from: fromAddress(),
    to: adminEmail,
    subject: opts.subject,
    html: opts.html,
  });
}

/**
 * Save-preview email — sent when an unclaimed landing-page visitor enters
 * their email to bookmark the generated site so they can finish checkout
 * later. Bypasses the owner-lookup path of EmailProvider.send because the
 * site has no owner yet. Abuse is bounded by the route's per-IP rate limit
 * + honeypot — never call this without those guards in front of it.
 */
export async function sendUnclaimedPreviewEmail(opts: {
  to: string;
  variables: { business_name: string; restore_url: string };
}): Promise<{ id: string }> {
  const { subject, html } = renderTemplate('preview_saved', opts.variables);
  const { data, error } = await getResend().emails.send({
    from: fromAddress(),
    to: opts.to,
    replyTo: replyToAddress(),
    subject,
    html,
  });
  if (error || !data) {
    throw new Error(`Resend error: ${error?.message ?? 'unknown'}`);
  }
  return { id: data.id };
}

/**
 * Welcome email for a newly-created or newly-approved sales rep / affiliate.
 * Address-by-email instead of by client_id because reps don't have a
 * clients row. Called from:
 *   - routeAuthenticatedUser on first signup (kind+status from the new row)
 *   - /api/admin/reps/[id] PATCH when status flips pending → active
 * Caller is responsible for not double-sending (e.g. don't fire on every
 * approve, only on the first pending→active transition).
 */
export async function sendRepWelcomeEmail(opts: {
  to: string;
  kind: 'rep' | 'affiliate';
  status: 'pending' | 'active';
  code: string;
  commissionPct: number;
}): Promise<{ id: string } | null> {
  if (!opts.to) return null;

  const platformDomain = process.env.PLATFORM_DOMAIN ?? 'localhost:3000';
  const proto = platformDomain.startsWith('localhost') ? 'http' : 'https';
  const base = `${proto}://${platformDomain}`;

  const refLink = `${base}/r/${opts.code}`;
  const dashboardUrl = `${base}/reps`;
  // Affiliates and reps both sign in via /affiliates/login (the public funnel
  // was collapsed; /reps/login redirects there anyway). Guide URL differs:
  // affiliates get the public marketing page; reps get /sales-reps, which is
  // login-gated — clicking it before signing in bounces to /affiliates, but
  // post-login it shows their full playbook.
  const loginUrl = `${base}/affiliates/login`;
  const guideUrl = opts.kind === 'affiliate' ? `${base}/affiliates` : `${base}/sales-reps`;

  const kindLabel = opts.kind === 'affiliate' ? 'affiliate' : 'sales rep';
  const programLabel =
    opts.kind === 'affiliate' ? 'affiliate program' : 'sales rep program';

  const template: EmailTemplate =
    opts.status === 'active' ? 'rep_welcome_active' : 'rep_welcome_pending';

  const { subject, html } = renderTemplate(template, {
    kind_label: kindLabel,
    program_label: programLabel,
    commission_pct: String(opts.commissionPct),
    ref_link: refLink,
    dashboard_url: dashboardUrl,
    login_url: loginUrl,
    guide_url: guideUrl,
  });

  const { data, error } = await getResend().emails.send({
    from: fromAddress(),
    to: opts.to,
    replyTo: replyToAddress(),
    subject,
    html,
  });
  if (error || !data) {
    throw new Error(`Resend error: ${error?.message ?? 'unknown'}`);
  }
  return { id: data.id };
}
