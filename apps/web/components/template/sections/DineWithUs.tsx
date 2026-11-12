import { parseOrderingLinks } from '@/lib/tenant';
import type { SectionProps } from '../types';
import type { OrderingLink, OrderingPlatform } from '@dfy/db';

// ============================================================================
// Dine With Us — combined Order + Reservations block.
//
// Editorial two-column treatment: section-leading headline, then ordering
// platforms (left) and reservation method (right) divided by a hairline.
// No card, no shadow, no brand-colored pills — those treatments read as a
// promo / coupon block; this reads as a magazine spread.
//
// Falls back gracefully when only one side is populated; returns null when
// neither is. Admins can still split the section back into two via the
// editor (Site.tsx handles that dispatch).
// ============================================================================

const PLATFORM_LABELS: Record<OrderingPlatform, string> = {
  doordash: 'DoorDash',
  ubereats: 'Uber Eats',
  grubhub: 'Grubhub',
  postmates: 'Postmates',
  chownow: 'ChowNow',
  toast: 'Toast',
  square: 'Square',
  direct: 'Order direct',
};

export function DineWithUs(props: SectionProps) {
  const links = parseOrderingLinks(props.content.ordering_links);
  const method = props.content.reservations_method;
  const url = props.content.reservations_url;
  const phone = props.client.phone;

  const hasOrdering = links.length > 0;
  const hasReservations = method != null;
  if (!hasOrdering && !hasReservations) return null;

  const twoColumn = hasOrdering && hasReservations;

  return (
    <section
      id="dine"
      className="dfy-section dfy-dine"
      style={{
        padding: '6rem 1.5rem',
        background: 'var(--section-bg, var(--color-background))',
      }}
    >
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        <header style={{ marginBottom: '4rem', maxWidth: '36rem' }}>
          <h2
            style={{
              fontFamily: 'var(--font-heading)',
              fontStyle: 'italic',
              fontWeight: 300,
              fontSize: 'clamp(2rem, 5vw, 3.5rem)',
              lineHeight: 1.02,
              letterSpacing: '-0.02em',
              margin: '0 0 1rem',
            }}
          >
            Order in or walk on in.
          </h2>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '1.05rem',
              lineHeight: 1.55,
              color: 'color-mix(in srgb, var(--color-text) 70%, transparent)',
              margin: 0,
              maxWidth: '32rem',
            }}
          >
            Get it delivered to your couch, or come sit with us.
          </p>
        </header>

        <div
          className="dfy-dine__grid"
          style={{
            display: 'grid',
            gridTemplateColumns: twoColumn ? '1fr 1fr' : '1fr',
            gap: '4rem',
            position: 'relative',
            paddingTop: '3rem',
            borderTop: '1px solid var(--card-ring)',
          }}
        >
          {hasOrdering && <OrderingColumn links={links} />}
          {hasReservations && (
            <ReservationsColumn method={method!} url={url} phone={phone} />
          )}
        </div>
      </div>

      <style>{`
        /* Hairline divider between the two columns on desktop — drawn via a
           pseudo-element on the grid container so it doesn't double-up the
           border-top above. */
        @media (min-width: 721px) {
          .dfy-dine__grid::before {
            content: "";
            position: absolute;
            top: 3rem; bottom: 0;
            left: 50%;
            width: 1px;
            background: var(--card-ring);
          }
          .dfy-dine.dfy-dine--single .dfy-dine__grid::before { display: none; }
        }
        @media (max-width: 720px) {
          .dfy-dine__grid { grid-template-columns: 1fr !important; gap: 3rem !important; }
        }
        .dfy-dine__link {
          display: inline-flex;
          align-items: baseline;
          gap: 0.65em;
          font-family: var(--font-heading);
          font-style: italic;
          font-weight: 400;
          font-size: clamp(1.35rem, 2.2vw, 1.75rem);
          letter-spacing: -0.01em;
          color: var(--color-text);
          text-decoration: none;
          padding: 0.35em 0;
          transition: color .25s ease;
        }
        .dfy-dine__link::before {
          content: "→";
          font-style: normal;
          font-weight: 300;
          color: var(--color-accent);
          display: inline-block;
          transition: transform .25s cubic-bezier(.2,.7,.2,1);
        }
        .dfy-dine__link:hover { color: var(--color-accent); }
        .dfy-dine__link:hover::before { transform: translateX(0.4em); }
        .dfy-dine__link[aria-disabled="true"] {
          opacity: 0.45; pointer-events: none;
        }
        .dfy-dine__tel {
          font-family: var(--font-heading);
          font-style: italic;
          font-weight: 300;
          font-size: clamp(2rem, 4.5vw, 3rem);
          letter-spacing: -0.02em;
          line-height: 1;
          color: var(--color-text);
          text-decoration: none;
          display: inline-block;
          transition: color .25s ease;
        }
        .dfy-dine__tel:hover { color: var(--color-accent); }
      `}</style>
    </section>
  );
}

