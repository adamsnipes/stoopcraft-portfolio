import type { SectionProps } from '../types';

// ============================================================================
// Location section — two-column on desktop (info + map), stacks on mobile.
//
// Map URL strategy:
//   1. NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY + place_id → official Maps Embed API
//      (recommended, supported, but needs an API key)
//   2. Address fallback → unofficial maps.google.com/maps?q=...&output=embed
//      (works without a key; what most small-business sites use)
//   3. No address at all → section returns null
// ============================================================================

export function Location(props: SectionProps) {
  const { client } = props;
  if (!client.address && !client.lat) return null;

  const placeId = client.google_place_id;
  const embedKey = process.env['NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY'];

  // Dedupe the visible address: client.address from Google Places is usually
  // already a fully-formed street + city + state + zip string. Only re-append
  // city/state if the address looks like just a street ("274 Sand Ln").
  const looksFull = client.address && client.address.includes(',');
  const displayAddress = looksFull
    ? client.address
    : [client.address, client.city, client.state].filter(Boolean).join(', ');

  // Build the map URL. Prefer official place-id embed; fall back to address
  // search so the map still renders without an API key (essential for self-
  // hosted dev environments and clients without a key configured yet).
  const fullAddressForQuery = [client.address, client.city, client.state]
    .filter(Boolean)
    .join(', ');
  const mapUrl =
    placeId && embedKey
      ? `https://www.google.com/maps/embed/v1/place?key=${embedKey}&q=place_id:${placeId}`
      : fullAddressForQuery
        ? `https://maps.google.com/maps?q=${encodeURIComponent(fullAddressForQuery)}&output=embed`
        : null;

  const directionsHref = placeId
    ? `https://www.google.com/maps/place/?q=place_id:${placeId}`
    : `https://www.google.com/maps?q=${encodeURIComponent(fullAddressForQuery)}`;

  return (
    <section
      id="location"
      className="dfy-section dfy-location"
      style={{ padding: '5rem 1.5rem', background: 'var(--section-bg, var(--color-background))' }}
    >
      <div
        style={{
          maxWidth: '1100px',
          margin: '0 auto',
          display: 'grid',
          // 2-col on desktop (>=720px-ish), stacks on mobile via auto-fit + minmax.
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px, 100%), 1fr))',
          gap: '3rem',
          alignItems: 'center',
        }}
      >
        {/* ── Left column: info ──────────────────────────────────────────── */}
        <div>
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
            Find us
          </p>
          <h2
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: 'clamp(1.75rem, 4vw, 2.75rem)',
              marginBottom: '1rem',
              letterSpacing: '-0.01em',
            }}
          >
            {client.business_name}
          </h2>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              opacity: 0.75,
              lineHeight: 1.6,
              marginBottom: '1.5rem',
            }}
          >
            {displayAddress}
          </p>
          {client.phone && (
            <p
              style={{
                fontFamily: 'var(--font-body)',
                opacity: 0.75,
                lineHeight: 1.6,
                marginBottom: '1.5rem',
              }}
            >
              <a
                href={`tel:${client.phone}`}
                style={{ color: 'inherit', textDecoration: 'none' }}
              >
                {client.phone}
              </a>
            </p>
          )}
          <a
            href={directionsHref}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-block',
              padding: '0.625rem 1.25rem',
              fontFamily: 'var(--font-body)',
              fontWeight: 500,
              fontSize: '0.875rem',
              color: 'var(--color-text)',
              border: '1px solid color-mix(in srgb, var(--color-text) 25%, transparent)',
              borderRadius: 'var(--radius)',
              textDecoration: 'none',
              letterSpacing: '0.04em',
            }}
          >
            Get directions
          </a>
        </div>

        {/* ── Right column: map ──────────────────────────────────────────── */}
        {mapUrl && (
          <div
            style={{
              width: '100%',
              aspectRatio: '4 / 3',
              borderRadius: 'var(--radius)',
              overflow: 'hidden',
              border: '1px solid color-mix(in srgb, var(--color-text) 12%, transparent)',
            }}
          >
            <iframe
              title={`${client.business_name} on Google Maps`}
              src={mapUrl}
              loading="lazy"
              allowFullScreen
              referrerPolicy="no-referrer-when-downgrade"
              style={{ width: '100%', height: '100%', border: 0 }}
            />
          </div>
        )}
      </div>
    </section>
  );
}
