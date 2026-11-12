import type { SectionProps } from '../types';

// ============================================================================
// TrustBar — manufacturer / association badges strip between hero and services.
//
// Generic placeholder labels for now. When the editor exposes a `content.trust_badges`
// array, we'll read from there per-client. Until then the labels are the
// industry-standard set for the contractor space — present enough to feel
// credible without claiming certifications the client doesn't actually have.
// Admins can hide the section from the editor on day one if any label
// misrepresents the business.
// ============================================================================

const PLACEHOLDER_BADGES = [
  'Licensed & Insured',
  'BBB Accredited',
  '24/7 Service',
  'Free Estimates',
  'Satisfaction Guaranteed',
];

export function TrustBar(_props: SectionProps) {
  return (
    <section
      id="trust"
      className="dfy-section dfy-trust-bar"
      style={{
        background: 'var(--section-bg, color-mix(in srgb, var(--color-text) 4%, transparent))',
        borderTop: '1px solid color-mix(in srgb, var(--color-text) 10%, transparent)',
        borderBottom: '1px solid color-mix(in srgb, var(--color-text) 10%, transparent)',
      }}
    >
      <div
        style={{
          maxWidth: '1240px',
          margin: '0 auto',
          padding: '1.75rem 1.5rem',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '1rem 2.5rem',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.8rem',
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          fontWeight: 600,
          color: 'color-mix(in srgb, var(--color-text) 60%, transparent)',
        }}
      >
        {PLACEHOLDER_BADGES.map((label, i) => (
          <span key={label} style={{ display: 'inline-flex', alignItems: 'center', gap: '2.5rem' }}>
            {label}
            {i < PLACEHOLDER_BADGES.length - 1 && (
              <span
                aria-hidden="true"
                style={{
                  width: '4px',
                  height: '4px',
                  borderRadius: '50%',
                  background: 'color-mix(in srgb, var(--color-text) 25%, transparent)',
                }}
                className="dfy-trust-bar__dot"
              />
            )}
          </span>
        ))}
      </div>
    </section>
  );
}
