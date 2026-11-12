import { parseServices, parseTheme, isDarkBackground } from '@/lib/tenant';
import type { SectionProps } from '../types';
import type { ServiceItem, ThemeConfig } from '@dfy/db';

// ============================================================================
// Services composition dispatcher
//
// Reads `composition` first; falls back to legacy `variant` for sites
// generated before the composition system shipped. Every existing site keeps
// rendering identically — only newly generated rows opt into the new layouts.
// ============================================================================

export function Services(props: SectionProps) {
  const services = parseServices(props.content.services);
  if (services.length === 0) return null;

  const theme = parseTheme(props.content.theme);
  const composition = resolveComposition(props.composition, props.variant);

  const ctx: ServicesCtx = {
    services,
    theme,
    title: props.content.services_title ?? 'Services',
    eyebrowText: resolveEyebrow(props.content.services_eyebrow, theme.style),
  };

  switch (composition) {
    case 'printed-menu':
      return <ServicesPrintedMenu ctx={ctx} />;
    case 'menu-card':
      return <ServicesMenuCard ctx={ctx} />;
    case 'tier-cards':
      return <ServicesTierCards ctx={ctx} />;
    case 'numbered':
      return <ServicesNumbered ctx={ctx} />;
    case 'large-cards':
      return <ServicesLargeCards ctx={ctx} />;
    case 'split-card':
      return <ServicesSplitCard ctx={ctx} />;
    case 'stacked-cards':
      return <ServicesStackedCards ctx={ctx} />;
    case 'icon-cards':
      return <ServicesIconCards ctx={ctx} />;
    case 'grid':
      return <ServicesGrid ctx={ctx} />;
    case 'list':
    default:
      return <ServicesList ctx={ctx} />;
  }
}

function resolveComposition(composition: string | undefined, variant: string): string {
  if (composition) return composition;
  return variant === 'grid' ? 'grid' : 'list';
}

function resolveEyebrow(stored: string | null | undefined, style: ThemeConfig['style']): string | null {
  if (stored != null) return stored; // honor explicit empty string from admin
  if (style === 'editorial' || style === 'luxe' || style === 'premium-dark') return 'The menu';
  if (style === 'service-tech') return 'What we do';
  return null;
}

type ServicesCtx = {
  services: ServiceItem[];
  theme: ThemeConfig;
  title: string;
  eyebrowText: string | null;
};

// ============================================================================
// Shared header (eyebrow + title + accent rule)
// ============================================================================

function SectionHeader({
  ctx,
  alignment = 'center',
  onDark = false,
}: {
  ctx: ServicesCtx;
  alignment?: 'center' | 'left';
  onDark?: boolean;
}) {
  return (
    <div className={`mb-14 ${alignment === 'center' ? 'text-center' : ''}`}>
      {ctx.eyebrowText && (
        <p
          data-label="services-eyebrow"
          className={
            ctx.theme.style === 'service-tech'
              ? 'text-xs uppercase tracking-widest mb-4 font-semibold'
              : 'text-[11px] uppercase tracking-[0.28em] mb-4 font-medium'
          }
          style={{ color: 'var(--color-accent)' }}
        >
          {ctx.eyebrowText}
        </p>
      )}
      <h2
        className="text-4xl md:text-5xl font-light leading-tight mb-4"
        style={{
          fontFamily: 'var(--font-heading)',
          color: 'var(--color-text)',
          letterSpacing: '-0.02em',
        }}
      >
        <span data-label="services-title">{ctx.title}</span>
      </h2>
      <span
        className={`block w-12 h-px ${alignment === 'center' ? 'mx-auto' : ''}`}
        style={{ background: 'var(--color-accent)' }}
      />
    </div>
  );
}

// ============================================================================
// Composition: list (legacy default — preserved)
// ============================================================================

