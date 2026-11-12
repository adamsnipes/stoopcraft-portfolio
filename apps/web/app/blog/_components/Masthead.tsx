import type { ReactNode } from 'react';
import { Breadcrumbs } from './Breadcrumbs';

// Dark hero band shared by the blog index and category hubs. A golden-hour
// main-street photo sits behind a left-to-right dark scrim (keeps left-aligned
// white text fully legible) plus a bottom fade into the page and a subtle
// cobalt glow. Breadcrumbs use the light tone so they read on the dark surface.
export function BlogMasthead({
  breadcrumbs,
  children,
}: {
  breadcrumbs: { name: string; href?: string }[];
  children: ReactNode;
}) {
  return (
    <header className="relative overflow-hidden bg-ink-900 text-cream-50">
      {/* Background photo (decorative) */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/blog/covers/masthead.webp"
          alt=""
          className="h-full w-full object-cover object-[center_32%] opacity-55"
        />
      </div>
      {/* Legibility scrims */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-r from-ink-900 via-ink-900/85 to-ink-900/30"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-ink-900 to-transparent"
      />
      <div aria-hidden className="glow-amber pointer-events-none absolute inset-0 opacity-30" />

      <div className="relative mx-auto max-w-5xl px-6 pb-16 pt-16 sm:pt-24">
        <Breadcrumbs tone="light" items={breadcrumbs} />
        {children}
      </div>
    </header>
  );
}
