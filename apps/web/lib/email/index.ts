// Public API for email sending. Import from here — not from provider.ts directly.
export {
  getEmailProvider,
  sendAdminAlert,
  sendManualEmail,
  sendUnclaimedPreviewEmail,
  sendRepWelcomeEmail,
  type EmailProvider,
} from './provider';
export { type EmailTemplate, renderTemplate, renderManualEmail, escapeHtml } from './templates';
