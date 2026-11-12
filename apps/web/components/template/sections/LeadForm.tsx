'use client';

import { useState, useRef } from 'react';

// ============================================================================
// LeadForm — inline lead-capture form rendered in the trades hero (and
// optionally any cta_strip variant that opts into it later).
//
// Shape mirrors what the contractor template space conditions buyers to
// expect: name (first + last) / phone / email / "what's going on" notes,
// plus a honeypot. POSTs to /api/contact with source='lead_hero' so the
// requests-table row is tagged correctly and the admin notification email
// renders the right template.
//
// Submission contract — kept in sync with apps/web/app/api/contact/route.ts:
//   { name, phone?, email?, message?, source: 'lead_hero', website? (honeypot) }
// ============================================================================

export function LeadForm() {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus('sending');
    const form = e.currentTarget;
    const fd = new FormData(form);
    const firstName = String(fd.get('firstName') ?? '').trim();
    const lastName = String(fd.get('lastName') ?? '').trim();
    const phone = String(fd.get('phone') ?? '').trim();
    const email = String(fd.get('email') ?? '').trim();
    const notes = String(fd.get('notes') ?? '').trim();
    const website = String(fd.get('website') ?? '');

    const payload = {
      name: [firstName, lastName].filter(Boolean).join(' '),
      phone: phone || undefined,
      email: email || undefined,
      message: notes || undefined,
      source: 'lead_hero' as const,
      website,
    };
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setStatus('sent');
        formRef.current?.reset();
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  }

  if (status === 'sent') {
    return (
      <div className="dfy-leadform dfy-leadform--sent" style={successCard}>
        <p style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
          You&apos;re on the list.
        </p>
        <p style={{ marginTop: '0.75rem', color: '#475569', lineHeight: 1.5, margin: '0.75rem 0 0' }}>
          We&apos;ll text you within minutes to confirm the appointment.
        </p>
        <button
          onClick={() => setStatus('idle')}
          style={{
            marginTop: '1.25rem', alignSelf: 'flex-start',
            fontSize: '0.85rem', textDecoration: 'underline', textUnderlineOffset: '4px',
            background: 'transparent', border: 0, padding: 0, color: 'var(--color-accent)',
            cursor: 'pointer',
          }}
        >
          Submit another
        </button>
      </div>
    );
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="dfy-leadform" style={card}>
      <div style={headerWrap}>
        <p style={kicker}>No-cost · No-obligation</p>
        <h2 style={cardTitle}>Get your free estimate</h2>
        <p style={cardSub}>Same-day response · 100% free · No pressure</p>
      </div>

      {/* Honeypot — kept off-screen and invisible to humans; bots fill it */}
      <input
        type="text" name="website" tabIndex={-1} autoComplete="off"
        aria-hidden="true"
        style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px' }}
      />

      <div style={twoCol}>
        <Field id="lf-first" label="First name *">
          <input id="lf-first" name="firstName" type="text" required autoComplete="given-name" placeholder="John" style={inputStyle} />
        </Field>
        <Field id="lf-last" label="Last name">
          <input id="lf-last" name="lastName" type="text" autoComplete="family-name" placeholder="Smith" style={inputStyle} />
        </Field>
      </div>

      <Field id="lf-phone" label="Phone number *" help="We'll text you to confirm your appointment within minutes.">
        <input id="lf-phone" name="phone" type="tel" required autoComplete="tel" placeholder="(555) 123-4567" style={inputStyle} />
      </Field>

      <Field id="lf-email" label="Email" hint="(optional)">
        <input id="lf-email" name="email" type="email" autoComplete="email" placeholder="john@example.com" style={inputStyle} />
      </Field>

      <Field id="lf-notes" label="What's going on?" hint="(optional)">
        <textarea
          id="lf-notes" name="notes" rows={3}
          placeholder="e.g. Hail damage from last week's storm — insurance adjuster coming Friday and I need an estimate before then."
          style={{ ...inputStyle, minHeight: '5rem', resize: 'vertical', fontFamily: 'inherit' }}
        />
      </Field>

      <button type="submit" disabled={status === 'sending'} style={submitBtn(status === 'sending')}>
        {status === 'sending' ? 'Sending…' : 'Get my free estimate'}
      </button>

      {status === 'error' && (
        <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#dc2626' }}>
          Something went wrong — please call us instead.
        </p>
      )}

      <p style={trustLine}>
        <ShieldIcon />
        <span>By submitting, you agree to receive a confirmation text.</span>
      </p>
    </form>
  );
}

// ── Subcomponents ──────────────────────────────────────────────────────────

function Field({
  id, label, hint, help, children,
}: {
  id: string; label: string; hint?: string; help?: string; children: React.ReactNode;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
      <label htmlFor={id} style={labelStyle}>
        {label}{hint && <span style={hintStyle}> {hint}</span>}
      </label>
      {children}
      {help && <p style={helpStyle}>{help}</p>}
    </div>
  );
}

function ShieldIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
// LeadForm is rendered against a dark/photo hero. The card itself is always
// white so form inputs read clearly regardless of hero treatment — this is
// the same pattern the reference contractor template uses.

const card: React.CSSProperties = {
  background: '#ffffff',
  color: '#0f172a',
  padding: '1.75rem',
  borderRadius: '1rem',
  boxShadow: '0 24px 48px -12px rgba(0,0,0,0.35), 0 4px 12px rgba(0,0,0,0.12)',
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem',
  width: '100%',
  maxWidth: '28rem',
  position: 'relative',
};
const successCard: React.CSSProperties = {
  ...card,
  alignItems: 'flex-start',
  textAlign: 'left',
  gap: 0,
};
const headerWrap: React.CSSProperties = { textAlign: 'center', marginBottom: '0.5rem' };
const kicker: React.CSSProperties = {
  fontSize: '0.7rem', letterSpacing: '0.15em', textTransform: 'uppercase',
  fontWeight: 700, color: 'var(--color-accent)', margin: 0,
};
const cardTitle: React.CSSProperties = {
  fontSize: '1.5rem', fontWeight: 700, margin: '0.25rem 0 0.25rem', color: '#0f172a',
};
const cardSub: React.CSSProperties = { fontSize: '0.85rem', color: '#64748b', margin: 0 };
const twoCol: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem',
};
const labelStyle: React.CSSProperties = {
  fontSize: '0.8rem', fontWeight: 500, color: '#0f172a',
};
const hintStyle: React.CSSProperties = { fontWeight: 400, color: '#64748b' };
const helpStyle: React.CSSProperties = { fontSize: '0.75rem', color: '#64748b', margin: 0 };
const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.625rem 0.75rem',
  border: '1px solid #cbd5e1',
  borderRadius: '0.5rem',
  fontSize: '0.95rem',
  color: '#0f172a',
  background: '#ffffff',
  outline: 'none',
};
const submitBtn = (sending: boolean): React.CSSProperties => ({
  background: 'var(--color-accent)',
  color: '#ffffff',
  border: 0,
  padding: '0.875rem 1rem',
  borderRadius: '0.5rem',
  fontSize: '1rem',
  fontWeight: 600,
  cursor: sending ? 'not-allowed' : 'pointer',
  opacity: sending ? 0.65 : 1,
  transition: 'opacity .15s ease',
});
const trustLine: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
  fontSize: '0.72rem', color: '#64748b', margin: 0,
};
