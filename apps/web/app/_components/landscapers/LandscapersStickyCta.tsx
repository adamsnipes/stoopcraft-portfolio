'use client';

// Sticky bottom CTA bar shown only on mobile for the landscapers LP. Light
// sibling of the agency StickyMobileCta. Appears after the user scrolls past
// the hero so it doesn't compete with the hero's own form.

import { useEffect, useState } from 'react';

export function LandscapersStickyCta() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    function onScroll() {
      setShow(window.scrollY > 600);
    }
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-black/10 bg-white/90 px-4 py-3 backdrop-blur-md transition-transform duration-300 lg:hidden ${
        show ? 'translate-y-0' : 'translate-y-full'
      }`}
    >
      <a
        href="#get-started"
        className="flex items-center justify-center gap-1.5 rounded-full bg-amber-accent py-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--accent-hover)]"
      >
        Request My Free Preview
      </a>
    </div>
  );
}
