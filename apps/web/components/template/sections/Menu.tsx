import { parseMenu, parseTheme } from '@/lib/tenant';
import type { SectionProps } from '../types';
import type {
  MenuCategory,
  MenuItem,
  ThemeConfig,
  PhotoRow,
} from '@dfy/db';
import {
  MenuTabbed,
  MenuAccordion,
  MenuSidebarNav,
} from './MenuInteractive';
import { MenuLightbox } from './MenuLightbox';

// ============================================================================
// Menu composition dispatcher (restaurant vertical only).
//
// Compositions:
//   printed-menu-categorized — classic printed menu with dotted leaders;
//                              optional thumbnail prepended per item
//   modern-stacked           — clean single-column stack; optional thumbnail
//                              to the left of each item
//   photo-grid-menu          — Uber-Eats-style cards (image + text); items
//                              without an image render as text-only cards
//   chalkboard               — dark chalk-textured surface, hand-script
//                              category headers; aesthetic, full menu shown
//   magazine-spread          — editorial alternating photo + tight typeset
//                              list per category; aesthetic, full menu shown
//   tabbed-menu              — sticky category tabs, only one category visible
//   accordion-menu           — collapsible categories, first expanded
//   sidebar-nav              — left rail with categories, right pane shows one
//
// Image source precedence per item: photo_id (uploaded → R2) → photo_url
// (whitelisted external host) → none. show_images on MenuConfig (default true)
// is a section-level kill switch. Images are resolved up front in the
// dispatcher so client compositions don't need access to PhotoRow lookups
// (functions and Maps don't cross the server/client boundary cleanly).
// ============================================================================

export function Menu(props: SectionProps) {
  const menu = parseMenu(props.content.menu);
  if (menu.categories.length === 0) return null;

  const theme = parseTheme(props.content.theme);
  const composition = props.composition ?? 'printed-menu-categorized';
  // show_images defaults true when undefined — older menu rows pre-date the
  // toggle, treat them as if images are on so existing photo_ids still render.
  const showImages = menu.show_images !== false;

  const r2PublicUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? '';
  const photosById = new Map<string, PhotoRow>(
    props.menuPhotos.map((p) => [p.id, p]),
  );

  const resolveImage = (item: MenuItem): ResolvedImage | null => {
    if (!showImages) return null;
    if (item.photo_id) {
      const photo = photosById.get(item.photo_id);
      if (photo) {
        return {
          src: `${r2PublicUrl}/${photo.r2_key}`,
          alt: photo.alt_text ?? item.name,
        };
      }
    }
    if (item.photo_url) {
      return { src: item.photo_url, alt: item.name };
    }
    return null;
  };

  // Pre-decorate so both server and client compositions read the same shape.
  const decoratedCategories: DecoratedCategory[] = menu.categories.map((c) => ({
    ...c,
    items: c.items.map((i) => ({ ...i, image: resolveImage(i) })),
  }));

  const ctx: MenuCtx = {
    categories: decoratedCategories,
    theme,
    title: props.content.menu_title ?? 'Menu',
    eyebrowText: props.content.menu_eyebrow ?? null,
    resolveImage,
  };

  // MenuLightbox wraps every composition so any image stamped with
  // `data-menu-img` becomes a click-to-expand. The wrapper does its own
  // event delegation, so server compositions don't need any state.
  const body = (() => {
    switch (composition) {
      case 'photo-grid-menu':
        return <MenuPhotoGrid ctx={ctx} />;
      case 'modern-stacked':
        return <MenuModernStacked ctx={ctx} />;
      case 'chalkboard':
        return <MenuChalkboard ctx={ctx} />;
      case 'magazine-spread':
        return <MenuMagazineSpread ctx={ctx} />;
      case 'tabbed-menu':
        return (
          <MenuTabbed
            categories={decoratedCategories}
            title={ctx.title}
            eyebrow={ctx.eyebrowText}
          />
        );
      case 'accordion-menu':
        return (
          <MenuAccordion
            categories={decoratedCategories}
            title={ctx.title}
            eyebrow={ctx.eyebrowText}
          />
        );
      case 'sidebar-nav':
        return (
          <MenuSidebarNav
            categories={decoratedCategories}
            title={ctx.title}
            eyebrow={ctx.eyebrowText}
          />
        );
      case 'printed-menu-categorized':
      default:
        return <MenuPrintedCategorized ctx={ctx} />;
    }
  })();
  return <MenuLightbox>{body}</MenuLightbox>;
}

