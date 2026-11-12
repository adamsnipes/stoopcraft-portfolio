'use client';

import { useState } from 'react';
import type { DecoratedCategory, DecoratedItem, ResolvedImage } from './Menu';

// ============================================================================
// Interactive menu compositions — anything with category-filter behavior or
// expand/collapse state lives here. Server dispatcher in Menu.tsx pre-resolves
// images and passes decorated categories so this file doesn't need access to
// PhotoRow / R2 url plumbing.
//
// Compositions:
//   tabbed-menu   — sticky tab strip; one category visible at a time
//   accordion-menu — collapsible categories, first expanded
//   sidebar-nav   — left rail with categories, right pane shows selection
// ============================================================================

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

type SharedProps = {
  categories: DecoratedCategory[];
  title: string;
  eyebrow: string | null;
};

// ----------------------------------------------------------------------------
// Section header — eyebrow + title + accent rule. Shared by all three layouts.
// ----------------------------------------------------------------------------
function SectionHeader({ title, eyebrow, align = 'center' }: { title: string; eyebrow: string | null; align?: 'center' | 'left' }) {
  return (
    <>
      {eyebrow && (
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '0.75rem',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            opacity: 0.65,
            textAlign: align,
            marginBottom: '1rem',
          }}
        >
          {eyebrow}
        </p>
      )}
      <h2
        style={{
          fontFamily: 'var(--font-heading)',
          fontSize: 'clamp(2rem, 5vw, 3.5rem)',
          textAlign: align,
          margin: 0,
          letterSpacing: '-0.01em',
        }}
      >
        {title}
      </h2>
      <div
        aria-hidden
        style={{
          width: '3rem',
          height: '1px',
          background: 'var(--color-accent)',
          margin: align === 'center' ? '1.5rem auto 4rem' : '1.5rem 0 3rem',
        }}
      />
    </>
  );
}

