'use client';

// Sticky bottom CTA bar shown only on mobile. Appears after the user scrolls
// past the hero so it doesn't compete with the hero's own buttons. Two
// actions: the primary "get my free website" link (to the lead form) and a
// quick way to book a call by email.

import { useEffect, useState } from 'react';

export function StickyMobileCta() {
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
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-ink-900/90 px-4 py-3 backdrop-blur-md transition-transform duration-300 lg:hidden ${
        show ? 'translate-y-0' : 'translate-y-full'
      }`}
    >
      <div className="flex items-center gap-3">
        <a
          href="#get-started"
          className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-amber-accent py-3 text-sm font-semibold text-ink-900 transition-colors hover:bg-[#d99a12]"
        >
          Request My Free Preview
        </a>
      </div>
    </div>
  );
}