export type ResolvedImage = { src: string; alt: string };

export type DecoratedItem = MenuItem & { image: ResolvedImage | null };
export type DecoratedCategory = Omit<MenuCategory, 'items'> & {
  items: DecoratedItem[];
};

type MenuCtx = {
  categories: DecoratedCategory[];
  theme: ThemeConfig;
  title: string;
  eyebrowText: string | null;
  // Kept on the context for future compositions that want to re-resolve
  // dynamically (e.g. show a hero photo for a category itself). Existing
  // server compositions read item.image directly.
  resolveImage: (item: MenuItem) => ResolvedImage | null;
};

const DIETARY_LABELS: Record<string, string> = {
  gf: 'GF',
  vg: 'VG',
  v: 'V',
  df: 'DF',
  spicy: '🌶',
  nf: 'NF',
};

function formatPrice(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('$')) return trimmed;
  if (/^\d/.test(trimmed)) return `$${trimmed}`;
  return trimmed;
}

// ============================================================================
// printed-menu-categorized — printed-menu vibe, two-column on desktop
// Adds a small square thumbnail column when the item has an image.
// ============================================================================
function MenuPrintedCategorized({ ctx }: { ctx: MenuCtx }) {
  return (
    <section
      id="menu"
      className="dfy-section dfy-menu dfy-menu--printed"
      style={{
        padding: '6rem 1.5rem',
        background: 'var(--section-bg, var(--color-background))',
      }}
    >
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        {ctx.eyebrowText && (
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '0.75rem',
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              opacity: 0.65,
              textAlign: 'center',
              marginBottom: '1rem',
            }}
          >
            {ctx.eyebrowText}
          </p>
        )}
        <h2
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: 'clamp(2rem, 5vw, 3.5rem)',
            textAlign: 'center',
            marginBottom: '0.5rem',
            letterSpacing: '0.02em',
          }}
        >
          {ctx.title}
        </h2>
        <div
          aria-hidden
          style={{
            width: '3rem',
            height: '1px',
            background: 'var(--color-accent)',
            margin: '1.5rem auto 4rem',
          }}
        />

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(420px, 100%), 1fr))',
            columnGap: '4rem',
            rowGap: '3.5rem',
          }}
        >
          {ctx.categories.map((cat) => (
            <PrintedCategoryBlock key={cat.id} category={cat} />
          ))}
        </div>
      </div>
    </section>
  );
}

function PrintedCategoryBlock({ category }: { category: DecoratedCategory }) {
  return (
    <div>
      <h3
        style={{
          fontFamily: 'var(--font-heading)',
          fontSize: '0.875rem',
          letterSpacing: '0.32em',
          textTransform: 'uppercase',
          textAlign: 'center',
          marginBottom: '0.5rem',
          opacity: 0.85,
        }}
      >
        {category.title}
      </h3>
      {category.description && (
        <p
          style={{
            fontStyle: 'italic',
            fontSize: '0.85rem',
            textAlign: 'center',
            opacity: 0.6,
            marginBottom: '2rem',
          }}
        >
          {category.description}
        </p>
      )}
      <ul style={{ listStyle: 'none', padding: 0, margin: '1.5rem 0 0' }}>
        {category.items.map((item) => (
          <PrintedItemRow key={item.id} item={item} image={item.image} />
        ))}
      </ul>
    </div>
  );
}

