import type { SectionProps } from '../types';

// ============================================================================
// Gallery composition dispatcher
//
// Mirrors Hero.tsx / Services.tsx: read `composition` first, fall back to the
// legacy `variant` field for sites generated before the gallery had bespoke
// compositions. Existing rows render byte-identical.
// ============================================================================

export function Gallery(props: SectionProps) {
  const r2PublicUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? '';
  // Restaurant galleries can show more frames; food shots benefit from a wider
  // contact-sheet feel. Beauty stays at the original 12.
  const displayCap = props.client.business_vertical === 'restaurant' ? 24 : 12;
  const photos = props.photos.slice(0, displayCap);
  if (photos.length === 0) return null;

  // Vertical-aware default: "From the kitchen" reads naturally for any
  // cuisine type and is a common pattern on real restaurant sites. Customer
  // can still override via gallery_title.
  const galleryTitle =
    props.content.gallery_title ??
    (props.client.business_vertical === 'restaurant' ? 'From the kitchen' : 'Our Work');
  const composition = resolveComposition(props.composition, props.variant);

  const ctx: GalleryCtx = {
    r2PublicUrl,
    photos,
    galleryTitle,
  };

  switch (composition) {
    case 'film-strip':
      return <GalleryFilmStrip ctx={ctx} />;
    case 'grid':
      return <GalleryGrid ctx={ctx} />;
    case 'masonry':
    default:
      return <GalleryMasonry ctx={ctx} />;
  }
}

function resolveComposition(composition: string | undefined, variant: string): string {
  if (composition) return composition;
  if (variant === 'grid') return 'grid';
  if (variant === 'off') return 'off';
  return 'masonry';
}

type GalleryCtx = {
  r2PublicUrl: string;
  photos: SectionProps['photos'];
  galleryTitle: string;
};

// ============================================================================
// Composition: masonry (legacy default — preserved)
// ============================================================================

function GalleryMasonry({ ctx }: { ctx: GalleryCtx }) {
  return (
    <section
      id="gallery"
      className="dfy-gallery dfy-gallery--masonry py-24 px-6"
      style={{ background: 'var(--color-primary)' }}
    >
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-4xl font-bold mb-4 text-white" style={{ fontFamily: 'var(--font-heading)' }}>
            <span data-label="gallery-title">{ctx.galleryTitle}</span>
          </h2>
          <div className="w-14 h-[3px] mx-auto" style={{ background: 'var(--color-accent)' }} />
        </div>
        <div className="columns-2 sm:columns-3 gap-3">
          {ctx.photos.map((photo) => (
            <div
              key={photo.id}
              className="mb-3 break-inside-avoid overflow-hidden"
              style={{ borderRadius: 'var(--radius)' }}
            >
              <img
                src={`${ctx.r2PublicUrl}/${photo.r2_key}`}
                alt={photo.alt_text ?? ''}
                className="w-full object-cover hover:scale-105 transition-transform duration-500"
                loading="lazy"
                width={photo.width ?? 600}
                height={photo.height ?? 400}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// Composition: grid (legacy — preserved)
// ============================================================================

function GalleryGrid({ ctx }: { ctx: GalleryCtx }) {
  return (
    <section
      id="gallery"
      className="dfy-gallery dfy-gallery--grid py-24 px-6"
      style={{ background: 'var(--color-primary)' }}
    >
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-4xl font-bold mb-4 text-white" style={{ fontFamily: 'var(--font-heading)' }}>
            <span data-label="gallery-title">{ctx.galleryTitle}</span>
          </h2>
          <div className="w-14 h-[3px] mx-auto" style={{ background: 'var(--color-accent)' }} />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {ctx.photos.map((photo) => (
            <div
              key={photo.id}
              className="aspect-square overflow-hidden"
              style={{ borderRadius: 'var(--radius)' }}
            >
              <img
                src={`${ctx.r2PublicUrl}/${photo.r2_key}`}
                alt={photo.alt_text ?? ''}
                className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                loading="lazy"
                width={photo.width ?? 400}
                height={photo.height ?? 400}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// Composition: film-strip — flagship-tier signature gallery.
// Horizontal scroll-snap row with portrait-tall cards. Reads like an editorial
// contact sheet. Section header is left-aligned with a numbered "vol." marker.
// ============================================================================

function GalleryFilmStrip({ ctx }: { ctx: GalleryCtx }) {
  return (
    <section
      id="gallery"
      className="dfy-gallery dfy-gallery--film-strip py-28"
      style={{ background: 'var(--section-bg, var(--color-background))', color: 'var(--color-text)' }}
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-10">
        {/* Editorial left-aligned header — distinct from the centered legacy
            galleries; volume marker mirrors the editorial-portrait hero. */}
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-12">
          <div>
            <p
              className="text-[11px] uppercase tracking-[0.32em] mb-5 font-medium"
              style={{ color: 'var(--color-accent)' }}
            >
              Portfolio
            </p>
            <h2
              className="leading-[0.95]"
              style={{
                fontFamily: 'var(--font-heading)',
                color: 'var(--color-text)',
                fontSize: 'clamp(2.25rem, 5vw, 4rem)',
                fontWeight: 400,
                letterSpacing: '-0.02em',
              }}
            >
              <span data-label="gallery-title">{ctx.galleryTitle}</span>
            </h2>
          </div>
          <p
            className="text-[11px] uppercase tracking-[0.32em] tabular-nums"
            style={{ color: 'color-mix(in srgb, var(--color-text) 55%, transparent)' }}
          >
            {String(ctx.photos.length).padStart(2, '0')} Frames · Drag to scroll
          </p>
        </div>
      </div>

      {/* Horizontal scroll-snap track. Bleeds slightly past the container so
          the next card is always peeking — invites the drag/scroll gesture. */}
      <div
        className="dfy-film-strip__track relative overflow-x-auto overflow-y-hidden snap-x snap-mandatory cursor-grab active:cursor-grabbing"
        style={{
          paddingInline: 'max(1.5rem, calc((100% - 80rem) / 2 + 1.5rem))',
          scrollbarWidth: 'none',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <style>{`.dfy-film-strip__track::-webkit-scrollbar{display:none}`}</style>
        <ul className="flex gap-5 lg:gap-6 pb-2">
          {ctx.photos.map((photo, i) => (
            <li
              key={photo.id}
              className="snap-start shrink-0 relative overflow-hidden group"
              style={{
                width: 'min(78vw, 22rem)',
                aspectRatio: '3/4',
                borderRadius: 'var(--radius)',
                boxShadow: '0 24px 48px -24px rgba(0,0,0,0.18)',
              }}
            >
              <span
                aria-hidden="true"
                className="absolute top-3 left-4 z-10 text-[10px] uppercase tracking-[0.32em] tabular-nums px-2 py-0.5 rounded-full backdrop-blur-sm"
                style={{
                  color: 'rgba(255,255,255,0.92)',
                  background: 'rgba(0,0,0,0.30)',
                }}
              >
                {String(i + 1).padStart(2, '0')}
              </span>
              <img
                src={`${ctx.r2PublicUrl}/${photo.r2_key}`}
                alt={photo.alt_text ?? ''}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                loading={i < 2 ? 'eager' : 'lazy'}
                width={photo.width ?? 600}
                height={photo.height ?? 800}
              />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
