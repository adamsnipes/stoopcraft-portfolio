import type { SectionProps } from '../types';
import { parseTheme } from '@/lib/tenant';

export function About({ variant, content, photos }: SectionProps) {
  const title = content.about_title ?? 'About Us';
  const body = content.about_body ?? '';
  const r2PublicUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? '';
  const aboutPhoto = photos[1] ?? photos[0];
  const theme = parseTheme(content.theme);
  const style = theme.style;

  const isDark = style === 'premium-dark';
  const surface = isDark
    ? 'var(--color-primary)'
    : 'var(--section-bg, var(--color-background))';
  const textColor = 'var(--color-text)';
  const subdued = 'color-mix(in srgb, var(--color-text) 78%, transparent)';

  // Drop cap for editorial / luxe styles where it fits visually.
  const usesDropCap =
    (style === 'editorial' || style === 'luxe') && body.length > 80;

  // Customer-editable. NULL falls back to "About" so existing rows render
  // unchanged.
  const eyebrowText = content.about_eyebrow ?? 'About';
  const eyebrow = (
    <p
      data-label="about-eyebrow"
      className="text-[11px] uppercase tracking-[0.28em] mb-4 font-medium"
      style={{ color: 'var(--color-accent)' }}
    >
      {eyebrowText}
    </p>
  );

  const bodyEl = (
    <p
      className="text-[17px] md:text-lg leading-relaxed"
      style={{
        color: subdued,
        fontFamily: 'var(--font-body)',
      }}
    >
      {usesDropCap ? (
        <>
          <span
            className="float-left mr-3 mt-1 leading-[0.85]"
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: '4rem',
              fontWeight: 400,
              color: 'var(--color-accent)',
            }}
          >
            {body.charAt(0)}
          </span>
          {body.slice(1)}
        </>
      ) : (
        body
      )}
    </p>
  );

  if (variant === 'text_image' && aboutPhoto) {
    return (
      <section
        id="about"
        className="dfy-about dfy-about--text-image py-28 px-6"
        style={{ background: surface, color: textColor }}
      >
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
          <div>
            {eyebrow}
            <h2
              className="text-4xl md:text-5xl font-light mb-7 leading-tight"
              style={{
                fontFamily: 'var(--font-heading)',
                color: textColor,
                letterSpacing: '-0.02em',
              }}
            >
              {title}
            </h2>
            {bodyEl}
          </div>
          <div
            className="relative overflow-hidden"
            style={{
              borderRadius: 'var(--radius)',
              boxShadow: isDark
                ? '0 30px 60px -30px rgba(0,0,0,0.6)'
                : '0 24px 48px -24px rgba(0,0,0,0.20)',
            }}
          >
            {/* Subtle accent rule frame for editorial/luxe */}
            {(style === 'editorial' || style === 'luxe') && (
              <span
                aria-hidden="true"
                className="absolute -top-2 -left-2 right-8 bottom-8 pointer-events-none"
                style={{
                  border: '1px solid var(--color-accent)',
                  borderRadius: 'var(--radius)',
                  opacity: 0.35,
                }}
              />
            )}
            <img
              src={`${r2PublicUrl}/${aboutPhoto.r2_key}`}
              alt={aboutPhoto.alt_text ?? title}
              className="w-full object-cover relative"
              style={{ maxHeight: '520px' }}
              loading="lazy"
              width={aboutPhoto.width ?? 600}
              height={aboutPhoto.height ?? 480}
            />
          </div>
        </div>
      </section>
    );
  }

  // Default: text-only
  return (
    <section
      id="about"
      className="dfy-about dfy-about--text py-28 px-6"
      style={{ background: surface, color: textColor }}
    >
      <div className="max-w-2xl mx-auto">
        {eyebrow}
        <h2
          className="text-4xl md:text-5xl font-light mb-7 leading-tight"
          style={{
            fontFamily: 'var(--font-heading)',
            color: textColor,
            letterSpacing: '-0.02em',
          }}
        >
          {title}
        </h2>
        {bodyEl}
      </div>
    </section>
  );
}
