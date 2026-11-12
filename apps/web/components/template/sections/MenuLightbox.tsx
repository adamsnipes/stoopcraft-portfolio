'use client';

import { useEffect, useState } from 'react';

// ============================================================================
// MenuLightbox — wraps the menu dispatcher output and pops up any clicked
// menu-item photo as a full-screen overlay so visitors can see the dish
// without squinting at thumbnail-sized thumbnails.
//
// Implemented via event delegation rather than wiring an onClick on every
// individual <img>: each composition (server or client) just stamps
// `data-menu-img` on the photos it wants enlargeable. The wrapper catches the
// bubbled click, reads the attribute, and shows the overlay. This keeps the
// server compositions in Menu.tsx fully server-rendered and avoids passing
// callbacks across the server/client boundary.
// ============================================================================

export function MenuLightbox({ children }: { children: React.ReactNode }) {
  const [src, setSrc] = useState<string | null>(null);
  const [alt, setAlt] = useState<string>('');

  // Esc closes the overlay; backdrop click closes too. We don't lock scroll —
  // the overlay is full-viewport so the page underneath can't bleed through,
  // and locking would cause a visible reflow (scrollbar disappear).
  useEffect(() => {
    if (!src) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSrc(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [src]);

  function handleClick(e: React.MouseEvent) {
    // closest() walks up from the click target so a click on the inner <img>
    // hits the wrapping element that carries `data-menu-img` (or the img
    // itself if it has the attribute directly).
    const el = (e.target as HTMLElement | null)?.closest?.('[data-menu-img]');
    if (!(el instanceof HTMLElement)) return;
    const url = el.dataset['menuImg'];
    if (!url) return;
    e.preventDefault();
    e.stopPropagation();
    const altText = el.getAttribute('data-menu-img-alt') ?? '';
    setSrc(url);
    setAlt(altText);
  }

  return (
    <>
      <div onClick={handleClick}>{children}</div>
      {src && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Menu photo"
          onClick={() => setSrc(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem',
            cursor: 'zoom-out',
            animation: 'dfyMenuLightboxIn 0.15s ease-out',
          }}
        >
          <style>{`
            @keyframes dfyMenuLightboxIn {
              from { opacity: 0; }
              to { opacity: 1; }
            }
          `}</style>
          <img
            src={src}
            alt={alt}
            // Click on the image itself shouldn't close (only the backdrop
            // does), so visitors can pinch / zoom without dismissing.
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
              borderRadius: '0.5rem',
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
              cursor: 'default',
            }}
          />
          <button
            type="button"
            onClick={() => setSrc(null)}
            aria-label="Close"
            style={{
              position: 'absolute',
              top: '1rem',
              right: '1rem',
              width: '40px',
              height: '40px',
              borderRadius: '999px',
              border: 'none',
              background: 'rgba(255,255,255,0.15)',
              color: '#fff',
              fontSize: '1.5rem',
              lineHeight: 1,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ×
          </button>
        </div>
      )}
    </>
  );
}
