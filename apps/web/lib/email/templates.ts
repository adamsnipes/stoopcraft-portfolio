// Email template definitions — plain HTML, no template engine dependency.
// Variables are substituted via simple string replacement: {{variable_name}}.
// Use {{{variable_name}}} (triple braces) for pre-built HTML snippets that must not be escaped.

import { PRICING } from '@/lib/pricing';

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export type EmailTemplate =
  | 'welcome'
  | 'provisioning_started'
  | 'payment_failed'
  | 'cancellation_confirmation'
  | 'contact_form_lead'
  | 'request_submitted'
  | 'request_status_updated'
  | 'request_resolved'
  | 'monthly_report'
  | 'seo_report'
  | 'reactivation_reminder_30'
  | 'reactivation_reminder_55'
  | 'preview_saved'
  | 'rep_welcome_active'
  | 'rep_welcome_pending';

type TemplateDefinition = {
  subject: (vars: Record<string, string>) => string;
  html: (vars: Record<string, string>) => string;
};

function interpolate(template: string, vars: Record<string, string>): string {
  return template
    .replace(/\{\{\{(\w+)\}\}\}/g, (_, key) => vars[key] ?? '')
    .replace(/\{\{(\w+)\}\}/g, (_, key) => escapeHtml(vars[key] ?? ''));
}

/**
 * Subject-line substitution. A subject is a plain-text mail header, never HTML,
 * so escaping is actively wrong there — it renders literally in the inbox
 * ("JJ&#39;s Pie Co"). Any business name with an apostrophe or ampersand hits
 * this, so subjects interpolate raw.
 *
 * Newlines and control characters ARE stripped: those are the only genuine
 * hazard in a header (folding / injection), and escapeHtml never removed them,
 * so this is strictly safer than the escaped version it replaces.
 */
function interpolateText(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) =>
    (vars[key] ?? '')
      .replace(/[\u0000-\u001f\u007f]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  );
}

