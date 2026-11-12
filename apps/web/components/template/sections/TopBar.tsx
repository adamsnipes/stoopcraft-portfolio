import type { SectionProps } from '../types';

// ============================================================================
// TopBar — utility strip pinned above the Nav on trades clients.
//
// Left side: license/insurance trust signal. Right side: tappable phone.
// Renders nothing when there's no phone on the client (rare; we always
// collect it during Places fetch, but defensive nonetheless).
//
// Visual contract: dark slate background, light text, single-line on
// desktop, two-line on mobile. Always full-width — sits flush against the
// top of the viewport above the main Nav.
// ============================================================================

export function TopBar(props: SectionProps) {
  const phone = props.client.phone;
  if (!phone) return null;

  return (
    <section
      id="top-bar"
      className="dfy-section dfy-top-bar"
      style={{
        background: '#0f172a',
        color: '#ffffff',
        fontSize: '0.85rem',
      }}
    >
      <div
        className="dfy-top-bar__inner"
        style={{
          maxWidth: '1240px',
          margin: '0 auto',
          padding: '0.5rem 1.25rem',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.5rem 1.25rem',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
          }}
        >
          <ShieldIcon />
          Licensed &amp; Insured
        </span>
        <a
          href={`tel:${phone}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
            color: '#ffffff',
            fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          <PhoneIcon />
          {phone}
        </a>
      </div>
    </section>
  );
}

function ShieldIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ color: 'var(--color-accent)' }}>
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
function PhoneIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384" />
    </svg>
  );
}
