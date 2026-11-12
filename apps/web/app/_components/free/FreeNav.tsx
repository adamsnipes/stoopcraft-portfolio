'use client';

// Top navigation for the /free-website funnel LP. Light sibling of AgencyNav:
// the whole page is white, so the bar stays transparent over the hero and gains
// a white/blur backdrop plus a hairline once scrolled. Deliberately shorter
// than the homepage nav — every extra link on a paid-traffic LP is an exit.

import Link from 'next/link';
import { useEffect, useState } from 'react';

const LINKS = [
  { href: '#work', label: 'Our work' },
  { href: '#how', label: 'How it works' },
  { href: '#why-free', label: "What's the catch?" },
  { href: '#faq', label: 'FAQ' },
];

export function FreeNav() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 24);
    }
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${
        scrolled || menuOpen
          ? 'border-b border-black/[0.07] bg-white/90 backdrop-blur-md'
          : 'border-b border-transparent'
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex shrink-0 items-center gap-2 font-display text-xl font-bold tracking-[-0.02em] text-[#15120c]">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-accent" />
          <span className="font-semibold">StoopCraft</span>
        </Link>

        <div className="hidden items-center gap-7 lg:flex">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="whitespace-nowrap text-sm text-[#15120c]/65 transition-colors hover:text-[#15120c]"
            >
              {l.label}
            </a>
          ))}
          <a
            href="#apply"
            className="inline-flex shrink-0 items-center whitespace-nowrap rounded-full bg-amber-accent px-4 py-2 text-sm font-semibold text-[var(--accent-ink)] transition-colors hover:bg-[var(--accent-hover)]"
          >
            Apply in 2 minutes
          </a>
        </div>

        <button
          type="button"
          aria-label="Toggle menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-black/15 text-[#15120c] lg:hidden"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
            {menuOpen ? (
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            ) : (
              <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            )}
          </svg>
        </button>
      </div>

      {menuOpen && (
        <div className="border-t border-black/[0.07] bg-white/97 px-6 py-4 lg:hidden">
          <div className="flex flex-col gap-1">
            {LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setMenuOpen(false)}
                className="rounded-lg px-2 py-3 text-[#15120c]/80 transition-colors hover:bg-black/[0.03] hover:text-[#15120c]"
              >
                {l.label}
              </a>
            ))}
            <a
              href="#apply"
              onClick={() => setMenuOpen(false)}
              className="mt-2 inline-flex items-center justify-center rounded-full bg-amber-accent px-4 py-3 text-sm font-semibold text-[var(--accent-ink)] transition-colors hover:bg-[var(--accent-hover)]"
            >
              Apply in 2 minutes
            </a>
          </div>
        </div>
      )}
    </nav>
  );
}
