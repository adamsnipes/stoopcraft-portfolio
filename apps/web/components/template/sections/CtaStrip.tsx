import type { SectionProps } from '../types';

// ============================================================================
// CtaStrip — full-bleed color band near the end of the trades page. Pulls
// the eye back to action after the testimonials / gallery. Two CTAs side by
// side: primary "free estimate" (anchors to #lead-form on the hero), and a
// secondary tel: link.
// ============================================================================

export function CtaStrip(props: SectionProps) {
  const phone = props.client.phone;
  return (
    <section
      id="cta"
      className="dfy-section dfy-cta-strip"
      style={{
        background: 'var(--color-accent)',
        color: '#ffffff',
        padding: '4rem 1.5rem',
        textAlign: 'center',
      }}
    >
      <div style={{ maxWidth: '52rem', margin: '0 auto' }}>
        <h2
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: 'clamp(1.75rem, 4vw, 2.75rem)',
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: '-0.02em',
            margin: 0,
          }}
        >
          Ready for a job you can stop worrying about?
        </h2>
        <p
          style={{
            marginTop: '1rem',
            fontSize: '1.05rem',
            opacity: 0.9,
          }}
        >
          Free estimates · Same-day response · No high-pressure sales
        </p>
        <div
          style={{
            marginTop: '2rem',
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: '0.75rem',
          }}
        >
          <a
            href="#lead-form"
            style={{
              background: '#ffffff',
              color: 'var(--color-accent)',
              padding: '0.95rem 1.5rem',
              borderRadius: '0.5rem',
              fontSize: '1rem',
              fontWeight: 700,
              textDecoration: 'none',
              boxShadow: '0 10px 24px -8px rgba(0,0,0,0.25)',
            }}
          >
            Get my free estimate
          </a>
          {phone && (
            <a
              href={`tel:${phone}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                border: '1px solid rgba(255,255,255,0.5)',
                background: 'rgba(255,255,255,0.1)',
                color: '#ffffff',
                padding: '0.95rem 1.5rem',
                borderRadius: '0.5rem',
                fontSize: '1rem',
                fontWeight: 600,
                textDecoration: 'none',
                backdropFilter: 'blur(6px)',
              }}
            >
              <PhoneIcon /> {phone}
            </a>
          )}
        </div>
      </div>
    </section>
  );
}

function PhoneIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384" />
    </svg>
  );
}