function PrintedItemRow({ item, image }: { item: DecoratedItem; image: ResolvedImage | null }) {
  const price = formatPrice(item.price);
  return (
    <li
      style={{
        marginBottom: '1.5rem',
        display: 'grid',
        gridTemplateColumns: image ? '64px 1fr' : '1fr',
        gap: '1rem',
        alignItems: 'start',
      }}
    >
      {image && (
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: 'var(--radius)',
            overflow: 'hidden',
            background: 'color-mix(in srgb, var(--color-text) 6%, transparent)',
          }}
        >
          <img
            src={image.src}
            alt={image.alt}
            loading="lazy"
            data-menu-img={image.src}
            data-menu-img-alt={image.alt}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
              cursor: 'zoom-in',
            }}
          />
        </div>
      )}
      <div>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: '0.75rem',
            fontFamily: 'var(--font-body)',
          }}
        >
          <span style={{ fontWeight: 500 }}>{item.name}</span>
          <span
            aria-hidden
            style={{
              flex: 1,
              borderBottom: '1px dotted color-mix(in srgb, var(--color-text) 35%, transparent)',
              transform: 'translateY(-3px)',
            }}
          />
          {price && <span style={{ fontWeight: 500, whiteSpace: 'nowrap' }}>{price}</span>}
        </div>
        {(item.description || (item.dietary && item.dietary.length > 0)) && (
          <p
            style={{
              fontStyle: 'italic',
              fontSize: '0.85rem',
              opacity: 0.7,
              margin: '0.25rem 0 0',
              lineHeight: 1.5,
            }}
          >
            {item.description}
            {item.dietary && item.dietary.length > 0 && (
              <span style={{ marginLeft: item.description ? '0.5rem' : 0, opacity: 0.55 }}>
                ({item.dietary.map((d) => DIETARY_LABELS[d] ?? d.toUpperCase()).join(' · ')})
              </span>
            )}
          </p>
        )}
      </div>
    </li>
  );
}

// ============================================================================
// modern-stacked — single-column stacked layout, no dotted leaders, cleaner
// modern feel. Categories stack vertically. Prices live on the same row as
// item name but right-aligned without the connecting dotted line. Adds a small
// square thumbnail to the left when the item has an image.
// ============================================================================
function MenuModernStacked({ ctx }: { ctx: MenuCtx }) {
  return (
    <section
      id="menu"
      className="dfy-section dfy-menu dfy-menu--modern"
      style={{ padding: '6rem 1.5rem', background: 'var(--section-bg, var(--color-background))' }}
    >
      <div style={{ maxWidth: '720px', margin: '0 auto' }}>
        {ctx.eyebrowText && (
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '0.75rem',
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              opacity: 0.65,
              textAlign: 'left',
              marginBottom: '0.75rem',
            }}
          >
            {ctx.eyebrowText}
          </p>
        )}
        <h2
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: 'clamp(2rem, 5vw, 3rem)',
            textAlign: 'left',
            marginBottom: '3rem',
            letterSpacing: '-0.01em',
          }}
        >
          {ctx.title}
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '3.5rem' }}>
          {ctx.categories.map((cat) => (
            <ModernCategoryBlock key={cat.id} category={cat} />
          ))}
        </div>
      </div>
    </section>
  );
}

function ModernCategoryBlock({ category }: { category: DecoratedCategory }) {
  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: '1rem',
          marginBottom: '1.25rem',
          paddingBottom: '0.5rem',
          borderBottom: '1px solid color-mix(in srgb, var(--color-text) 15%, transparent)',
        }}
      >
        <h3
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: '1.25rem',
            letterSpacing: '0',
            margin: 0,
          }}
        >
          {category.title}
        </h3>
        {category.description && (
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '0.85rem',
              opacity: 0.6,
              margin: 0,
            }}
          >
            {category.description}
          </p>
        )}
      </div>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {category.items.map((item) => (
          <ModernItemRow key={item.id} item={item} image={item.image} />
        ))}
      </ul>
    </div>
  );
}

