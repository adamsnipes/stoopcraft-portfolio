import type { SectionProps } from '../types';
import { parseHours } from '@/lib/tenant';
import { ContactForm } from './ContactForm';
import { LeadForm } from './LeadForm';

const DAY_LABELS: Record<string, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
};

export function Contact({ variant, content, client }: SectionProps) {
  const hours = parseHours(content.hours);
  const hoursEntries = Object.entries(DAY_LABELS).filter(
    ([key]) => hours[key as keyof typeof hours]
  );
  // Trades clients reuse the hero's LeadForm at the bottom — keeps the form
  // shape consistent across the page (homeowners shouldn't see two different
  // form layouts on the same site) and gives the conversion a second chance
  // for users who scrolled through everything without filling the hero form.
  // The left-column copy also shifts: address is dropped (we don't ship a
  // location section for trades, so showing the office address here is
  // inconsistent) and the heading is sharper.
  const isTrades = client.business_vertical === 'trades';

  if (variant === 'minimal') {
    return (
      <section
        id="contact"
        className="dfy-contact dfy-contact--minimal py-20 px-6 text-center"
        style={{ background: 'var(--color-primary)', color: '#fff' }}
      >
        <h2
          className="text-3xl font-bold mb-6"
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          Get in Touch
        </h2>
        <div className="flex flex-col items-center gap-3 text-lg" style={{ color: 'rgba(255,255,255,0.85)' }}>
          {client.phone && (
            <a href={`tel:${client.phone}`} className="hover:text-white transition-colors">
              {client.phone}
            </a>
          )}
          {client.address && (
            <p>
              {client.address}, {client.city}, {client.state}
            </p>
          )}
        </div>
      </section>
    );
  }

  // Default: form variant
  return (
    <section
      id="contact"
      className="dfy-contact dfy-contact--form py-24 px-6"
      style={{ background: 'var(--section-bg, var(--color-background))' }}
    >
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-16">
        {/* Business info */}
        <div>
          <div className="w-12 h-[3px] mb-8" style={{ background: 'var(--color-accent)' }} />
          <h2
            className="text-4xl font-bold mb-8"
            style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text)' }}
          >
            {isTrades ? 'Still on the fence?' : 'Contact Us'}
          </h2>
          {isTrades && (
            <p
              className="mb-8 text-base"
              style={{ color: 'color-mix(in srgb, var(--color-text) 70%, transparent)', lineHeight: 1.55 }}
            >
              Drop your info and we&apos;ll text back within minutes — free, no obligation.
              Prefer to call? We&apos;re on the line right now.
            </p>
          )}
          <div className="space-y-5 text-base">
            {client.phone && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--color-accent)' }}>
                  Phone
                </p>
                <a
                  href={`tel:${client.phone}`}
                  className="hover:underline text-lg font-medium"
                  style={{ color: 'var(--color-text)' }}
                >
                  {client.phone}
                </a>
              </div>
            )}
            {/* Office address is meaningful for salon/restaurant clients (the
                shop IS the destination). Trades clients come to the customer,
                so the address would only invite "is this place real?" without
                providing useful direction. Omit. */}
            {!isTrades && client.address && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--color-accent)' }}>
                  Address
                </p>
                <p className="text-lg font-medium" style={{ color: 'var(--color-text)' }}>
                  {client.address}, {client.city}, {client.state}
                </p>
              </div>
            )}
            {hoursEntries.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--color-accent)' }}>
                  Hours
                </p>
                <ul className="space-y-1.5">
                  {hoursEntries.map(([key, label]) => {
                    const day = hours[key as keyof typeof hours];
                    return day ? (
                      <li key={key} className="flex justify-between text-sm" style={{ color: 'var(--color-text)', opacity: 0.8 }}>
                        <span className="font-medium">{label}</span>
                        <span>
                          {day.open} – {day.close}
                        </span>
                      </li>
                    ) : null;
                  })}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Form — LeadForm for trades (matches the hero), ContactForm otherwise */}
        {isTrades ? <LeadForm /> : <ContactForm />}
      </div>
    </section>
  );
}
