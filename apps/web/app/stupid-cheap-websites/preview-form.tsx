'use client';

import { useId, useRef, useState, type FormEvent } from 'react';
import posthog from 'posthog-js';
import { CHEAP_BRAND } from '@/lib/marketing-brand';
import { trackPixel } from '@/lib/fbq';
import { trackLeadConversion } from '@/lib/gtag';
import styles from './page.module.css';

export function PreviewForm({ location = 'footer', compact = false }: { location?: 'hero' | 'footer'; compact?: boolean }) {
  const uid = useId();
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const pending = useRef(false);
  const successRef = useRef<HTMLDivElement>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    pending.current = true;
    setStatus('sending');
    const form = event.currentTarget;
    const fields = Object.fromEntries(new FormData(form).entries());
    try {
      const eventId = crypto.randomUUID();
      const response = await fetch('/api/agency-inquiry', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...fields, brand: CHEAP_BRAND.id, event_id: eventId }),
      });
      if (!response.ok) throw new Error('Unable to send');
      // Tracking must never turn a successfully accepted inquiry into a retry.
      try {
        trackPixel('Lead', { content_name: CHEAP_BRAND.name }, { eventID: eventId });
        trackLeadConversion();
        if (posthog.__loaded) posthog.capture('apply_form_submitted', { brand: CHEAP_BRAND.id, monthly_offer: CHEAP_BRAND.monthly, form_location: location });
      } catch { /* Lead is already accepted. */ }
      form.reset();
      setStatus('success');
      requestAnimationFrame(() => successRef.current?.focus());
    } catch {
      setStatus('error');
    } finally {
      pending.current = false;
    }
  }

  if (status === 'success') return <div ref={successRef} className={`${styles.form} ${styles.success}`} role="status" tabIndex={-1}><span aria-hidden="true">✓</span><h3>You’re on the list.</h3><p>We’ve received your details. Our team will follow up by email about your free website preview.</p><strong>Nothing to pay unless you choose to launch.</strong></div>;

  return <form className={styles.form} onSubmit={submit} aria-label={`Request a free website preview (${location})`} data-form-location={location} aria-busy={status === 'sending'}>
    <h3>{compact ? 'Get your free website preview' : 'Let’s see what we can make you.'}</h3>
    <p className={styles.formIntro}>{compact ? 'Tell us the basics. We’ll handle the website.' : 'A few details. Then we take it from here.'}</p>
    {compact && <p className={styles.heroFormOffer}><strong>$0 to preview.</strong> ${CHEAP_BRAND.monthly}/month only if you launch.</p>}
    <div className={styles.honeypot} aria-hidden="true"><label htmlFor={`${uid}-company`}>Company site</label><input id={`${uid}-company`} name="company_site" tabIndex={-1} autoComplete="off" maxLength={200} /></div>
    <label htmlFor={`${uid}-business`}>Business name<input id={`${uid}-business`} name="business_name" autoComplete="organization" placeholder="Your business name" maxLength={120} required disabled={status === 'sending'} /></label>
    {!compact && <label htmlFor={`${uid}-type`}>What do you do?<select id={`${uid}-type`} name="need" defaultValue="" required disabled={status === 'sending'}><option value="" disabled>Choose your type of business</option>{['Home services & trades', 'Landscaping & lawn care', 'Cleaning services', 'Food, catering & events', 'Health, beauty & wellness', 'Professional services', 'Church or nonprofit', 'Something else'].map(t => <option key={t}>{t}</option>)}</select></label>}
    <label htmlFor={`${uid}-name`}>Your name<input id={`${uid}-name`} name="name" autoComplete="name" placeholder="Jane Smith" maxLength={100} required disabled={status === 'sending'} /></label>
    <label htmlFor={`${uid}-email`}>Email for your preview<input id={`${uid}-email`} name="email" type="email" autoComplete="email" placeholder="you@yourbusiness.com" maxLength={120} required disabled={status === 'sending'} /></label>
    {compact ? <details className={styles.optionalPhone}><summary>Add a phone number <span>(optional)</span></summary><label htmlFor={`${uid}-phone`}>Phone<input id={`${uid}-phone`} name="phone" type="tel" autoComplete="tel" placeholder="(555) 123-4567" maxLength={40} disabled={status === 'sending'} /></label></details> : <label htmlFor={`${uid}-phone`}>Phone <span>(optional)</span><input id={`${uid}-phone`} name="phone" type="tel" autoComplete="tel" placeholder="(555) 123-4567" maxLength={40} disabled={status === 'sending'} /></label>}
    {status === 'error' && <p className={styles.error} role="alert">We couldn’t send that. Please try again. Your details are still here.</p>}
    <button className={styles.button} type="submit" disabled={status === 'sending'}>{status === 'sending' ? 'Sending your request…' : 'Make me a free preview'}<span aria-hidden="true">↗</span></button>
    <p className={styles.formFineprint}>$0 to preview. ${CHEAP_BRAND.monthly}/month only if you launch.<br />We’ll use these details to follow up on your request.<br /><a href="/privacy" target="_blank" rel="noopener">Privacy policy</a></p>
  </form>;
}