function ModernItemRow({ item, image }: { item: DecoratedItem; image: ResolvedImage | null }) {
  const price = formatPrice(item.price);
  return (
    <li
      style={{
        marginBottom: '1.5rem',
        display: 'grid',
        gridTemplateColumns: image ? '72px 1fr' : '1fr',
        gap: '1rem',
        alignItems: 'start',
      }}
    >
      {image && (
        <div
          style={{
            width: '72px',
            height: '72px',
            borderRadius: 'var(--radius)',
            overflow: 'hidden',
            background: 'color-mix(in srgb, var(--color-text) 6%, transparent)',
          }}
        >
          <img
            src={image.src}
            alt={image.alt}
            loading="lazy"
            data-menu-img={image.src}
            data-menu-img-alt={image.alt}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
              cursor: 'zoom-in',
            }}
          />
        </div>
      )}
      <div>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: '1rem',
            fontFamily: 'var(--font-body)',
            marginBottom: '0.25rem',
          }}
        >
          <span style={{ fontWeight: 600, fontSize: '1rem' }}>{item.name}</span>
          {price && (
            <span
              style={{
                fontWeight: 500,
                fontSize: '1rem',
                whiteSpace: 'nowrap',
                opacity: 0.75,
              }}
            >
              {price}
            </span>
          )}
        </div>
        {item.description && (
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '0.875rem',
              opacity: 0.7,
              lineHeight: 1.55,
              margin: 0,
            }}
          >
            {item.description}
          </p>
        )}
        {item.dietary && item.dietary.length > 0 && (
          <div style={{ marginTop: '0.375rem', display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
            {item.dietary.map((d) => (
              <span
                key={d}
                style={{
                  fontSize: '0.7rem',
                  fontFamily: 'var(--font-body)',
                  fontWeight: 600,
                  letterSpacing: '0.06em',
                  padding: '0.125rem 0.5rem',
                  borderRadius: '999px',
                  border: '1px solid color-mix(in srgb, var(--color-text) 25%, transparent)',
                  opacity: 0.7,
                }}
              >
                {DIETARY_LABELS[d] ?? d.toUpperCase()}
              </span>
            ))}
          </div>
        )}
      </div>
    </li>
  );
}

// ============================================================================
// photo-grid-menu — Uber-Eats-style cards. Category headers stay text-only;
// items render as cards with image (when available) on the right, name + price
// + description on the left. Items without an image collapse the image column
// and let text fill the card.
// ============================================================================
function MenuPhotoGrid({ ctx }: { ctx: MenuCtx }) {
  return (
    <section
      id="menu"
      className="dfy-section dfy-menu dfy-menu--photo-grid"
      style={{ padding: '6rem 1.5rem', background: 'var(--section-bg, var(--color-background))' }}
    >
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        {ctx.eyebrowText && (
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '0.75rem',
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              opacity: 0.65,
              textAlign: 'left',
              marginBottom: '0.75rem',
            }}
          >
            {ctx.eyebrowText}
          </p>
        )}
        <h2
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: 'clamp(2rem, 5vw, 3rem)',
            textAlign: 'left',
            marginBottom: '3rem',
            letterSpacing: '-0.01em',
          }}
        >
          {ctx.title}
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem' }}>
          {ctx.categories.map((cat) => (
            <PhotoGridCategoryBlock key={cat.id} category={cat} />
          ))}
        </div>
      </div>
    </section>
  );
}

function PhotoGridCategoryBlock({ category }: { category: DecoratedCategory }) {
  return (
    <div>
      <h3
        style={{
          fontFamily: 'var(--font-heading)',
          fontSize: '1.5rem',
          letterSpacing: '-0.01em',
          margin: '0 0 1.25rem',
        }}
      >
        {category.title}
      </h3>
      {category.description && (
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '0.9rem',
            opacity: 0.65,
            margin: '0 0 1.25rem',
          }}
        >
          {category.description}
        </p>
      )}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(360px, 100%), 1fr))',
          gap: '1rem',
        }}
      >
        {category.items.map((item) => (
          <PhotoGridItemCard key={item.id} item={item} image={item.image} />
        ))}
      </div>
    </div>
  );
}

