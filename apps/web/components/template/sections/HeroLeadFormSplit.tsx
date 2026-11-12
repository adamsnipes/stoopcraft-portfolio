import type { SectionProps } from '../types';
import { renderEmphasized } from '../emphasis';
import { parseTheme } from '@/lib/tenant';
import { LeadForm } from './LeadForm';

// ============================================================================
// Hero composition: lead-form-split
//
// Trades-vertical signature hero. Two-column on desktop:
//   left  — slate/photo background, copy + dual CTAs (Get Estimate + Call)
//   right — white LeadForm card, raised above the hero with shadow
// Stacks to a single column on mobile, form moves below the CTAs.
//
// Conversion-critical layout: the form is "above the fold" on most viewports,
// the hero photo (when present) sits behind a heavy gradient so headline + CTA
// read clearly, and both call-to-action paths (form submit OR tel:) are
// always one tap away.
// ============================================================================

export function HeroLeadFormSplit(props: SectionProps) {
  const theme = parseTheme(props.content.theme);
  const photo = props.photos[0];
  const r2 = process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? '';
  const photoUrl = photo ? `${r2}/${photo.r2_key}` : null;
  const phone = props.client.phone;
  const headline = props.content.hero_headline ?? props.client.business_name;
  const emphasis = props.content.hero_headline_emphasis ?? null;
  const subheadline = props.content.hero_subheadline ?? '';
  const ctaText = props.content.hero_cta_text ?? 'Get my free estimate';

  return (
    <section
      id="home"
      className="dfy-hero dfy-hero--lead-form-split"
      style={{
        position: 'relative',
        overflow: 'hidden',
        background: photoUrl ? '#0f172a' : 'var(--color-primary, #0f172a)',
        color: '#ffffff',
      }}
    >
      {photoUrl && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute', inset: 0,
            backgroundImage: `url("${photoUrl}")`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            opacity: 0.4,
          }}
        />
      )}
      {/* Left-to-right gradient that keeps the copy column readable while
          letting the photo breathe on the right side behind the form card. */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute', inset: 0,
          background:
            'linear-gradient(90deg, var(--color-primary, #0f172a) 0%, color-mix(in srgb, var(--color-primary, #0f172a) 92%, transparent) 35%, color-mix(in srgb, var(--color-primary, #0f172a) 40%, transparent) 100%)',
        }}
      />

      <div className="dfy-hero__inner" style={inner}>
        <div className="dfy-hero__copy" style={copyCol}>
          <RatingBadge />
          <h1
            style={{
              fontFamily: theme.fontHeading
                ? `var(--font-heading, ${theme.fontHeading})`
                : 'var(--font-heading)',
              fontSize: 'clamp(2.25rem, 5.5vw, 4rem)',
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: '-0.025em',
              margin: '1.5rem 0 0',
            }}
          >
            {emphasis ? renderEmphasized(headline, emphasis, { accentColor: true }) : headline}
          </h1>
          <p style={subStyle}>{subheadline}</p>

          <div style={ctaRow}>
            <a href="#lead-form" style={primaryBtn}>{ctaText}</a>
            {phone && (
              <a href={`tel:${phone}`} style={secondaryBtn}>
                <PhoneIcon /> {phone}
              </a>
            )}
          </div>

          <StatsRow client={props.client} />
        </div>

        <div id="lead-form" className="dfy-hero__form" style={formCol}>
          <LeadForm />
        </div>
      </div>

      {/* Layout breakpoints. iPad-landscape (≤1100px) collapses to single
          column to avoid a cramped 2-col where the form overpowers the copy.
          Phone (≤640px) also tightens form padding so it doesn't dominate. */}
      <style>{`
        @media (max-width: 1100px) {
          .dfy-hero--lead-form-split .dfy-hero__inner {
            grid-template-columns: 1fr !important;
            gap: 2.5rem !important;
            padding-top: 3.5rem !important;
            padding-bottom: 3.5rem !important;
          }
          .dfy-hero--lead-form-split .dfy-hero__form {
            padding-left: 0 !important;
            justify-content: flex-start !important;
          }
          .dfy-hero--lead-form-split .dfy-hero__form .dfy-leadform {
            max-width: 100% !important;
          }
        }
        @media (max-width: 640px) {
          .dfy-hero--lead-form-split .dfy-hero__inner {
            padding-left: 1.25rem !important;
            padding-right: 1.25rem !important;
          }
        }
      `}</style>
    </section>
  );
}

