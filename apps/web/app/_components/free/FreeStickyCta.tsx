'use client';

// Sticky bottom CTA for the /free-website LP. Mobile only, and only once the
// visitor has scrolled past the hero form so it never competes with the form
// itself. Points at the CLOSING form (#apply-2) rather than the hero one so a
// tap always scrolls down the page instead of yanking the visitor back to the
// top. Light sibling of StickyMobileCta.

import { useEffect, useState } from 'react';

export function FreeStickyCta() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    function onScroll() {
      setShow(window.scrollY > 700);
    }
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-black/[0.07] bg-white/95 px-4 py-3 backdrop-blur-md transition-transform duration-300 lg:hidden ${
        show ? 'translate-y-0' : 'translate-y-full'
      }`}
    >
      <a
        href="#apply-2"
        className="flex items-center justify-center gap-1.5 rounded-full bg-amber-accent py-3.5 text-sm font-semibold text-[var(--accent-ink)] transition-colors hover:bg-[var(--accent-hover)]"
      >
        Apply in 2 minutes. Get your free website.
      </a>
    </div>
  );
}