function PhotoGridItemCard({ item, image }: { item: DecoratedItem; image: ResolvedImage | null }) {
  const price = formatPrice(item.price);
  return (
    <article
      style={{
        display: 'grid',
        gridTemplateColumns: image ? '1fr 112px' : '1fr',
        gap: '1rem',
        alignItems: 'start',
        padding: '1rem',
        borderRadius: 'var(--radius)',
        background: 'var(--card-surface)',
        border: '1px solid var(--card-ring)',
        fontFamily: 'var(--font-body)',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <h4
          style={{
            margin: 0,
            fontFamily: 'var(--font-heading)',
            fontSize: '1.05rem',
            fontWeight: 600,
            letterSpacing: '-0.005em',
            lineHeight: 1.25,
          }}
        >
          {item.name}
        </h4>
        {price && (
          <p
            style={{
              margin: '0.375rem 0 0',
              fontSize: '0.95rem',
              fontWeight: 500,
              color: 'var(--color-accent)',
            }}
          >
            {price}
          </p>
        )}
        {item.description && (
          <p
            style={{
              margin: '0.5rem 0 0',
              fontSize: '0.875rem',
              lineHeight: 1.5,
              opacity: 0.7,
            }}
          >
            {item.description}
          </p>
        )}
        {item.dietary && item.dietary.length > 0 && (
          <div style={{ marginTop: '0.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
            {item.dietary.map((d) => (
              <span
                key={d}
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  letterSpacing: '0.06em',
                  padding: '0.125rem 0.5rem',
                  borderRadius: '999px',
                  border: '1px solid color-mix(in srgb, var(--color-text) 25%, transparent)',
                  opacity: 0.7,
                }}
              >
                {DIETARY_LABELS[d] ?? d.toUpperCase()}
              </span>
            ))}
          </div>
        )}
      </div>
      {image && (
        <div
          style={{
            width: '112px',
            height: '112px',
            borderRadius: 'calc(var(--radius) - 2px)',
            overflow: 'hidden',
            background: 'color-mix(in srgb, var(--color-text) 6%, transparent)',
          }}
        >
          <img
            src={image.src}
            alt={image.alt}
            loading="lazy"
            data-menu-img={image.src}
            data-menu-img-alt={image.alt}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
              cursor: 'zoom-in',
            }}
          />
        </div>
      )}
    </article>
  );
}

// ============================================================================
// chalkboard — dark slate-green surface with chalk-dust grain, hand-script
// category headers in chalk-yellow. Item rows mimic chalk-handwriting:
// no thumbnails, no dotted leaders. Best for cafes / counter shops / casual
// brunch spots with a "today's specials" feel.
// ============================================================================
function MenuChalkboard({ ctx }: { ctx: MenuCtx }) {
  // Chalk palette is intentionally fixed regardless of theme — the whole
  // appeal is the slate-green-with-chalk look. Only --color-accent bleeds in
  // (for prices) so the section still feels tied to the brand.
  const chalkBg = '#1f3a2e';
  const chalkText = '#f3ecd6';
  const chalkMuted = 'rgba(243,236,214,0.65)';

  return (
    <section
      id="menu"
      className="dfy-section dfy-menu dfy-menu--chalkboard"
      style={{
        padding: '6rem 1.5rem',
        background: chalkBg,
        color: chalkText,
        backgroundImage:
          // Chalk-dust grain: faint radial speckles + a hint of horizontal streaks.
          'radial-gradient(circle at 20% 30%, rgba(243,236,214,0.05) 1px, transparent 2px),' +
          'radial-gradient(circle at 70% 65%, rgba(243,236,214,0.04) 1px, transparent 2px),' +
          'radial-gradient(circle at 40% 80%, rgba(243,236,214,0.03) 1px, transparent 2px),' +
          'linear-gradient(180deg, rgba(243,236,214,0.02), transparent 30%, rgba(0,0,0,0.06))',
        backgroundSize: '180px 180px, 240px 240px, 320px 320px, 100% 100%',
      }}
    >
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        {ctx.eyebrowText && (
          <p
            style={{
              fontSize: '0.75rem',
              letterSpacing: '0.32em',
              textTransform: 'uppercase',
              opacity: 0.7,
              textAlign: 'center',
              marginBottom: '1rem',
              color: chalkMuted,
            }}
          >
            {ctx.eyebrowText}
          </p>
        )}
        <h2
          style={{
            fontFamily: 'var(--font-heading)',
            fontStyle: 'italic',
            fontSize: 'clamp(2.5rem, 6vw, 4.5rem)',
            textAlign: 'center',
            marginBottom: '0.5rem',
            color: chalkText,
            letterSpacing: '-0.01em',
          }}
        >
          {ctx.title}
        </h2>
        <div
          aria-hidden
          style={{
            width: '4rem',
            height: '2px',
            background: 'var(--color-accent)',
            margin: '1.5rem auto 4rem',
            opacity: 0.8,
          }}
        />

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(380px, 100%), 1fr))',
            columnGap: '4rem',
            rowGap: '3.5rem',
          }}
        >
          {ctx.categories.map((cat) => (
            <ChalkCategoryBlock key={cat.id} category={cat} chalkText={chalkText} chalkMuted={chalkMuted} />
          ))}
        </div>
      </div>
    </section>
  );
}