function ColumnFrame({
  eyebrow,
  copy,
  children,
}: {
  eyebrow: string;
  copy?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="dfy-dine__col">
      <p
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: '0.7rem',
          letterSpacing: '0.24em',
          textTransform: 'uppercase',
          color: 'color-mix(in srgb, var(--color-text) 55%, transparent)',
          fontWeight: 500,
          margin: '0 0 0.85rem',
        }}
      >
        {eyebrow}
      </p>
      {copy && (
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '0.95rem',
            lineHeight: 1.55,
            color: 'color-mix(in srgb, var(--color-text) 70%, transparent)',
            margin: '0 0 1.5rem',
            maxWidth: '24rem',
          }}
        >
          {copy}
        </p>
      )}
      {children}
    </div>
  );
}

function OrderingColumn({ links }: { links: OrderingLink[] }) {
  return (
    <ColumnFrame
      eyebrow="Delivery & takeout"
      copy="Order from your usual — fees and timing set by the platform."
    >
      <ul
        style={{
          listStyle: 'none',
          padding: 0,
          margin: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: '0.15rem',
        }}
      >
        {links.map((link, i) => {
          const label = link.label ?? PLATFORM_LABELS[link.platform];
          const isPlaceholder = link.url.trim() === '';
          return (
            <li key={`${link.platform}-${i}`}>
              {isPlaceholder ? (
                <span className="dfy-dine__link" aria-disabled="true">
                  {label}
                </span>
              ) : (
                <a
                  className="dfy-dine__link"
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {label}
                </a>
              )}
            </li>
          );
        })}
      </ul>
    </ColumnFrame>
  );
}

function ReservationsColumn({
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
      <ColumnFrame
        eyebrow="Reservations"
        copy="No bookings — first-come, first-served. Stop by during open hours and we'll find you a seat."
      >
        <p
          style={{
            fontFamily: 'var(--font-heading)',
            fontStyle: 'italic',
            fontWeight: 300,
            fontSize: 'clamp(1.5rem, 3vw, 2.25rem)',
            letterSpacing: '-0.015em',
            lineHeight: 1.1,
            margin: '0 0 0.5rem',
          }}
        >
          Walk-ins welcome.
        </p>
        <a
          href="#hours"
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '0.85rem',
            letterSpacing: '0.04em',
            textDecoration: 'underline',
            textUnderlineOffset: '4px',
            textDecorationColor: 'color-mix(in srgb, var(--color-text) 40%, transparent)',
            color: 'color-mix(in srgb, var(--color-text) 75%, transparent)',
          }}
        >
          See hours below
        </a>
      </ColumnFrame>
    );
  }

  if (method === 'phone') {
    if (!phone) return null;
    return (
      <ColumnFrame
        eyebrow="Reservations"
        copy="Give us a ring and we'll set a table aside."
      >
        <a className="dfy-dine__tel" href={`tel:${phone}`}>
          {phone}
        </a>
      </ColumnFrame>
    );
  }

  if (!url) return null;

  const label =
    method === 'opentable' ? 'Reserve on OpenTable' :
    method === 'resy' ? 'Reserve on Resy' :
    method === 'tock' ? 'Reserve on Tock' :
    'Reserve a table';

  return (
    <ColumnFrame
      eyebrow="Reservations"
      copy="Pick a time that works for you — we'll see you then."
    >
      <a
        className="dfy-dine__link"
        href={url}
        target="_blank"
        rel="noopener noreferrer"
      >
        {label}
      </a>
    </ColumnFrame>
  );
}