// ---------------------------------------------------------------------------
// Email shell — table-based layout for cross-client compatibility (Gmail,
// Apple Mail, Outlook). All styles inline; no <style> blocks or web fonts.
// ---------------------------------------------------------------------------
function shell(content: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#18181b;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f4f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background-color:#ffffff;border-radius:10px;border:1px solid #e4e4e7;overflow:hidden;">
          <tr>
            <td style="padding:28px 40px;border-bottom:1px solid #e4e4e7;">
              <div style="font-size:18px;font-weight:600;color:#18181b;letter-spacing:-0.01em;">StoopCraft</div>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 40px;font-size:15px;line-height:1.6;color:#3f3f46;">
              ${content}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 40px;background-color:#fafafa;border-top:1px solid #e4e4e7;font-size:13px;line-height:1.5;color:#71717a;text-align:center;">
              StoopCraft — websites for local businesses
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// Primary CTA button. Use {{url}} interpolation in templates rather than
// inline values so URL-escaping happens via interpolate().
function button(label: string, urlPlaceholder: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
    <tr>
      <td style="border-radius:6px;background-color:#18181b;">
        <a href="${urlPlaceholder}" style="display:inline-block;padding:12px 22px;font-size:15px;font-weight:500;color:#ffffff;text-decoration:none;border-radius:6px;">${label}</a>
      </td>
    </tr>
  </table>`;
}

const TEMPLATES: Record<EmailTemplate, TemplateDefinition> = {
  welcome: {
    subject: (vars) => interpolateText('Your {{business_name}} site is live', vars),
    html: (vars) => shell(interpolate(`
      <h1 style="margin:0 0 16px 0;font-size:22px;font-weight:600;color:#18181b;letter-spacing:-0.01em;">Your site is live</h1>
      <p style="margin:0 0 16px 0;">Hi there,</p>
      <p style="margin:0 0 16px 0;">Your website for <strong>{{business_name}}</strong> is now live at <a href="{{site_url}}" style="color:#2563eb;text-decoration:underline;">{{site_url}}</a>.</p>
      <p style="margin:0 0 8px 0;">Log in to your customer portal any time to preview your site, request changes, or manage billing.</p>
      ${button('Open your portal', '{{portal_url}}')}
      <p style="margin:24px 0 0 0;color:#71717a;">Thanks for being a customer.<br>— The StoopCraft team</p>
    `, vars)),
  },

  // Sent automatically by the Stripe webhook the moment payment lands.
  // Two copy variants in one template — chosen by {{domain_choice}}:
  //   'have' — customer is bringing an existing domain, needs to point
  //            DNS at us before the welcome email follows
  //   'need' — customer wants us to register a new domain on their behalf
  //            (manual step on the operator side, takes ~15 min)
  // The webhook substitutes the right block; we don't render both.
  provisioning_started: {
    subject: (vars) => interpolateText('Payment received — finalizing {{business_name}}', vars),
    html: (vars) => {
      const isHave = vars['domain_choice'] === 'have';
      const body = isHave
        ? `
          <p style="margin:0 0 16px 0;">Thanks for choosing StoopCraft. Your subscription is active and your site
          for <strong>{{business_name}}</strong> is being prepared at <strong>{{requested_domain}}</strong>.</p>
          <p style="margin:0 0 16px 0;">Since you're bringing your own domain, we'll email you within 15 minutes
          with the exact DNS records to set at your current registrar (Namecheap, GoDaddy, etc.). Once you've
          added them, your site goes live automatically.</p>
          <p style="margin:0 0 8px 0;">In the meantime, your site is already live at the temporary URL below
          so you can share it with your team:</p>
          ${button('See my site', '{{temp_site_url}}')}
        `
        : `
          <p style="margin:0 0 16px 0;">Thanks for choosing StoopCraft. Your subscription is active and we're
          registering <strong>{{requested_domain}}</strong> for <strong>{{business_name}}</strong> now.</p>
          <p style="margin:0 0 16px 0;">Your new domain will be live within about 15 minutes. We'll email you
          the moment it's pointing at your site.</p>
          <p style="margin:0 0 8px 0;">In the meantime, your site is already live at the temporary URL below
          so you can share it with your team:</p>
          ${button('See my site', '{{temp_site_url}}')}
        `;
      return shell(interpolate(`
        <h1 style="margin:0 0 16px 0;font-size:22px;font-weight:600;color:#18181b;letter-spacing:-0.01em;">Payment received</h1>
        <p style="margin:0 0 16px 0;">Hi there,</p>
        ${body}
        <p style="margin:24px 0 0 0;color:#71717a;">Reply to this email if you have any questions.<br>— The StoopCraft team</p>
      `, vars));
    },
  },

  payment_failed: {
    subject: () => 'Payment failed — action required',
    html: (vars) => shell(interpolate(`
      <h1 style="margin:0 0 16px 0;font-size:22px;font-weight:600;color:#18181b;letter-spacing:-0.01em;">Payment failed</h1>
      <p style="margin:0 0 16px 0;">Hi,</p>
      <p style="margin:0 0 16px 0;">We were unable to process your payment for <strong>{{business_name}}</strong>.</p>
      <p style="margin:0 0 8px 0;">Stripe will retry automatically over the next 14 days. To avoid any interruption to your site, please update your payment method:</p>
      ${button('Update payment method', '{{billing_url}}')}
      <p style="margin:24px 0 0 0;color:#71717a;">If you have questions, just reply to this email.<br>— The StoopCraft team</p>
    `, vars)),
  },

  cancellation_confirmation: {
    subject: () => 'Your subscription has been cancelled',
    html: (vars) => shell(interpolate(`
      <h1 style="margin:0 0 16px 0;font-size:22px;font-weight:600;color:#18181b;letter-spacing:-0.01em;">Subscription cancelled</h1>
      <p style="margin:0 0 16px 0;">Hi,</p>
      <p style="margin:0 0 16px 0;">We're sorry to see you go. Here's what happens next for <strong>{{business_name}}</strong>:</p>
      <ul style="margin:0 0 16px 0;padding-left:20px;">
        <li style="margin-bottom:6px;">Your subscription continues until <strong>{{expires_at}}</strong></li>
        <li style="margin-bottom:6px;">After that, your site will go offline</li>
        <li style="margin-bottom:6px;">You can re-subscribe within 60 days to restore everything instantly</li>
        <li>After <strong>{{hard_delete_at}}</strong>, all data will be permanently deleted</li>
      </ul>
      <p style="margin:0 0 8px 0;">If you change your mind, you can reactivate any time:</p>
      ${button('Reactivate my site', '{{reactivation_url}}')}
      <p style="margin:24px 0 0 0;color:#71717a;">Want your content exported? Reply with "EXPORT" and we'll send it.<br>— The StoopCraft team</p>
    `, vars)),
  },

  contact_form_lead: {
    subject: (vars) => interpolateText('New website lead — {{name}}', vars),
    html: (vars) => shell(interpolate(`
      <h1 style="margin:0 0 16px 0;font-size:22px;font-weight:600;color:#18181b;letter-spacing:-0.01em;">New lead from your website</h1>
      <p style="margin:0 0 20px 0;">Someone submitted their details through your <strong>{{business_name}}</strong> website. Here's what they entered:</p>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;font-size:14px;border:1px solid #e4e4e7;border-radius:6px;overflow:hidden;">
        <tr>
          <td style="width:80px;padding:12px 16px;background-color:#fafafa;font-weight:600;color:#52525b;border-bottom:1px solid #e4e4e7;vertical-align:top;">Name</td>
          <td style="padding:12px 16px;border-bottom:1px solid #e4e4e7;color:#18181b;">{{name}}</td>
        </tr>
        {{{email_row_html}}}
        {{{phone_row_html}}}
        <tr>
          <td style="padding:12px 16px;background-color:#fafafa;font-weight:600;color:#52525b;vertical-align:top;">Message</td>
          <td style="padding:12px 16px;color:#18181b;white-space:pre-wrap;">{{message}}</td>
        </tr>
      </table>
    `, vars)),
  },

  request_submitted: {
    subject: (vars) => interpolateText('We got your request — {{business_name}}', vars),
    html: (vars) => shell(interpolate(`
      <h1 style="margin:0 0 16px 0;font-size:22px;font-weight:600;color:#18181b;letter-spacing:-0.01em;">Request received</h1>
      <p style="margin:0 0 16px 0;">Hi,</p>
      <p style="margin:0 0 12px 0;">We received your change request for <strong>{{business_name}}</strong>. Here's what you submitted:</p>
      <blockquote style="border-left:3px solid #e4e4e7;margin:0 0 20px 0;padding:8px 16px;color:#52525b;white-space:pre-wrap;">{{body}}</blockquote>
      <p style="margin:0 0 8px 0;">We'll get started within your plan's response time and let you know when it's done. You can also track this request in your portal.</p>
      ${button('Open your portal', '{{portal_url}}')}
      <p style="margin:24px 0 0 0;color:#71717a;">— The StoopCraft team</p>
    `, vars)),
  },

  request_status_updated: {
    subject: (vars) => interpolateText('Your request update — {{business_name}}', vars),
    html: (vars) => shell(interpolate(`
      <h1 style="margin:0 0 16px 0;font-size:22px;font-weight:600;color:#18181b;letter-spacing:-0.01em;">Request update</h1>
      <p style="margin:0 0 16px 0;">Hi,</p>
      <p style="margin:0 0 16px 0;">There's an update on your change request for <strong>{{business_name}}</strong>.</p>
      <div style="margin:0 0 16px 0;padding:12px 16px;background-color:#f4f4f5;border-radius:6px;">
        <strong style="color:#18181b;">Status:</strong> <span style="color:#3f3f46;">{{status_label}}</span>
      </div>
      <blockquote style="border-left:3px solid #e4e4e7;margin:0 0 16px 0;padding:8px 16px;color:#52525b;white-space:pre-wrap;">{{body}}</blockquote>
      {{{resolution_note_html}}}
      ${button('Open your portal', '{{portal_url}}')}
      <p style="margin:24px 0 0 0;color:#71717a;">— The StoopCraft team</p>
    `, vars)),
  },

  request_resolved: {
    subject: (vars) => interpolateText('Your change is live — {{business_name}}', vars),
    html: (vars) => shell(interpolate(`
      <h1 style="margin:0 0 16px 0;font-size:22px;font-weight:600;color:#18181b;letter-spacing:-0.01em;">Your change is live</h1>
      <p style="margin:0 0 16px 0;">Hi,</p>
      <p style="margin:0 0 16px 0;">Your change request for <strong>{{business_name}}</strong> has been completed and pushed live.</p>
      {{{resolution_note_html}}}
      <p style="margin:0 0 8px 0;">Take a look:</p>
      ${button('Preview your site', '{{site_url}}')}
      <p style="margin:24px 0 0 0;color:#71717a;">If anything looks off, just reply to this email.<br>— The StoopCraft team</p>
    `, vars)),
  },

  monthly_report: {
    subject: (vars) => interpolateText('Your {{month}} site report — {{business_name}}', vars),
    html: (vars) => shell(interpolate(`
      <h1 style="margin:0 0 16px 0;font-size:22px;font-weight:600;color:#18181b;letter-spacing:-0.01em;">{{month}} report</h1>
      <p style="margin:0 0 20px 0;">Here's your monthly summary for <strong>{{business_name}}</strong>.</p>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;border:1px solid #e4e4e7;border-radius:6px;overflow:hidden;">
        <tr>
          <td style="padding:14px 16px;border-bottom:1px solid #e4e4e7;color:#52525b;">Page views</td>
          <td style="padding:14px 16px;border-bottom:1px solid #e4e4e7;color:#18181b;font-weight:600;text-align:right;">{{page_views}}</td>
        </tr>
        <tr>
          <td style="padding:14px 16px;border-bottom:1px solid #e4e4e7;color:#52525b;">Contact form clicks</td>
          <td style="padding:14px 16px;border-bottom:1px solid #e4e4e7;color:#18181b;font-weight:600;text-align:right;">{{contact_clicks}}</td>
        </tr>
        <tr>
          <td style="padding:14px 16px;color:#52525b;">Booking clicks</td>
          <td style="padding:14px 16px;color:#18181b;font-weight:600;text-align:right;">{{booking_clicks}}</td>
        </tr>
      </table>
      ${button('View your portal', '{{portal_url}}')}
      <p style="margin:24px 0 0 0;color:#71717a;">— The StoopCraft team</p>
    `, vars)),
  },

  // Google Search Console performance report. Every {{{block}}} is pre-rendered
  // HTML built by lib/gsc/email.ts — the sections are variable-length (and some
  // are omitted entirely when there's no data), which this string-substitution
  // templating can't express on its own.
  seo_report: {
    subject: (vars) => interpolateText('Google search report — {{business_name}}', vars),
    html: (vars) => shell(interpolate(`
      <h1 style="margin:0 0 6px 0;font-size:22px;font-weight:600;color:#18181b;letter-spacing:-0.01em;">How you're doing on Google</h1>
      <p style="margin:0 0 24px 0;color:#71717a;font-size:14px;">{{business_name}} · {{range_label}}</p>
      {{{summary_html}}}
      {{{trend_html}}}
      {{{funnel_html}}}
      {{{queries_html}}}
      {{{new_queries_html}}}
      {{{striking_html}}}
      {{{pages_html}}}
      <p style="margin:28px 0 0 0;color:#71717a;font-size:14px;">Questions about any of this? Just reply to this email.<br>— The StoopCraft team</p>
    `, vars)),
  },

  reactivation_reminder_30: {
    subject: (vars) => interpolateText('Your {{business_name}} site is preserved — reactivate any time', vars),
    html: (vars) => shell(interpolate(`
      <h1 style="margin:0 0 16px 0;font-size:22px;font-weight:600;color:#18181b;letter-spacing:-0.01em;">Your site is preserved</h1>
      <p style="margin:0 0 16px 0;">Hi,</p>
      <p style="margin:0 0 16px 0;">Just a reminder: your website for <strong>{{business_name}}</strong> is preserved until <strong>{{hard_delete_at}}</strong> (60 days from cancellation).</p>
      <p style="margin:0 0 8px 0;">If you'd like to bring it back, click below — everything will be restored instantly:</p>
      ${button('Reactivate my site', '{{reactivation_url}}')}
      <p style="margin:24px 0 0 0;color:#71717a;">— The StoopCraft team</p>
    `, vars)),
  },

  reactivation_reminder_55: {
    subject: (vars) => interpolateText('Final reminder: {{business_name}} site will be deleted soon', vars),
    html: (vars) => shell(interpolate(`
      <h1 style="margin:0 0 16px 0;font-size:22px;font-weight:600;color:#b91c1c;letter-spacing:-0.01em;">Final reminder</h1>
      <p style="margin:0 0 16px 0;">Hi,</p>
      <p style="margin:0 0 16px 0;">This is your last chance: your website data for <strong>{{business_name}}</strong> will be permanently deleted on <strong>{{hard_delete_at}}</strong>.</p>
      <p style="margin:0 0 8px 0;">Reactivate now to keep everything:</p>
      ${button('Reactivate my site', '{{reactivation_url}}')}
      <p style="margin:24px 0 0 0;color:#71717a;">If you'd rather take your content with you, reply with "EXPORT".<br>— The StoopCraft team</p>
    `, vars)),
  },

  // Sent on first signup to an affiliate (auto-active, lands on dashboard
  // immediately) AND when admin approves a pending sales rep (status flips
  // pending→active). Single template that adapts copy via {{kind_label}}.
  //
  // Variables:
  //   kind_label       — 'affiliate' | 'sales rep'
  //   program_label    — 'affiliate program' | 'sales rep program'
  //   commission_pct   — '30', '50', etc.
  //   ref_link         — full https://platform/r/<code>
  //   dashboard_url    — full https://platform/reps
  //   login_url        — full https://platform/{affiliates,reps}/login
  //   guide_url        — full https://platform/{affiliates,sales-reps}
  rep_welcome_active: {
    subject: (vars) => interpolateText("You're in — your {{program_label}} dashboard is live", vars),
    html: (vars) => shell(interpolate(`
      <h1 style="margin:0 0 16px 0;font-size:22px;font-weight:600;color:#18181b;letter-spacing:-0.01em;">Welcome aboard</h1>
      <p style="margin:0 0 16px 0;">Your StoopCraft {{program_label}} account is active. You earn <strong>{{commission_pct}}%</strong> recurring on every customer who signs up through your link, for as long as they keep paying.</p>

      <p style="margin:24px 0 8px 0;font-weight:600;color:#18181b;">Your referral link</p>
      <p style="margin:0 0 16px 0;"><a href="{{ref_link}}" style="color:#2563eb;text-decoration:underline;word-break:break-all;">{{ref_link}}</a></p>
      <p style="margin:0 0 16px 0;color:#71717a;font-size:14px;">Anyone who clicks it gets attributed to you for 30 days. Share it anywhere.</p>

      ${button('Open my dashboard', '{{dashboard_url}}')}

      <p style="margin:24px 0 8px 0;font-weight:600;color:#18181b;">Bookmark these</p>
      <ul style="margin:0 0 16px 0;padding-left:20px;color:#3f3f46;">
        <li style="margin-bottom:6px;">Dashboard: <a href="{{dashboard_url}}" style="color:#2563eb;">{{dashboard_url}}</a></li>
        <li style="margin-bottom:6px;">Sign in next time: <a href="{{login_url}}" style="color:#2563eb;">{{login_url}}</a></li>
        <li style="margin-bottom:6px;">Program guide: <a href="{{guide_url}}" style="color:#2563eb;">{{guide_url}}</a></li>
      </ul>

      <p style="margin:0 0 16px 0;color:#71717a;font-size:14px;">Need help? Reply to this email.</p>
      <p style="margin:24px 0 0 0;color:#71717a;">— The StoopCraft team</p>
    `, vars)),
  },

  // Sent on first signup to a sales rep (kind='rep'). They're in 'pending'
  // status until admin approves from /admin/reps. This email sets that
  // expectation and points them at the public guide so they can study while
  // they wait.
  rep_welcome_pending: {
    subject: () => 'Sales rep application received',
    html: (vars) => shell(interpolate(`
      <h1 style="margin:0 0 16px 0;font-size:22px;font-weight:600;color:#18181b;letter-spacing:-0.01em;">Got your application</h1>
      <p style="margin:0 0 16px 0;">Thanks for signing up for the StoopCraft sales rep program. Your account is created and pending approval.</p>
      <p style="margin:0 0 16px 0;">We&rsquo;ll review and approve within a day or two. You&rsquo;ll get another email the moment your dashboard unlocks — that one has your referral link and full instructions.</p>

      <p style="margin:0 0 8px 0;">In the meantime, read the program guide so you&rsquo;re ready to start as soon as you&rsquo;re approved:</p>
      ${button('Read the guide', '{{guide_url}}')}

      <p style="margin:0 0 16px 0;color:#71717a;font-size:14px;">Need help? Reply to this email.</p>
      <p style="margin:24px 0 0 0;color:#71717a;">— The StoopCraft team</p>
    `, vars)),
  },

  // Sent from /api/save-preview when an unclaimed visitor hits "Save for
  // later" on the landing page. The restore_url drops them back into the
  // landing page with the iframe + claim form pre-populated.
  preview_saved: {
    subject: (vars) => interpolateText('Your preview of {{business_name}} — saved for later', vars),
    html: (vars) => shell(interpolate(`
      <h1 style="margin:0 0 16px 0;font-size:22px;font-weight:600;color:#18181b;letter-spacing:-0.01em;">Your preview is saved</h1>
      <p style="margin:0 0 16px 0;">Hi there,</p>
      <p style="margin:0 0 16px 0;">Here's the link to the site we generated for <strong>{{business_name}}</strong>. Click below to pick up where you left off:</p>
      ${button('Open my preview', '{{restore_url}}')}
      <p style="margin:0 0 16px 0;">When you're ready to make it real, finish checkout from that page — <strong>${PRICING.starter.label}</strong>, no setup fee, cancel anytime.</p>
      <p style="margin:24px 0 0 0;color:#71717a;">Save this email — the link is unique to your preview.<br>— The StoopCraft team</p>
    `, vars)),
  },
};

export function renderTemplate(
  template: EmailTemplate,
  variables: Record<string, string>
): { subject: string; html: string } {
  const def = TEMPLATES[template];
  return {
    subject: def.subject(variables),
    html: def.html(variables),
  };
}

// ---------------------------------------------------------------------------
// Manual admin emails — free-composed plain text (subject + body) wrapped in
// the same branded shell as every transactional email. The body is fully
// escaped, so nothing the admin types can inject markup: blank lines become
// paragraph breaks, single newlines become <br>.
// ---------------------------------------------------------------------------
export function renderManualEmail(bodyText: string): string {
  const paragraphs = bodyText
    .replace(/\r\n/g, '\n')
    .split(/\n\s*\n/)
    .map((para) => para.trim())
    .filter(Boolean)
    .map(
      (para) =>
        `<p style="margin:0 0 16px 0;">${escapeHtml(para).replace(/\n/g, '<br>')}</p>`
    )
    .join('');

  return shell(paragraphs || '<p style="margin:0;"></p>');
}