function ChalkCategoryBlock({
  category,
  chalkText,
  chalkMuted,
}: {
  category: DecoratedCategory;
  chalkText: string;
  chalkMuted: string;
}) {
  return (
    <div>
      <h3
        style={{
          fontFamily: 'var(--font-heading)',
          fontStyle: 'italic',
          fontSize: '1.75rem',
          marginBottom: '1.25rem',
          color: chalkText,
          letterSpacing: '0',
          borderBottom: `1px dashed ${chalkMuted}`,
          paddingBottom: '0.5rem',
        }}
      >
        {category.title}
      </h3>
      {category.description && (
        <p
          style={{
            fontStyle: 'italic',
            fontSize: '0.9rem',
            color: chalkMuted,
            marginBottom: '1.25rem',
          }}
        >
          {category.description}
        </p>
      )}
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {category.items.map((item) => {
          const price = formatPrice(item.price);
          return (
            <li key={item.id} style={{ marginBottom: '1.25rem' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: '0.75rem',
                  fontFamily: 'var(--font-body)',
                }}
              >
                <span style={{ fontWeight: 600, fontSize: '1rem' }}>{item.name}</span>
                <span
                  aria-hidden
                  style={{
                    flex: 1,
                    borderBottom: `1px dashed ${chalkMuted}`,
                    transform: 'translateY(-3px)',
                    opacity: 0.5,
                  }}
                />
                {price && (
                  <span
                    style={{
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                      color: 'var(--color-accent)',
                    }}
                  >
                    {price}
                  </span>
                )}
              </div>
              {item.description && (
                <p
                  style={{
                    fontStyle: 'italic',
                    fontSize: '0.85rem',
                    color: chalkMuted,
                    margin: '0.25rem 0 0',
                    lineHeight: 1.5,
                  }}
                >
                  {item.description}
                </p>
              )}
              {item.dietary && item.dietary.length > 0 && (
                <p
                  style={{
                    fontSize: '0.7rem',
                    letterSpacing: '0.1em',
                    color: chalkMuted,
                    margin: '0.25rem 0 0',
                    opacity: 0.75,
                  }}
                >
                  {item.dietary.map((d) => DIETARY_LABELS[d] ?? d.toUpperCase()).join(' · ')}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ============================================================================
// magazine-spread — editorial alternating layout. Each category becomes a
// "spread": a hero photo from the first item with an image on one side, the
// rest of the category as a tight typeset list on the other. Side alternates
// per category so the page reads like a print magazine. Categories without
// any photographed item degrade to a centered text-only block.
// ============================================================================
function MenuMagazineSpread({ ctx }: { ctx: MenuCtx }) {
  return (
    <section
      id="menu"
      className="dfy-section dfy-menu dfy-menu--magazine"
      style={{ padding: '6rem 1.5rem', background: 'var(--section-bg, var(--color-background))' }}
    >
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {ctx.eyebrowText && (
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '0.75rem',
              letterSpacing: '0.32em',
              textTransform: 'uppercase',
              opacity: 0.65,
              textAlign: 'center',
              marginBottom: '1rem',
            }}
          >
            {ctx.eyebrowText}
          </p>
        )}
        <h2
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: 'clamp(2.5rem, 6vw, 4.25rem)',
            textAlign: 'center',
            marginBottom: '0.5rem',
            letterSpacing: '-0.01em',
          }}
        >
          {ctx.title}
        </h2>
        <div
          aria-hidden
          style={{
            width: '3rem',
            height: '1px',
            background: 'var(--color-accent)',
            margin: '1.5rem auto 5rem',
          }}
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6rem' }}>
          {ctx.categories.map((cat, i) => (
            <MagazineSpread key={cat.id} category={cat} reverse={i % 2 === 1} index={i + 1} />
          ))}
        </div>
      </div>
    </section>
  );
}

function MagazineSpread({
  category,
  reverse,
  index,
}: {
  category: DecoratedCategory;
  reverse: boolean;
  index: number;
}) {
  // First item with a photo becomes the spread's hero shot.
  const heroItem = category.items.find((i) => i.image);

  if (!heroItem) {
    // No photos in this category — render as a centered text block.
    return (
      <div style={{ maxWidth: '720px', margin: '0 auto' }}>
        <CategoryHeading title={category.title} index={index} description={category.description} />
        <ul style={{ listStyle: 'none', padding: 0, margin: '2rem 0 0' }}>
          {category.items.map((item) => (
            <MagazineItemRow key={item.id} item={item} />
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(420px, 100%), 1fr))',
        gap: '3rem',
        alignItems: 'center',
      }}
    >
      <div style={{ order: reverse ? 2 : 1 }}>
        <div
          style={{
            aspectRatio: '4 / 5',
            width: '100%',
            borderRadius: 'var(--radius)',
            overflow: 'hidden',
            background: 'color-mix(in srgb, var(--color-text) 6%, transparent)',
          }}
        >
          <img
            src={heroItem.image!.src}
            alt={heroItem.image!.alt}
            loading="lazy"
            data-menu-img={heroItem.image!.src}
            data-menu-img-alt={heroItem.image!.alt}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
              cursor: 'zoom-in',
            }}
          />
        </div>
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '0.75rem',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            opacity: 0.6,
            marginTop: '0.75rem',
            fontStyle: 'italic',
          }}
        >
          {heroItem.name}
        </p>
      </div>
      <div style={{ order: reverse ? 1 : 2 }}>
        <CategoryHeading title={category.title} index={index} description={category.description} />
        <ul style={{ listStyle: 'none', padding: 0, margin: '2rem 0 0' }}>
          {category.items.map((item) => (
            <MagazineItemRow key={item.id} item={item} />
          ))}
        </ul>
      </div>
    </div>
  );
}

