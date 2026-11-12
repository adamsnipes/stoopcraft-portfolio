import { parseSections, parseOrderingLinks } from '@/lib/tenant';
import type { SectionProps } from './types';

const SALON_LINKS = [
  { href: '#services', label: 'Services' },
  { href: '#gallery', label: 'Gallery' },
  { href: '#about', label: 'About' },
  { href: '#contact', label: 'Contact' },
];

export function Nav({ content, client }: Pick<SectionProps, 'content' | 'client'>) {
  const ctaText = content.hero_cta_text ?? 'Book Now';
  const isRestaurant = client.business_vertical === 'restaurant';

  // Restaurant nav reflects the actually-rendered sections — Reservations only
  // shows if that section is enabled, Gallery only if galleries are on. The
  // ordering link only appears when the customer has actually saved at least
  // one delivery/takeout URL, since the section returns null otherwise.
  const sections = parseSections(content.sections);
  const enabled = new Set(sections.filter((s) => s.enabled).map((s) => s.type));
  const hasOrderingLinks =
    enabled.has('ordering') &&
    parseOrderingLinks(content.ordering_links).length > 0;

  const navLinks = (() => {
    if (!isRestaurant) return SALON_LINKS;
    const links: { href: string; label: string }[] = [{ href: '#menu', label: 'Menu' }];
    if (hasOrderingLinks) links.push({ href: '#order', label: 'Order' });
    if (enabled.has('reservations')) links.push({ href: '#reservations', label: 'Reservations' });
    if (enabled.has('gallery')) links.push({ href: '#gallery', label: 'Gallery' });
    if (enabled.has('about')) links.push({ href: '#about', label: 'About' });
    if (enabled.has('location')) links.push({ href: '#location', label: 'Location' });
    return links;
  })();

  // Restaurants without a contact form can't anchor the CTA at #contact —
  // priority is ordering (if links saved) → reservations → menu, since that
  // matches the most common "primary action" intent: counter-service shops
  // care about ordering, sit-downs care about reservations, neither ⇒ menu.
  const ctaHref = (() => {
    if (!isRestaurant) return '#contact';
    if (hasOrderingLinks) return '#order';
    if (enabled.has('reservations')) return '#reservations';
    return '#menu';
  })();

  const logoUrl = client.logo_url;

  return (
    <header className="dfy-nav sticky top-0 z-50" style={{ background: 'var(--color-primary)' }}>
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
        {logoUrl ? (
          <img
            src={logoUrl}
            alt={client.business_name}
            className="shrink-0 max-h-10 w-auto object-contain"
          />
        ) : (
          <span
            className="text-lg font-bold text-white tracking-wide shrink-0"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            {client.business_name}
          </span>
        )}

        <nav className="hidden md:flex items-center gap-7">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-white/70 hover:text-white text-sm font-medium tracking-wide transition-colors"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <a
          href={ctaHref}
          className="hidden md:inline-flex items-center px-5 py-2 text-sm font-semibold tracking-wide transition-all hover:opacity-90 shrink-0"
          style={{
            background: 'var(--color-accent)',
            color: '#fff',
            borderRadius: 'var(--radius)',
          }}
        >
          {ctaText}
        </a>
      </div>
    </header>
  );
}
