import type { SectionProps } from '../types';
import { resolveTenantBooking } from '@/lib/booking';
import { parseTheme } from '@/lib/tenant';

// The Cut (thecut.co) — barbershop booking app. Asset path hand-picked from
// Brandfetch's catalog (theme/dark variant = white wordmark on a dark button).
// Falls back to text-only when NEXT_PUBLIC_BRANDFETCH_CLIENT_ID is unset, same
// pattern as components/template/sections/OrderingLinks.tsx.
function cutsLogoUrl(): string | null {
  const clientId = process.env.NEXT_PUBLIC_BRANDFETCH_CLIENT_ID;
  if (!clientId) return null;
  return `https://cdn.brandfetch.io/thecut.co/w/128/h/128?c=${clientId}`;
}

export function Booking({ variant, content, client }: SectionProps) {
  const theme = parseTheme(content.theme);
  const resolved = resolveTenantBooking(
    content.booking_method,
    content.booking_url,
    client.status,
    client.phone,
    { background: theme.background, text: theme.text, accent: theme.accent },
  );

  // No actionable destination — suppress the section so we never render a
  // dead CTA (e.g. claimed site with method=calendly but no URL set).
  if (!resolved) return null;

  // Booksy/phone/cuts can't be iframed; force the link variant for those.
  const mustLink = resolved.embedSrc === null;
  const isPhone = resolved.method === 'phone';
  const isCuts = resolved.method === 'cuts';

  if (variant === 'link' || mustLink) {
    const ctaLabel = isPhone
      ? 'Call to Book'
      : isCuts
        ? 'Book on The Cut'
        : 'Book Now';
    const subhead = isPhone
      ? client.phone
        ? `Tap below to call ${client.phone}.`
        : 'Tap below to call.'
      : isCuts
        ? "Book your next appointment through The Cut — your barber's preferred app."
        : client.phone
          ? `Call us at ${client.phone} or book online.`
          : 'Ready to get started? Book your appointment today.';

    // The Cut renders in its own brand colors (black + white wordmark) so the
    // CTA reads as "this opens The Cut app", not as a generic site button.
    // Booksy/phone/calendly stay on the site's primary color.
    const cutsLogo = isCuts ? cutsLogoUrl() : null;
    const buttonStyle = isCuts
      ? {
          background: '#000',
          color: '#fff',
          borderRadius: 'var(--radius)',
        }
      : {
          background: 'var(--color-primary)',
          color: '#fff',
          borderRadius: 'var(--radius)',
        };

    return (
      <section
        id="booking"
        className="dfy-booking dfy-booking--link py-24 px-6 text-center"
        style={{ background: 'var(--color-accent)' }}
      >
        <div className="max-w-2xl mx-auto">
          <h2
            className="text-4xl font-bold mb-5 text-white"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            Book an Appointment
          </h2>
          <p className="text-lg mb-10" style={{ color: 'rgba(255,255,255,0.82)' }}>
            {subhead}
          </p>
          <a
            href={resolved.externalHref}
            target={isPhone ? undefined : '_blank'}
            rel={isPhone ? undefined : 'noopener noreferrer'}
            className="inline-flex items-center gap-3 px-10 py-4 font-semibold text-lg tracking-wide transition-all hover:opacity-90 hover:shadow-xl"
            style={buttonStyle}
          >
            {cutsLogo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={cutsLogo}
                alt=""
                width={28}
                height={28}
                style={{ width: 28, height: 28, objectFit: 'contain' }}
              />
            )}
            {ctaLabel}
          </a>
        </div>
      </section>
    );
  }

  // Default: embed variant (calendly only).
  const { embedSrc } = resolved;
  return (
    <section id="booking" className="dfy-booking dfy-booking--embed py-24 px-6">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h2
            className="text-4xl font-bold mb-4"
            style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text)' }}
          >
            Book an Appointment
          </h2>
          <div className="w-14 h-[3px] mx-auto" style={{ background: 'var(--color-accent)' }} />
        </div>
        <div
          className="overflow-hidden"
          style={{
            borderRadius: 'var(--radius)',
            boxShadow: '0 4px 24px rgba(0,0,0,0.1)',
          }}
        >
          <iframe
            src={embedSrc!}
            style={{ width: '100%', minHeight: '600px', border: 'none' }}
            title="Book an appointment"
            loading="lazy"
          />
        </div>
      </div>
    </section>
  );
}
