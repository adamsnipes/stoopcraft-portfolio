import type { PublicClient } from '@/lib/tenant';
import type { ContentRow } from '@dfy/db';
import { resolveTenantBooking } from '@/lib/booking';

// ============================================================================
// FloatingBookingPill — global persistent CTA for flagship-tier styles.
// Lives outside any section so it stays visible across the whole scroll.
// Suppresses entirely when there's no actionable destination so we never
// render a dead CTA.
// ============================================================================

type Props = {
  client: Pick<PublicClient, 'phone' | 'status'>;
  content: Pick<ContentRow, 'booking_method' | 'booking_url'>;
};

export function FloatingBookingPill({ client, content }: Props) {
  const resolved = resolveTenantBooking(
    content.booking_method,
    content.booking_url,
    client.status,
    client.phone,
  );
  if (!resolved) return null;

  const isPhone = resolved.method === 'phone';
  const label = isPhone ? 'Call' : 'Book';

  // Hidden until the user scrolls past the hero — avoids covering the hero
  // CTA that already exists. Uses CSS-only IntersectionObserver via a
  // sibling sentinel approach would need JS; instead, fade-in via scroll
  // distance using `animation-timeline: scroll()` with a static fallback.
  return (
    <a
      href={resolved.externalHref}
      target={isPhone ? undefined : '_blank'}
      rel={isPhone ? undefined : 'noopener noreferrer'}
      className="dfy-flagship-pill fixed z-50 bottom-5 right-5 md:bottom-8 md:right-8 inline-flex items-center gap-2.5 px-6 py-3.5 text-sm font-medium uppercase tracking-[0.18em] transition-all hover:-translate-y-0.5"
      style={{
        background: 'var(--color-text)',
        color: 'var(--color-background)',
        borderRadius: '999px',
        boxShadow:
          '0 18px 40px -12px rgba(0,0,0,0.35), 0 4px 12px rgba(0,0,0,0.18)',
        letterSpacing: '0.18em',
      }}
      aria-label={isPhone ? 'Call to book' : 'Book an appointment'}
    >
      <span
        aria-hidden="true"
        className="block w-1.5 h-1.5 rounded-full"
        style={{ background: 'var(--color-accent)' }}
      />
      {label}
    </a>
  );
}
