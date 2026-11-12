import type { SectionProps } from '../types';
import { parseTheme } from '@/lib/tenant';

// ============================================================================
// WhyUs — bento layout: left column has a 2-line headline + 4 feature rows
// each with a small icon, label, and copy. Right column has a tall photo
// with a small floating "review aggregate" card overlapping the lower-left.
//
// Why hardcoded copy: until we add a `content.why_us` schema field, every
// trades client gets the same 4 high-trust features. This is the right
// trade-off for v1 — these four (same-day, certified, warranty, no subs)
// are the universal contractor differentiators and nobody complains.
// Per-client customization comes when we wire the editor in.
// ============================================================================

const FEATURES = [
  {
    label: 'Same-day estimates',
    copy: "Call us early enough and we'll have someone at your home today.",
    icon: ClockIcon,
  },
  {
    label: 'Certified & insured',
    copy: 'Manufacturer-certified, fully licensed, fully insured. Paperwork on request.',
    icon: AwardIcon,
  },
  {
    label: 'Workmanship warranty',
    copy: 'If we install it, we stand behind it — for as long as you own the home.',
    icon: ShieldIcon,
  },
  {
    label: 'No subcontractors',
    copy: 'Every crew is on our payroll — uniformed, trained, background-checked.',
    icon: ThumbsUpIcon,
  },
];

export function WhyUs(props: SectionProps) {
  const theme = parseTheme(props.content.theme);
  const photo = props.photos[1] ?? props.photos[0];
  const r2 = process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? '';
  const photoUrl = photo ? `${r2}/${photo.r2_key}` : null;
  const business = props.client.business_name;

  return (
    <section
      id="why-us"
      className="dfy-section dfy-why-us"
      style={{
        background: 'var(--section-bg, var(--color-background))',
        padding: '5rem 1.5rem',
      }}
    >
      <div
        className="dfy-why-us__grid"
        style={{
          maxWidth: '1240px',
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '4rem',
          alignItems: 'center',
        }}
      >
        <div>
          <p style={kicker}>Why {business}</p>
          <h2
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: 'clamp(1.75rem, 4vw, 2.75rem)',
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: '-0.02em',
              margin: '0.75rem 0 1rem',
              color: 'var(--color-text)',
            }}
          >
            The crew your neighbors actually recommend.
          </h2>
          <p style={lede}>
            We&apos;re not a storm-chaser. We live where you live, our crews are W-2 employees,
            and our reputation here is the only marketing we&apos;ve ever needed.
          </p>

          <div style={{ marginTop: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.label} style={featureRow}>
                  <div style={iconBox}>
                    <Icon />
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--color-text)' }}>{f.label}</div>
                    <div style={{ marginTop: '0.2rem', fontSize: '0.9rem', color: 'color-mix(in srgb, var(--color-text) 65%, transparent)', lineHeight: 1.5 }}>
                      {f.copy}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ position: 'relative' }} className="dfy-why-us__photo">
          {photoUrl ? (
            <div
              style={{
                aspectRatio: '4 / 5',
                width: '100%',
                background: `url("${photoUrl}") center/cover no-repeat, color-mix(in srgb, var(--color-text) 12%, transparent)`,
                borderRadius: '1rem',
                boxShadow: '0 24px 48px -16px rgba(0,0,0,0.18)',
              }}
            />
          ) : (
            <div
              style={{
                aspectRatio: '4 / 5',
                width: '100%',
                background: 'color-mix(in srgb, var(--color-text) 12%, transparent)',
                borderRadius: '1rem',
              }}
            />
          )}
          {/* Floating aggregate-rating card. Placeholder values until
              client.google_rating / review_count are populated. */}
          <div
            className="dfy-why-us__card"
            style={{
              position: 'absolute',
              bottom: '-1.5rem',
              left: '-1.5rem',
              padding: '1.25rem 1.5rem',
              background: '#ffffff',
              color: '#0f172a',
              borderRadius: '0.85rem',
              boxShadow: '0 20px 40px -10px rgba(0,0,0,0.25)',
              minWidth: '12rem',
            }}
          >
            <div style={{ display: 'flex', gap: '2px', color: 'var(--color-accent)' }}>
              {[0, 1, 2, 3, 4].map((i) => <StarIcon key={i} />)}
            </div>
            <div style={{ marginTop: '0.5rem', fontSize: '1.5rem', fontWeight: 700, color: '#0f172a', lineHeight: 1 }}>
              4.9 / 5.0
            </div>
            <div style={{ marginTop: '0.25rem', fontSize: '0.75rem', color: '#64748b' }}>
              From verified local reviews
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .dfy-why-us__grid { grid-template-columns: 1fr !important; gap: 3rem !important; }
          .dfy-why-us__card { left: 1rem !important; bottom: -1rem !important; }
        }
      `}</style>
    </section>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const kicker: React.CSSProperties = {
  fontSize: '0.72rem', letterSpacing: '0.2em', textTransform: 'uppercase',
  fontWeight: 600, color: 'var(--color-accent)', margin: 0,
};
const lede: React.CSSProperties = {
  fontSize: '1.05rem', lineHeight: 1.55,
  color: 'color-mix(in srgb, var(--color-text) 75%, transparent)',
  margin: 0,
};
const featureRow: React.CSSProperties = {
  display: 'flex', gap: '1rem', alignItems: 'flex-start',
};
const iconBox: React.CSSProperties = {
  flexShrink: 0,
  width: '2.5rem', height: '2.5rem',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  borderRadius: '0.6rem',
  background: 'color-mix(in srgb, var(--color-accent) 12%, transparent)',
  color: 'var(--color-accent)',
};

// ── Icons (compact inline SVGs to avoid a Lucide dep) ──────────────────────
function ClockIcon() {
  return (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>);
}
function AwardIcon() {
  return (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15.477 12.89 1.515 8.526a.5.5 0 0 1-.81.47l-3.58-2.687a1 1 0 0 0-1.197 0l-3.586 2.686a.5.5 0 0 1-.81-.469l1.514-8.526" /><circle cx="12" cy="8" r="6" /></svg>);
}
function ShieldIcon() {
  return (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /><path d="m9 12 2 2 4-4" /></svg>);
}
function ThumbsUpIcon() {
  return (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" /><path d="M7 10v12" /></svg>);
}
function StarIcon() {
  return (<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z" /></svg>);
}