// ── Subcomponents ──────────────────────────────────────────────────────────

function RatingBadge() {
  // TODO(google-reviews): swap to real client.google_rating / review_count
  // once Place Details Pro fields (rating, userRatingCount) are wired in.
  // See lib/places/index.ts FIELD_MASK — currently excluded for cost reasons.
  return (
    <div style={ratingBadge}>
      <StarIcon /> 4.9 / 5 · Local homeowners&apos; pick
    </div>
  );
}

function StatsRow({ client }: { client: SectionProps['client'] }) {
  // Stats sourced from data we have, with sensible fallbacks. Year-founded,
  // service area, and BBB rating are common levers in this vertical;
  // hardcoding them is acceptable until we add admin fields for each.
  const city = client.city ?? 'your area';
  return (
    <div style={statsRow}>
      <Stat label="Free" sub="Estimates" />
      <Stat label="Same-day" sub="Response" />
      <Stat label={city} sub="Serving" />
    </div>
  );
}

function Stat({ label, sub }: { label: string; sub: string }) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={statBig}>{label}</div>
      <div style={statSub}>{sub}</div>
    </div>
  );
}

function StarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384" />
    </svg>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const inner: React.CSSProperties = {
  position: 'relative',
  zIndex: 2,
  maxWidth: '1240px',
  margin: '0 auto',
  padding: '5rem 1.5rem',
  display: 'grid',
  // Slightly tighter columns + flex-start alignment: when the form is taller
  // than the copy block (always, on desktop), the form extends DOWN instead
  // of being center-aligned and bleeding up above the headline area.
  gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 0.9fr)',
  gap: '4rem',
  alignItems: 'start',
};
const copyCol: React.CSSProperties = { display: 'flex', flexDirection: 'column' };
const formCol: React.CSSProperties = { display: 'flex', justifyContent: 'flex-end', paddingLeft: '2rem' };

const ratingBadge: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
  alignSelf: 'flex-start',
  padding: '0.35rem 0.85rem',
  border: '1px solid color-mix(in srgb, var(--color-accent) 35%, transparent)',
  background: 'color-mix(in srgb, var(--color-accent) 12%, transparent)',
  color: 'color-mix(in srgb, var(--color-accent) 90%, white)',
  borderRadius: '999px',
  fontSize: '0.72rem',
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  fontWeight: 600,
};
const subStyle: React.CSSProperties = {
  marginTop: '1.5rem',
  fontSize: '1.1rem',
  lineHeight: 1.55,
  color: 'rgba(255,255,255,0.78)',
  maxWidth: '34rem',
};
const ctaRow: React.CSSProperties = {
  marginTop: '2rem',
  display: 'flex',
  flexWrap: 'wrap',
  gap: '0.75rem',
};
const primaryBtn: React.CSSProperties = {
  background: 'var(--color-accent)',
  color: '#ffffff',
  padding: '0.95rem 1.5rem',
  borderRadius: '0.5rem',
  fontSize: '1rem',
  fontWeight: 600,
  textDecoration: 'none',
  boxShadow: '0 10px 24px -10px color-mix(in srgb, var(--color-accent) 60%, transparent)',
};
const secondaryBtn: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.5rem',
  border: '1px solid rgba(255,255,255,0.35)',
  background: 'rgba(255,255,255,0.05)',
  color: '#ffffff',
  padding: '0.95rem 1.5rem',
  borderRadius: '0.5rem',
  fontSize: '1rem',
  fontWeight: 600,
  textDecoration: 'none',
  backdropFilter: 'blur(8px)',
};
const statsRow: React.CSSProperties = {
  marginTop: '2.5rem',
  display: 'flex',
  gap: '1.5rem',
  borderTop: '1px solid rgba(255,255,255,0.12)',
  paddingTop: '1.5rem',
};
const statBig: React.CSSProperties = {
  fontSize: '1.5rem', fontWeight: 700, color: '#ffffff', lineHeight: 1.1,
};
const statSub: React.CSSProperties = {
  marginTop: '0.25rem',
  fontSize: '0.7rem', letterSpacing: '0.12em', textTransform: 'uppercase',
  color: 'rgba(255,255,255,0.5)',
};
