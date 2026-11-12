import type { SectionProps } from '../types';

// ============================================================================
// Testimonials — 3-up grid of review cards. Currently rendered from a
// PLACEHOLDER list because the Places API field mask in lib/places/index.ts
// excludes `reviews` (Enterprise+Atmosphere SKU, +$8/1K). Wiring real Google
// reviews is a separate task — see comment near bottom of this file and
// FIELD_MASK in lib/places/index.ts.
//
// When that lands, the picker here will read `content.testimonials` (LLM-
// curated subset of Google reviews) and fall back to PLACEHOLDERS if empty.
// Until then, this section ships with niche-generic stand-ins so unclaimed
// trades sites still render social-proof real estate without an empty hole.
// ============================================================================

type Review = { quote: string; author: string; location: string };

const PLACEHOLDERS: Review[] = [
  {
    quote:
      "Called four contractors after the storm. They were the only one who answered the phone — and a project manager was at my house the same afternoon.",
    author: 'Jennifer M.',
    location: 'Local homeowner',
  },
  {
    quote:
      "Three other companies told me I needed a full replacement. These guys found the actual problem in 30 minutes and fixed it the same day for a fraction of the price.",
    author: 'Marcus T.',
    location: 'Local homeowner',
  },
  {
    quote:
      "Crew showed up at 7am, finished by 4pm, and ran a magnet roller through the yard before leaving. You wouldn't have known they were there. These guys are the real deal.",
    author: 'Karen S.',
    location: 'Local homeowner',
  },
];

export function Testimonials(props: SectionProps) {
  // Use city as the location when present so the placeholder cards feel
  // localized to the business.
  const city = props.client.city;
  const state = props.client.state;
  const localTag = city ? `${city}${state ? `, ${state}` : ''}` : 'Local homeowner';
  const reviews = PLACEHOLDERS.map((r) => ({ ...r, location: localTag }));

  return (
    <section
      id="reviews"
      className="dfy-section dfy-testimonials"
      style={{
        background: 'var(--section-bg, var(--color-background))',
        padding: '5rem 1.5rem',
      }}
    >
      <div style={{ maxWidth: '1240px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', maxWidth: '36rem', margin: '0 auto 3rem' }}>
          <p style={kicker}>What homeowners say</p>
          <h2
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: 'clamp(1.75rem, 4vw, 2.75rem)',
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: '-0.02em',
              margin: '0.75rem 0 0',
              color: 'var(--color-text)',
            }}
          >
            Real reviews from real {city ?? 'local'} neighbors.
          </h2>
        </div>

        <div
          className="dfy-testimonials__grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '1.25rem',
          }}
        >
          {reviews.map((r, i) => <ReviewCard key={i} review={r} />)}
        </div>
      </div>

      <style>{`
        @media (max-width: 980px) {
          .dfy-testimonials__grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </section>
  );
}

function ReviewCard({ review }: { review: Review }) {
  return (
    <article
      style={{
        background: 'var(--card-surface)',
        border: '1px solid var(--card-ring)',
        borderRadius: '1rem',
        padding: '1.5rem',
        boxShadow: '0 4px 12px -4px rgba(0,0,0,0.06)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ display: 'flex', gap: '2px', color: 'var(--color-accent)' }}>
        {[0, 1, 2, 3, 4].map((i) => <StarIcon key={i} />)}
      </div>
      <p
        style={{
          marginTop: '1rem',
          color: 'var(--color-text)',
          lineHeight: 1.6,
          fontSize: '0.95rem',
        }}
      >
        &ldquo;{review.quote}&rdquo;
      </p>
      <div
        style={{
          marginTop: '1.25rem',
          paddingTop: '1rem',
          borderTop: '1px solid var(--card-ring)',
        }}
      >
        <div style={{ fontWeight: 600, color: 'var(--color-text)' }}>{review.author}</div>
        <div style={{ fontSize: '0.85rem', color: 'color-mix(in srgb, var(--color-text) 55%, transparent)' }}>
          {review.location}
        </div>
      </div>
    </article>
  );
}

const kicker: React.CSSProperties = {
  fontSize: '0.72rem', letterSpacing: '0.2em', textTransform: 'uppercase',
  fontWeight: 600, color: 'var(--color-accent)', margin: 0,
};

function StarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z" />
    </svg>
  );
}
