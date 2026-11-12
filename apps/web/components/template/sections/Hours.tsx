import { parseHours } from '@/lib/tenant';
import type { SectionProps } from '../types';

// ============================================================================
// Standalone Hours section.
//
// `content.hours` is already populated for many sites and rendered in the
// Footer; this section promotes it into a prominent block. Restaurants want
// hours-of-op high on the page ("are you open right now?" is the most common
// pre-visit question). Returns null when no hours are configured.
// ============================================================================

const DAY_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const DAY_LABELS: Record<string, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
};

export function Hours(props: SectionProps) {
  const hours = parseHours(props.content.hours);
  const days = DAY_ORDER.filter((d) => d in hours);
  if (days.length === 0) return null;

  return (
    <section
      id="hours"
      className="dfy-section dfy-hours"
      style={{
        padding: '5rem 1.5rem',
        background: 'var(--section-bg, var(--color-background))',
      }}
    >
      <div style={{ maxWidth: '560px', margin: '0 auto', textAlign: 'center' }}>
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
          Hours
        </p>
        <h2
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: 'clamp(1.75rem, 4vw, 2.75rem)',
            marginBottom: '2.5rem',
          }}
        >
          When we&apos;re open
        </h2>

        <dl
          style={{
            display: 'grid',
            gridTemplateColumns: 'auto 1fr',
            columnGap: '2rem',
            rowGap: '0.75rem',
            fontFamily: 'var(--font-body)',
            textAlign: 'left',
            maxWidth: '420px',
            margin: '0 auto',
          }}
        >
          {days.map((day) => {
            const slot = hours[day];
            return (
              <div key={day} style={{ display: 'contents' }}>
                <dt style={{ fontWeight: 500 }}>{DAY_LABELS[day] ?? day}</dt>
                <dd style={{ margin: 0, opacity: 0.75, textAlign: 'right' }}>
                  {slot ? `${slot.open} – ${slot.close}` : 'Closed'}
                </dd>
              </div>
            );
          })}
        </dl>
      </div>
    </section>
  );
}
