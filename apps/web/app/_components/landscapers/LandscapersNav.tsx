'use client';

// Top navigation for the landscapers campaign LP. Light sibling of AgencyNav:
// the hero is light, so text stays charcoal throughout; on scroll the bar gains
// a white/blur background and a hairline. Green accent CTA. Hamburger on mobile.

import Link from 'next/link';
import { useEffect, useState } from 'react';

export function LandscapersNav({ showWork = true }: { showWork?: boolean }) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const links = [
    ...(showWork ? [{ href: '#work', label: 'Our work' }] : []),
    { href: '#process', label: 'How it works' },
    { href: '#pricing', label: 'Pricing' },
    { href: '#faq', label: 'FAQ' },
  ];

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
          ? 'border-b border-black/10 bg-white/85 backdrop-blur-md'
          : 'border-b border-transparent'
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2 font-display text-xl tracking-tight text-[#161616]">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-accent" />
          <span className="font-semibold">StoopCraft</span>
        </Link>

        <div className="hidden items-center gap-8 lg:flex">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="text-sm text-[#161616]/70 transition-colors hover:text-[#161616]">
              {l.label}
            </a>
          ))}
          <a
            href="#get-started"
            className="inline-flex items-center rounded-full bg-amber-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--accent-hover)]"
          >
            Request My Free Preview
          </a>
        </div>

        <button
          type="button"
          aria-label="Toggle menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-black/15 text-[#161616] lg:hidden"
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
        <div className="border-t border-black/10 bg-white/95 px-6 py-4 lg:hidden">
          <div className="flex flex-col gap-1">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setMenuOpen(false)}
                className="rounded-lg px-2 py-3 text-[#161616]/80 transition-colors hover:bg-black/[0.04] hover:text-[#161616]"
              >
                {l.label}
              </a>
            ))}
            <a
              href="#get-started"
              onClick={() => setMenuOpen(false)}
              className="mt-2 inline-flex items-center justify-center rounded-full bg-amber-accent px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--accent-hover)]"
            >
              Request My Free Preview
            </a>
          </div>
        </div>
      )}
    </nav>
  );
}