function CategoryHeading({
  title,
  index,
  description,
}: {
  title: string;
  index: number;
  description?: string;
}) {
  return (
    <>
      <p
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: '0.7rem',
          letterSpacing: '0.32em',
          opacity: 0.55,
          margin: '0 0 0.5rem',
        }}
      >
        № {String(index).padStart(2, '0')}
      </p>
      <h3
        style={{
          fontFamily: 'var(--font-heading)',
          fontStyle: 'italic',
          fontSize: 'clamp(1.75rem, 3.5vw, 2.5rem)',
          margin: 0,
          letterSpacing: '-0.01em',
        }}
      >
        {title}
      </h3>
      {description && (
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '0.95rem',
            opacity: 0.65,
            margin: '0.75rem 0 0',
            lineHeight: 1.55,
          }}
        >
          {description}
        </p>
      )}
    </>
  );
}

function MagazineItemRow({ item }: { item: DecoratedItem }) {
  const price = formatPrice(item.price);
  return (
    <li
      style={{
        marginBottom: '1.25rem',
        paddingBottom: '1.25rem',
        borderBottom: '1px solid color-mix(in srgb, var(--color-text) 10%, transparent)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: '1rem',
          fontFamily: 'var(--font-body)',
        }}
      >
        <span style={{ fontWeight: 600, fontSize: '1rem' }}>{item.name}</span>
        {price && (
          <span
            style={{
              fontWeight: 500,
              fontSize: '0.95rem',
              whiteSpace: 'nowrap',
              opacity: 0.8,
            }}
          >
            {price}
          </span>
        )}
      </div>
      {item.description && (
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontStyle: 'italic',
            fontSize: '0.85rem',
            opacity: 0.65,
            lineHeight: 1.5,
            margin: '0.25rem 0 0',
          }}
        >
          {item.description}
        </p>
      )}
    </li>
  );
}
