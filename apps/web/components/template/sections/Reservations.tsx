import type { SectionProps } from '../types';

// ============================================================================
// Reservations section (restaurant vertical only).
//
// Renders the official embed widget for the chosen platform when supported
// (OpenTable / Resy / Tock all allow iframe embedding via their own scripts).
// Phone falls back to a tel: link card. Walk-in renders a "no reservations
// needed" notice. Missing or unrecognized method → section returns null so
// the page just doesn't show this block.
// ============================================================================

export function Reservations(props: SectionProps) {
  const method = props.content.reservations_method;
  const url = props.content.reservations_url;
  const phone = props.client.phone;

  if (!method) return null;

  return (
    <section
      id="reservations"
      className="dfy-section dfy-reservations"
      style={{
        padding: '5rem 1.5rem',
        background: 'var(--section-bg, var(--color-background))',
      }}
    >
      <div style={{ maxWidth: '720px', margin: '0 auto', textAlign: 'center' }}>
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '0.75rem',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            opacity: 0.65,
            marginBottom: '0.75rem',
          }}
        >
          Reservations
        </p>
        <h2
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: 'clamp(1.75rem, 4vw, 2.75rem)',
            marginBottom: '2rem',
          }}
        >
          {method === 'walkin' ? 'Walk-ins welcome' : 'Reserve a table'}
        </h2>

        <ReservationsBody method={method} url={url} phone={phone} />
      </div>
    </section>
  );
}

function ReservationsBody({
  method,
  url,
  phone,
}: {
  method: string;
  url: string | null;
  phone: string | null;
}) {
  if (method === 'walkin') {
    return (
      <p style={{ fontFamily: 'var(--font-body)', opacity: 0.75, lineHeight: 1.6 }}>
        Seats are first-come, first-served — no reservations needed. Stop by during open hours.
      </p>
    );
  }

  if (method === 'phone') {
    if (!phone) return null;
    return (
      <a
        href={`tel:${phone}`}
        style={{
          display: 'inline-block',
          padding: '0.875rem 2rem',
          background: 'var(--color-accent)',
          color: 'var(--color-background)',
          fontFamily: 'var(--font-body)',
          fontWeight: 600,
          borderRadius: 'var(--radius)',
          textDecoration: 'none',
          letterSpacing: '0.05em',
        }}
      >
        Call to reserve · {phone}
      </a>
    );
  }

  if (!url) return null;

  // OpenTable / Resy / Tock — link out for now. Real embed widgets require
  // platform-specific iframe scripts that we'll add per-platform in v2.
  // External link still works fine in v1.
  const label =
    method === 'opentable' ? 'Reserve on OpenTable' :
    method === 'resy' ? 'Reserve on Resy' :
    method === 'tock' ? 'Reserve on Tock' :
    'Reserve';

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'inline-block',
        padding: '0.875rem 2rem',
        background: 'var(--color-accent)',
        color: 'var(--color-background)',
        fontFamily: 'var(--font-body)',
        fontWeight: 600,
        borderRadius: 'var(--radius)',
        textDecoration: 'none',
        letterSpacing: '0.05em',
      }}
    >
      {label}
    </a>
  );
}