function ServicesList({ ctx }: { ctx: ServicesCtx }) {
  return (
    <section
      id="services"
      className="dfy-services dfy-services--list py-28 px-6"
      style={{ background: 'var(--section-bg, var(--color-background))' }}
    >
      <div className="max-w-3xl mx-auto">
        <SectionHeader ctx={ctx} />
        <ul
          className="divide-y"
          style={{
            borderColor: 'color-mix(in srgb, var(--color-text) 12%, transparent)',
          }}
        >
          {ctx.services.map((service, i) => (
            <li
              key={i}
              className="py-7 flex items-start justify-between gap-6 group transition-colors hover:bg-[color-mix(in_srgb,var(--color-accent)_4%,transparent)]"
            >
              <div className="flex-1">
                <h3
                  className="font-medium text-lg md:text-xl mb-1.5 transition-colors group-hover:opacity-90"
                  style={{
                    color: 'var(--color-text)',
                    fontFamily: 'var(--font-heading)',
                    letterSpacing: '-0.005em',
                  }}
                >
                  {service.name}
                </h3>
                {service.description && (
                  <p
                    className="text-[15px] leading-relaxed max-w-md"
                    style={{
                      color: 'color-mix(in srgb, var(--color-text) 70%, transparent)',
                      fontFamily: 'var(--font-body)',
                    }}
                  >
                    {service.description}
                  </p>
                )}
              </div>
              {service.price && (
                <span
                  className="font-medium text-base md:text-lg shrink-0 tabular-nums"
                  style={{
                    color: 'var(--color-accent)',
                    fontFamily: 'var(--font-heading)',
                  }}
                >
                  {service.price}
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// ============================================================================
// Composition: grid (legacy — preserved)
// ============================================================================

function ServicesGrid({ ctx }: { ctx: ServicesCtx }) {
  const isDarkSurface = ctx.theme.style === 'premium-dark';
  return (
    <section
      id="services"
      className="dfy-services dfy-services--grid py-28 px-6"
      style={{
        background: isDarkSurface ? 'var(--color-primary)' : 'var(--color-background)',
      }}
    >
      <div className="max-w-6xl mx-auto">
        <SectionHeader ctx={ctx} onDark={isDarkSurface} />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {ctx.services.map((service, i) => (
            <ServiceCard key={i} service={service} theme={ctx.theme} />
          ))}
        </div>
      </div>
    </section>
  );
}

type ServiceCardProps = {
  service: ServiceItem;
  theme: ThemeConfig;
};

function ServiceCard({ service, theme }: ServiceCardProps) {
  const style = theme.style;
  const onDark = isDarkBackground(theme.background);
  const textColor = 'var(--color-text)';

  return (
    <div
      className="dfy-service-card relative flex flex-col gap-3 p-7 transition-all duration-300 hover:-translate-y-1"
      style={{
        background: 'var(--card-surface)',
        borderRadius: 'var(--radius)',
        boxShadow: onDark
          ? 'inset 0 0 0 1px rgba(255,255,255,0.06)'
          : '0 1px 2px rgba(0,0,0,0.02), 0 12px 32px -16px rgba(0,0,0,0.08)',
        outline: '1px solid var(--card-ring)',
        outlineOffset: '-1px',
      }}
    >
      {(style === 'editorial' || style === 'luxe' || style === 'minimal') && (
        <span
          aria-hidden="true"
          className="absolute top-0 left-7 right-7 h-px transition-all"
          style={{ background: 'var(--color-accent)' }}
        />
      )}
      {style === 'bold' && (
        <span
          aria-hidden="true"
          className="absolute left-0 top-7 bottom-7 w-1 rounded-r"
          style={{ background: 'var(--color-accent)' }}
        />
      )}
      {style === 'service-tech' && (
        <span
          aria-hidden="true"
          className="absolute top-3 right-3 w-2 h-2 rounded-full"
          style={{ background: 'var(--color-accent)' }}
        />
      )}

      <h3
        className="font-medium text-lg leading-snug"
        style={{
          color: textColor,
          fontFamily: 'var(--font-heading)',
          letterSpacing: '-0.005em',
        }}
      >
        {service.name}
      </h3>

      {service.description && (
        <p
          className="text-[14px] leading-relaxed flex-1"
          style={{
            color: onDark
              ? 'color-mix(in srgb, var(--color-text) 70%, transparent)'
              : 'color-mix(in srgb, var(--color-text) 70%, transparent)',
            fontFamily: 'var(--font-body)',
          }}
        >
          {service.description}
        </p>
      )}

      {service.price && (
        <p
          className="font-medium text-base mt-auto pt-3 tabular-nums"
          style={{
            color: 'var(--color-accent)',
            borderTop: onDark
              ? '1px solid rgba(255,255,255,0.08)'
              : '1px solid rgba(0,0,0,0.06)',
            fontFamily: 'var(--font-heading)',
          }}
        >
          {service.price}
        </p>
      )}
    </div>
  );
}

// ============================================================================
// Composition: menu-card — restaurant menu with dotted leaders
// ============================================================================

function ServicesMenuCard({ ctx }: { ctx: ServicesCtx }) {
  return (
    <section
      id="services"
      className="dfy-services dfy-services--menu py-28 px-6"
      style={{ background: 'var(--section-bg, var(--color-background))' }}
    >
      <div className="max-w-3xl mx-auto">
        <SectionHeader ctx={ctx} />

        <ul className="space-y-7">
          {ctx.services.map((service, i) => (
            <li key={i}>
              {/* Top row: name ··············· price (dotted leader) */}
              <div className="flex items-baseline gap-3">
                <h3
                  className="font-medium text-lg md:text-xl whitespace-nowrap"
                  style={{
                    color: 'var(--color-text)',
                    fontFamily: 'var(--font-heading)',
                    letterSpacing: '-0.005em',
                  }}
                >
                  {service.name}
                </h3>
                <span
                  aria-hidden="true"
                  className="flex-1"
                  style={{
                    borderBottom: '1px dotted color-mix(in srgb, var(--color-text) 30%, transparent)',
                    transform: 'translateY(-4px)',
                  }}
                />
                {service.price && (
                  <span
                    className="font-medium text-base md:text-lg shrink-0 tabular-nums whitespace-nowrap"
                    style={{
                      color: 'var(--color-accent)',
                      fontFamily: 'var(--font-heading)',
                    }}
                  >
                    {service.price}
                  </span>
                )}
              </div>
              {service.description && (
                <p
                  className="text-[14px] leading-relaxed mt-1.5 max-w-xl"
                  style={{
                    color: 'color-mix(in srgb, var(--color-text) 65%, transparent)',
                    fontFamily: 'var(--font-body)',
                    fontStyle: ctx.theme.style === 'editorial' || ctx.theme.style === 'luxe' ? 'italic' : 'normal',
                  }}
                >
                  {service.description}
                </p>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// ============================================================================
// Composition: printed-menu — flagship-atelier signature services layout.
// Numbered, italic descriptions, dotted leaders, two-column on desktop so it
// reads like a bifold printed menu. Oversized section header.
// ============================================================================

function ServicesPrintedMenu({ ctx }: { ctx: ServicesCtx }) {
  const eyebrow = ctx.eyebrowText ?? 'The Menu';

  return (
    <section
      id="services"
      className="dfy-services dfy-services--printed-menu py-32 px-6"
      style={{ background: 'var(--section-bg, var(--color-background))' }}
    >
      <div className="max-w-6xl mx-auto">
        {/* Oversized editorial header — separate from shared SectionHeader on
            purpose; printed-menu wants its own scale + alignment. */}
        <div className="mb-20 lg:mb-24 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div>
            <p
              data-label="services-eyebrow"
              className="text-[11px] uppercase tracking-[0.32em] mb-5 font-medium"
              style={{ color: 'var(--color-accent)' }}
            >
              {eyebrow}
            </p>
            <h2
              className="leading-[0.95]"
              style={{
                fontFamily: 'var(--font-heading)',
                color: 'var(--color-text)',
                fontSize: 'clamp(2.5rem, 6vw, 5rem)',
                fontWeight: 400,
                letterSpacing: '-0.02em',
              }}
            >
              <span data-label="services-title">{ctx.title}</span>
            </h2>
          </div>
          <p
            className="text-[11px] uppercase tracking-[0.32em] tabular-nums"
            style={{ color: 'color-mix(in srgb, var(--color-text) 55%, transparent)' }}
          >
            {String(ctx.services.length).padStart(2, '0')} Offerings
          </p>
        </div>

        <ul className="grid lg:grid-cols-2 gap-x-16 gap-y-12 relative">
          {/* Vertical divider between columns on desktop, like a printed bifold */}
          <span
            aria-hidden="true"
            className="hidden lg:block absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-px"
            style={{ background: 'color-mix(in srgb, var(--color-text) 12%, transparent)' }}
          />

          {ctx.services.map((service, i) => (
            <li key={i} className="flex gap-5">
              <span
                aria-hidden="true"
                className="text-[11px] uppercase tracking-[0.28em] tabular-nums pt-1.5 shrink-0"
                style={{ color: 'var(--color-accent)' }}
              >
                {String(i + 1).padStart(2, '0')}
              </span>

              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-3">
                  <h3
                    className="text-xl md:text-2xl leading-tight"
                    style={{
                      color: 'var(--color-text)',
                      fontFamily: 'var(--font-heading)',
                      fontWeight: 500,
                      letterSpacing: '-0.01em',
                    }}
                  >
                    {service.name}
                  </h3>
                  <span
                    aria-hidden="true"
                    className="flex-1"
                    style={{
                      borderBottom:
                        '1px dotted color-mix(in srgb, var(--color-text) 28%, transparent)',
                      transform: 'translateY(-5px)',
                    }}
                  />
                  {service.price && (
                    <span
                      className="text-base md:text-lg shrink-0 tabular-nums whitespace-nowrap"
                      style={{
                        color: 'var(--color-text)',
                        fontFamily: 'var(--font-heading)',
                        fontWeight: 500,
                      }}
                    >
                      {service.price}
                    </span>
                  )}
                </div>
                {service.description && (
                  <p
                    className="text-[15px] leading-relaxed mt-2 max-w-md"
                    style={{
                      color: 'color-mix(in srgb, var(--color-text) 62%, transparent)',
                      fontFamily: 'var(--font-body)',
                      fontStyle: 'italic',
                    }}
                  >
                    {service.description}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// ============================================================================
// Composition: tier-cards — 3-up cards with hero price + inclusions
// ============================================================================

function ServicesTierCards({ ctx }: { ctx: ServicesCtx }) {
  const isDarkSurface = ctx.theme.style === 'premium-dark';

  // Tier cards work best with 2–4 services. With more, fall back to a regular
  // grid layout but keep the heavier card treatment.
  const cols = ctx.services.length <= 2 ? 'sm:grid-cols-2' :
               ctx.services.length === 3 ? 'sm:grid-cols-2 lg:grid-cols-3' :
               'sm:grid-cols-2 lg:grid-cols-4';

  return (
    <section
      id="services"
      className="dfy-services dfy-services--tier-cards py-28 px-6"
      style={{
        background: isDarkSurface ? 'var(--color-primary)' : 'var(--color-background)',
      }}
    >
      <div className="max-w-6xl mx-auto">
        <SectionHeader ctx={ctx} onDark={isDarkSurface} />

        <div className={`grid grid-cols-1 ${cols} gap-5`}>
          {ctx.services.map((service, i) => (
            <TierCard
              key={i}
              service={service}
              theme={ctx.theme}
              isFeatured={i === Math.floor(ctx.services.length / 2)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function TierCard({
  service,
  theme,
  isFeatured,
}: {
  service: ServiceItem;
  theme: ThemeConfig;
  isFeatured: boolean;
}) {
  const style = theme.style;
  const onDark = isDarkBackground(theme.background);
  const featuredAccent = isFeatured;

  return (
    <div
      className="dfy-tier-card relative flex flex-col p-8 transition-all duration-300 hover:-translate-y-1"
      style={{
        background: featuredAccent
          ? 'color-mix(in srgb, var(--color-accent) 8%, var(--color-background))'
          : 'var(--card-surface)',
        borderRadius: 'var(--radius)',
        boxShadow: featuredAccent
          ? '0 24px 48px -20px color-mix(in srgb, var(--color-accent) 35%, transparent)'
          : onDark
          ? 'inset 0 0 0 1px rgba(255,255,255,0.06)'
          : '0 1px 2px rgba(0,0,0,0.02), 0 12px 32px -16px rgba(0,0,0,0.08)',
        outline: `1px solid ${
          featuredAccent
            ? 'color-mix(in srgb, var(--color-accent) 35%, transparent)'
            : 'var(--card-ring)'
        }`,
        outlineOffset: '-1px',
      }}
    >
      <h3
        className="font-medium text-xl mb-3"
        style={{
          color: 'var(--color-text)',
          fontFamily: 'var(--font-heading)',
          letterSpacing: '-0.01em',
        }}
      >
        {service.name}
      </h3>

      {service.price && (
        <p
          className="text-3xl md:text-4xl font-light mb-5 tabular-nums leading-none"
          style={{
            color: 'var(--color-accent)',
            fontFamily: 'var(--font-heading)',
            letterSpacing: '-0.02em',
          }}
        >
          {service.price}
        </p>
      )}

      <span
        className="block w-8 h-px mb-5"
        style={{ background: 'var(--color-accent)', opacity: 0.5 }}
      />

      {service.description && (
        <p
          className="text-[14px] leading-relaxed flex-1"
          style={{
            color: onDark
              ? 'color-mix(in srgb, var(--color-text) 75%, transparent)'
              : 'color-mix(in srgb, var(--color-text) 75%, transparent)',
            fontFamily: 'var(--font-body)',
          }}
        >
          {service.description}
        </p>
      )}
    </div>
  );
}

// ============================================================================
// Composition: numbered — editorial numbered list (01 / 02 / 03)
// ============================================================================

function ServicesNumbered({ ctx }: { ctx: ServicesCtx }) {
  return (
    <section
      id="services"
      className="dfy-services dfy-services--numbered py-28 px-6"
      style={{ background: 'var(--section-bg, var(--color-background))' }}
    >
      <div className="max-w-4xl mx-auto">
        <SectionHeader ctx={ctx} alignment="left" />

        <ol className="space-y-10 mt-14">
          {ctx.services.map((service, i) => (
            <li
              key={i}
              className="grid grid-cols-[auto_1fr_auto] gap-x-8 gap-y-2 items-baseline pb-10 border-b last:border-0"
              style={{
                borderColor: 'color-mix(in srgb, var(--color-text) 12%, transparent)',
              }}
            >
              <span
                className="text-2xl md:text-3xl font-light tabular-nums leading-none"
                style={{
                  color: 'var(--color-accent)',
                  fontFamily: 'var(--font-heading)',
                  fontStyle: ctx.theme.style === 'editorial' || ctx.theme.style === 'luxe' ? 'italic' : 'normal',
                }}
              >
                {String(i + 1).padStart(2, '0')}
              </span>
              <h3
                className="text-xl md:text-2xl font-medium"
                style={{
                  color: 'var(--color-text)',
                  fontFamily: 'var(--font-heading)',
                  letterSpacing: '-0.01em',
                }}
              >
                {service.name}
              </h3>
              {service.price && (
                <span
                  className="font-medium text-base md:text-lg tabular-nums shrink-0 self-start"
                  style={{
                    color: 'var(--color-accent)',
                    fontFamily: 'var(--font-heading)',
                  }}
                >
                  {service.price}
                </span>
              )}

              {service.description && (
                <p
                  className="col-start-2 col-end-3 text-[15px] leading-relaxed max-w-xl"
                  style={{
                    color: 'color-mix(in srgb, var(--color-text) 70%, transparent)',
                    fontFamily: 'var(--font-body)',
                  }}
                >
                  {service.description}
                </p>
              )}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

// ============================================================================
// Composition: large-cards — 2-up cards with generous padding and accent
// border treatment. Premium feel for fewer, richer services.
// ============================================================================

function ServicesLargeCards({ ctx }: { ctx: ServicesCtx }) {
  const isDarkSurface = ctx.theme.style === 'premium-dark';
  return (
    <section
      id="services"
      className="dfy-services dfy-services--large-cards py-28 px-6"
      style={{
        background: isDarkSurface ? 'var(--color-primary)' : 'var(--color-background)',
      }}
    >
      <div className="max-w-5xl mx-auto">
        <SectionHeader ctx={ctx} onDark={isDarkSurface} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
          {ctx.services.map((service, i) => (
            <LargeCard key={i} service={service} theme={ctx.theme} />
          ))}
        </div>
      </div>
    </section>
  );
}

function LargeCard({
  service,
  theme,
}: {
  service: ServiceItem;
  theme: ThemeConfig;
}) {
  const onDark = isDarkBackground(theme.background);
  return (
    <div
      className="dfy-large-card relative flex flex-col gap-5 p-9 md:p-10 transition-all duration-300 hover:-translate-y-1"
      style={{
        background: 'var(--card-surface)',
        borderRadius: 'var(--radius)',
        boxShadow: onDark
          ? 'inset 0 0 0 1px rgba(255,255,255,0.08)'
          : '0 1px 2px rgba(0,0,0,0.02), 0 24px 48px -24px rgba(0,0,0,0.10)',
        outline: '1px solid var(--card-ring)',
        outlineOffset: '-1px',
      }}
    >
      {/* Top accent bar */}
      <span
        aria-hidden="true"
        className="absolute top-0 left-9 right-9 md:left-10 md:right-10 h-px"
        style={{ background: 'var(--color-accent)' }}
      />

      <div className="flex items-baseline justify-between gap-4">
        <h3
          className="font-medium text-2xl md:text-3xl leading-tight"
          style={{
            color: 'var(--color-text)',
            fontFamily: 'var(--font-heading)',
            letterSpacing: '-0.015em',
          }}
        >
          {service.name}
        </h3>
        {service.price && (
          <span
            className="font-medium text-lg md:text-xl tabular-nums shrink-0"
            style={{
              color: 'var(--color-accent)',
              fontFamily: 'var(--font-heading)',
            }}
          >
            {service.price}
          </span>
        )}
      </div>

      {service.description && (
        <p
          className="text-[15px] md:text-base leading-relaxed flex-1"
          style={{
            color: onDark
              ? 'color-mix(in srgb, var(--color-text) 75%, transparent)'
              : 'color-mix(in srgb, var(--color-text) 72%, transparent)',
            fontFamily: 'var(--font-body)',
          }}
        >
          {service.description}
        </p>
      )}
    </div>
  );
}

// ============================================================================
// Composition: split-card — full-width cards split into content + accent panel
// Magazine spread feel; price gets dramatic treatment in the right panel.
// ============================================================================

function ServicesSplitCard({ ctx }: { ctx: ServicesCtx }) {
  const isDarkSurface = ctx.theme.style === 'premium-dark';
  return (
    <section
      id="services"
      className="dfy-services dfy-services--split-card py-28 px-6"
      style={{
        background: isDarkSurface ? 'var(--color-primary)' : 'var(--color-background)',
      }}
    >
      <div className="max-w-5xl mx-auto">
        <SectionHeader ctx={ctx} onDark={isDarkSurface} />

        <div className="space-y-5">
          {ctx.services.map((service, i) => (
            <SplitCard
              key={i}
              service={service}
              theme={ctx.theme}
              flip={i % 2 === 1}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function SplitCard({
  service,
  theme,
  flip,
}: {
  service: ServiceItem;
  theme: ThemeConfig;
  flip: boolean;
}) {
  const onDark = isDarkBackground(theme.background);
  return (
    <div
      className="dfy-split-card relative grid grid-cols-1 sm:grid-cols-[1fr_auto] overflow-hidden transition-all duration-300 hover:-translate-y-0.5"
      style={{
        background: 'var(--card-surface)',
        borderRadius: 'var(--radius)',
        boxShadow: onDark
          ? 'inset 0 0 0 1px rgba(255,255,255,0.06)'
          : '0 1px 2px rgba(0,0,0,0.02), 0 16px 36px -20px rgba(0,0,0,0.10)',
        outline: '1px solid var(--card-ring)',
        outlineOffset: '-1px',
        direction: flip ? 'rtl' : 'ltr',
      }}
    >
      {/* Content panel */}
      <div
        className="p-7 md:p-9 flex flex-col gap-3 justify-center"
        style={{ direction: 'ltr' }}
      >
        <h3
          className="font-medium text-xl md:text-2xl leading-tight"
          style={{
            color: 'var(--color-text)',
            fontFamily: 'var(--font-heading)',
            letterSpacing: '-0.01em',
          }}
        >
          {service.name}
        </h3>
        {service.description && (
          <p
            className="text-[14px] md:text-[15px] leading-relaxed max-w-xl"
            style={{
              color: onDark
                ? 'color-mix(in srgb, var(--color-text) 75%, transparent)'
                : 'color-mix(in srgb, var(--color-text) 70%, transparent)',
              fontFamily: 'var(--font-body)',
            }}
          >
            {service.description}
          </p>
        )}
      </div>

      {/* Accent price panel */}
      {service.price && (
        <div
          className="px-8 md:px-10 py-7 md:py-9 flex items-center justify-center min-w-[140px] sm:min-w-[180px]"
          style={{
            background: 'color-mix(in srgb, var(--color-accent) 10%, transparent)',
            borderLeft: flip ? 'none' : '1px solid color-mix(in srgb, var(--color-accent) 25%, transparent)',
            borderRight: flip ? '1px solid color-mix(in srgb, var(--color-accent) 25%, transparent)' : 'none',
            direction: 'ltr',
          }}
        >
          <span
            className="font-medium text-2xl md:text-3xl tabular-nums whitespace-nowrap"
            style={{
              color: 'var(--color-accent)',
              fontFamily: 'var(--font-heading)',
              letterSpacing: '-0.015em',
            }}
          >
            {service.price}
          </span>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Composition: stacked-cards — vertical full-width cards, generous spacing
// Each service feels like its own portfolio piece.
// ============================================================================

function ServicesStackedCards({ ctx }: { ctx: ServicesCtx }) {
  const isDarkSurface = ctx.theme.style === 'premium-dark';
  return (
    <section
      id="services"
      className="dfy-services dfy-services--stacked-cards py-28 px-6"
      style={{
        background: isDarkSurface ? 'var(--color-primary)' : 'var(--color-background)',
      }}
    >
      <div className="max-w-4xl mx-auto">
        <SectionHeader ctx={ctx} onDark={isDarkSurface} />

        <div className="space-y-5">
          {ctx.services.map((service, i) => (
            <StackedCard
              key={i}
              service={service}
              theme={ctx.theme}
              index={i}
              total={ctx.services.length}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function StackedCard({
  service,
  theme,
  index,
  total,
}: {
  service: ServiceItem;
  theme: ThemeConfig;
  index: number;
  total: number;
}) {
  const onDark = isDarkBackground(theme.background);
  return (
    <div
      className="dfy-stacked-card relative p-8 md:p-10 transition-all duration-300 hover:-translate-y-1"
      style={{
        background: 'var(--card-surface)',
        borderRadius: 'var(--radius)',
        boxShadow: onDark
          ? 'inset 0 0 0 1px rgba(255,255,255,0.06)'
          : '0 1px 2px rgba(0,0,0,0.02), 0 20px 40px -24px rgba(0,0,0,0.10)',
        outline: '1px solid var(--card-ring)',
        outlineOffset: '-1px',
      }}
    >
      {/* Tiny index marker — gives portfolio energy without taking up real space */}
      <span
        className="absolute top-5 right-6 text-[10px] uppercase tracking-widest font-semibold tabular-nums"
        style={{
          color: 'color-mix(in srgb, var(--color-accent) 70%, transparent)',
          fontFamily: 'var(--font-heading)',
        }}
      >
        {String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
      </span>

      <div className="flex items-baseline justify-between gap-4 mb-3 pr-20">
        <h3
          className="font-medium text-2xl md:text-3xl leading-tight"
          style={{
            color: 'var(--color-text)',
            fontFamily: 'var(--font-heading)',
            letterSpacing: '-0.015em',
          }}
        >
          {service.name}
        </h3>
        {service.price && (
          <span
            className="font-medium text-lg md:text-xl tabular-nums shrink-0"
            style={{
              color: 'var(--color-accent)',
              fontFamily: 'var(--font-heading)',
            }}
          >
            {service.price}
          </span>
        )}
      </div>

      {service.description && (
        <p
          className="text-[15px] md:text-base leading-relaxed max-w-2xl"
          style={{
            color: onDark
              ? 'color-mix(in srgb, var(--color-text) 75%, transparent)'
              : 'color-mix(in srgb, var(--color-text) 70%, transparent)',
            fontFamily: 'var(--font-body)',
          }}
        >
          {service.description}
        </p>
      )}
    </div>
  );
}

// ============================================================================
// Composition: icon-cards (trades signature)
//
// 3-up card grid (2-up tablet, 1-up phone) with a square accent-colored icon
// block at the top of each card. Hover lift + accent-fill swap on the icon.
// No prices rendered — trades services aren't usually à la carte; the lead
// form is where prices get quoted.
// ============================================================================

function ServicesIconCards({ ctx }: { ctx: ServicesCtx }) {
  return (
    <section
      id="services"
      className="dfy-services dfy-services--icon-cards"
      style={{
        background: 'var(--section-bg, var(--color-background))',
        padding: '5rem 1.5rem',
      }}
    >
      <div style={{ maxWidth: '1240px', margin: '0 auto' }}>
        <SectionHeader ctx={ctx} />
        <div
          className="dfy-services--icon-cards__grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '1.5rem',
          }}
        >
          {ctx.services.map((service, i) => (
            <IconCard key={`${service.name}-${i}`} service={service} />
          ))}
        </div>
      </div>
      <style>{`
        @media (max-width: 900px) {
          .dfy-services--icon-cards__grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (max-width: 560px) {
          .dfy-services--icon-cards__grid { grid-template-columns: 1fr !important; }
        }
        .dfy-services--icon-cards .dfy-icon-card {
          transition: transform .2s ease, box-shadow .2s ease, border-color .2s ease;
        }
        .dfy-services--icon-cards .dfy-icon-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 16px 32px -16px rgba(0,0,0,0.15);
          border-color: color-mix(in srgb, var(--color-accent) 35%, transparent);
        }
        .dfy-services--icon-cards .dfy-icon-card:hover .dfy-icon-card__icon {
          background: var(--color-accent);
          color: #ffffff;
        }
      `}</style>
    </section>
  );
}

function IconCard({ service }: { service: ServiceItem }) {
  const Icon = pickServiceIcon(service.name);
  return (
    <article
      className="dfy-icon-card"
      style={{
        background: 'var(--card-surface)',
        border: '1px solid var(--card-ring)',
        borderRadius: '0.85rem',
        padding: '1.5rem',
        boxShadow: '0 4px 12px -6px rgba(0,0,0,0.06)',
      }}
    >
      <div
        className="dfy-icon-card__icon"
        style={{
          width: '3rem', height: '3rem',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: '0.6rem',
          background: 'color-mix(in srgb, var(--color-accent) 12%, transparent)',
          color: 'var(--color-accent)',
          transition: 'background .2s ease, color .2s ease',
        }}
      >
        <Icon />
      </div>
      <h3
        style={{
          marginTop: '1.25rem',
          fontFamily: 'var(--font-heading)',
          fontSize: '1.1rem',
          fontWeight: 700,
          color: 'var(--color-text)',
          letterSpacing: '-0.01em',
        }}
      >
        {service.name}
      </h3>
      {service.description && (
        <p
          style={{
            marginTop: '0.5rem',
            fontSize: '0.9rem',
            lineHeight: 1.55,
            color: 'color-mix(in srgb, var(--color-text) 65%, transparent)',
          }}
        >
          {service.description}
        </p>
      )}
    </article>
  );
}

// Keyword → icon picker. Cheap heuristic, but surprisingly effective across
// the trades niches we ship (roofing/hvac/plumbing/electrical/etc.). Add new
// patterns at the top — first match wins, generic wrench is the fallback.
function pickServiceIcon(name: string): () => React.ReactElement {
  const n = name.toLowerCase();
  if (/(roof|shingle|gutter|chimney)/.test(n)) return RoofIcon;
  if (/(storm|hail|emergency|leak|water|drain|pipe)/.test(n)) return DropIcon;
  if (/(electric|wir|panel|outlet|breaker|light)/.test(n)) return BoltIcon;
  if (/(heat|furnace|ac|cool|hvac|thermost)/.test(n)) return ThermoIcon;
  if (/(paint|stain|finish|coat)/.test(n)) return BrushIcon;
  if (/(tree|prune|trim|stump|landscape|garden)/.test(n)) return LeafIcon;
  if (/(pest|bug|termite|rodent|mosquito|spray)/.test(n)) return ShieldIcon;
  if (/(install|replac|new|setup)/.test(n)) return WrenchIcon;
  if (/(inspect|estimate|audit|check)/.test(n)) return ClipboardIcon;
  if (/(repair|fix|patch|maintenance|service)/.test(n)) return HammerIcon;
  return WrenchIcon;
}

function WrenchIcon()    { return (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.106-3.105c.32-.322.863-.22.983.218a6 6 0 0 1-8.259 7.057l-7.91 7.91a1 1 0 0 1-2.999-3l7.91-7.91a6 6 0 0 1 7.057-8.259c.438.12.54.662.219.984z" /></svg>); }
function HammerIcon()    { return (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 12-9.373 9.373a1 1 0 0 1-3.001-3L12 9" /><path d="m18 15 4-4" /><path d="m21.5 11.5-1.914-1.914A2 2 0 0 1 19 8.172v-.344a2 2 0 0 0-.586-1.414l-1.657-1.657A6 6 0 0 0 12.516 3H9l1.243 1.243A6 6 0 0 1 12 8.485V10l2 2h1.172a2 2 0 0 1 1.414.586L18.5 14.5" /></svg>); }
function RoofIcon()      { return (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" /><path d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></svg>); }
function DropIcon()      { return (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 22a7 7 0 0 0 7-7c0-3-2-5.5-7-12.5C7 9.5 5 12 5 15a7 7 0 0 0 7 7z" /></svg>); }
function ClipboardIcon() { return (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><path d="m9 14 2 2 4-4" /></svg>); }
function BoltIcon()      { return (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" /></svg>); }
function ThermoIcon()    { return (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z" /></svg>); }
function BrushIcon()     { return (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9.06 11.9 13 8l3.71 3.71a2 2 0 0 1 0 2.83L14.1 17.16a2 2 0 0 1-2.83 0L9.06 14.74a2 2 0 0 1 0-2.84Z" /><path d="m19 8 .5-1.5a2 2 0 0 0-3-2.6L13 6" /><path d="M3 21c.5-3 2.5-4 5-4 .5-2 2-3 4-3" /></svg>); }
function LeafIcon()      { return (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19.2 2.96a1 1 0 0 1 1.6.8c0 7.46-3.92 14.18-9.8 16.24z" /><path d="M2 21c0-3 1.85-5.36 5.08-6" /></svg>); }
function ShieldIcon()    { return (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /><path d="m9 12 2 2 4-4" /></svg>); }