// ----------------------------------------------------------------------------
// Generic item row — used inside every interactive composition. Mirrors the
// modern-stacked look (no dotted leaders, thumbnail when present) so the
// visual grammar stays consistent across compositions.
// ----------------------------------------------------------------------------
function ItemRow({ item }: { item: DecoratedItem }) {
  const price = formatPrice(item.price);
  const image: ResolvedImage | null = item.image;
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
// tabbed-menu — sticky horizontal tab strip at the top, a single category
// renders below. Tab strip horizontally scrolls on overflow so 10+ categories
// don't break the layout.
// ============================================================================
export function MenuTabbed({ categories, title, eyebrow }: SharedProps) {
  const [activeId, setActiveId] = useState(categories[0]?.id);
  const active = categories.find((c) => c.id === activeId) ?? categories[0];
  if (!active) return null;

  return (
    <section
      id="menu"
      className="dfy-section dfy-menu dfy-menu--tabbed"
      style={{ padding: '6rem 1.5rem 5rem', background: 'var(--section-bg, var(--color-background))' }}
    >
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <SectionHeader title={title} eyebrow={eyebrow} />

        <div
          // sticky tab strip — the dfy-nav header is 64px (h-16), so anchor
          // tabs flush against it on scroll. background var keeps tabs
          // legible when the page bg is dark or textured.
          style={{
            position: 'sticky',
            top: '64px',
            zIndex: 5,
            background: 'var(--section-bg, var(--color-background))',
            paddingTop: '1rem',
            paddingBottom: '1rem',
            margin: '-1rem -1rem 2rem',
            borderBottom: '1px solid color-mix(in srgb, var(--color-text) 10%, transparent)',
          }}
        >
          <div
            role="tablist"
            aria-label="Menu categories"
            style={{
              display: 'flex',
              gap: '0.5rem',
              overflowX: 'auto',
              padding: '0 1rem',
              scrollbarWidth: 'none',
            }}
          >
            {categories.map((cat) => {
              const isActive = cat.id === active.id;
              return (
                <button
                  key={cat.id}
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveId(cat.id)}
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    letterSpacing: '0.04em',
                    padding: '0.5rem 1rem',
                    borderRadius: '999px',
                    border: '1px solid transparent',
                    background: isActive ? 'var(--color-accent)' : 'transparent',
                    color: isActive ? '#fff' : 'inherit',
                    opacity: isActive ? 1 : 0.7,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {cat.title}
                </button>
              );
            })}
          </div>
        </div>

        <div role="tabpanel" aria-labelledby={active.id}>
          {active.description && (
            <p
              style={{
                fontStyle: 'italic',
                fontSize: '0.95rem',
                opacity: 0.65,
                margin: '0 0 2rem',
                fontFamily: 'var(--font-body)',
              }}
            >
              {active.description}
            </p>
          )}
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {active.items.map((item) => (
              <ItemRow key={item.id} item={item} />
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// accordion-menu — collapsible categories, first expanded. Click any header
// to expand/collapse. Multiple categories can be open simultaneously so
// browsing across categories doesn't constantly close the previous one.
// ============================================================================
export function MenuAccordion({ categories, title, eyebrow }: SharedProps) {
  const [open, setOpen] = useState<Set<string>>(
    new Set(categories[0] ? [categories[0].id] : []),
  );
  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <section
      id="menu"
      className="dfy-section dfy-menu dfy-menu--accordion"
      style={{ padding: '6rem 1.5rem', background: 'var(--section-bg, var(--color-background))' }}
    >
      <div style={{ maxWidth: '780px', margin: '0 auto' }}>
        <SectionHeader title={title} eyebrow={eyebrow} />

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {categories.map((cat) => {
            const isOpen = open.has(cat.id);
            return (
              <div
                key={cat.id}
                style={{
                  borderTop: '1px solid color-mix(in srgb, var(--color-text) 12%, transparent)',
                }}
              >
                <button
                  onClick={() => toggle(cat.id)}
                  aria-expanded={isOpen}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '1rem',
                    padding: '1.5rem 0.25rem',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-heading)',
                    fontSize: '1.25rem',
                    textAlign: 'left',
                    color: 'inherit',
                    letterSpacing: '0',
                  }}
                >
                  <span>
                    {cat.title}
                    <span
                      style={{
                        fontFamily: 'var(--font-body)',
                        fontSize: '0.75rem',
                        opacity: 0.5,
                        marginLeft: '0.75rem',
                        fontWeight: 400,
                      }}
                    >
                      {cat.items.length} {cat.items.length === 1 ? 'item' : 'items'}
                    </span>
                  </span>
                  <span
                    aria-hidden
                    style={{
                      fontSize: '1.25rem',
                      opacity: 0.5,
                      transform: isOpen ? 'rotate(45deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s ease',
                      lineHeight: 1,
                    }}
                  >
                    +
                  </span>
                </button>
                {isOpen && (
                  <div style={{ padding: '0 0.25rem 2rem' }}>
                    {cat.description && (
                      <p
                        style={{
                          fontStyle: 'italic',
                          fontSize: '0.9rem',
                          opacity: 0.65,
                          margin: '0 0 1.5rem',
                          fontFamily: 'var(--font-body)',
                        }}
                      >
                        {cat.description}
                      </p>
                    )}
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                      {cat.items.map((item) => (
                        <ItemRow key={item.id} item={item} />
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
          <div style={{ borderTop: '1px solid color-mix(in srgb, var(--color-text) 12%, transparent)' }} />
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// sidebar-nav — left rail with category names, right pane shows the selected
// category's items. Mobile: collapses the rail into a horizontal tab strip
// (using the same scroll-snap approach as tabbed-menu) so phones don't lose
// half the screen to a sidebar.
// ============================================================================
export function MenuSidebarNav({ categories, title, eyebrow }: SharedProps) {
  const [activeId, setActiveId] = useState(categories[0]?.id);
  const active = categories.find((c) => c.id === activeId) ?? categories[0];
  if (!active) return null;

  return (
    <section
      id="menu"
      className="dfy-section dfy-menu dfy-menu--sidebar"
      style={{ padding: '6rem 1.5rem', background: 'var(--section-bg, var(--color-background))' }}
    >
      <style>{`
        .dfy-menu--sidebar .dfy-sidebar-rail { display: flex; }
        .dfy-menu--sidebar .dfy-sidebar-tabs { display: none; }
        @media (max-width: 768px) {
          .dfy-menu--sidebar .dfy-sidebar-rail { display: none; }
          .dfy-menu--sidebar .dfy-sidebar-tabs { display: flex; }
          .dfy-menu--sidebar .dfy-sidebar-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        <SectionHeader title={title} eyebrow={eyebrow} align="left" />

        <div
          className="dfy-sidebar-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: '220px 1fr',
            gap: '3rem',
            alignItems: 'start',
          }}
        >
          {/* Desktop rail */}
          <nav
            className="dfy-sidebar-rail"
            aria-label="Menu categories"
            style={{
              position: 'sticky',
              top: '88px',
              flexDirection: 'column',
              gap: '0.25rem',
            }}
          >
            {categories.map((cat) => {
              const isActive = cat.id === active.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveId(cat.id)}
                  aria-current={isActive ? 'true' : undefined}
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: '0.95rem',
                    fontWeight: isActive ? 600 : 500,
                    textAlign: 'left',
                    padding: '0.625rem 0.875rem',
                    borderRadius: 'var(--radius)',
                    border: 'none',
                    background: isActive
                      ? 'color-mix(in srgb, var(--color-text) 8%, transparent)'
                      : 'transparent',
                    color: 'inherit',
                    opacity: isActive ? 1 : 0.7,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    borderLeft: `2px solid ${isActive ? 'var(--color-accent)' : 'transparent'}`,
                  }}
                >
                  {cat.title}
                </button>
              );
            })}
          </nav>

          {/* Mobile tab strip (replaces rail under 768px) */}
          <div
            className="dfy-sidebar-tabs"
            role="tablist"
            style={{
              gap: '0.5rem',
              overflowX: 'auto',
              padding: '0 0 1rem',
              marginBottom: '1rem',
              borderBottom: '1px solid color-mix(in srgb, var(--color-text) 10%, transparent)',
              scrollbarWidth: 'none',
            }}
          >
            {categories.map((cat) => {
              const isActive = cat.id === active.id;
              return (
                <button
                  key={cat.id}
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveId(cat.id)}
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    padding: '0.5rem 1rem',
                    borderRadius: '999px',
                    border: '1px solid transparent',
                    background: isActive ? 'var(--color-accent)' : 'transparent',
                    color: isActive ? '#fff' : 'inherit',
                    opacity: isActive ? 1 : 0.7,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {cat.title}
                </button>
              );
            })}
          </div>

          {/* Selected category content */}
          <div role="tabpanel" aria-labelledby={active.id}>
            <h3
              style={{
                fontFamily: 'var(--font-heading)',
                fontSize: '1.75rem',
                margin: '0 0 0.5rem',
                letterSpacing: '-0.01em',
              }}
            >
              {active.title}
            </h3>
            {active.description && (
              <p
                style={{
                  fontStyle: 'italic',
                  fontSize: '0.95rem',
                  opacity: 0.65,
                  margin: '0 0 2rem',
                  fontFamily: 'var(--font-body)',
                }}
              >
                {active.description}
              </p>
            )}
            <ul style={{ listStyle: 'none', padding: 0, margin: '1.5rem 0 0' }}>
              {active.items.map((item) => (
                <ItemRow key={item.id} item={item} />
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
