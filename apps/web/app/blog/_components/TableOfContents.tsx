import type { TocItem } from '@/lib/marketing-blog/markdoc';

// "On this page" jump-link nav. Links to the slug ids the Markdoc renderer
// stamps on each H2/H3 (scroll-margin-top in .blog-prose keeps targets clear of
// the sticky header). Beyond UX, these anchors let Google surface in-page
// "jump to" links in search results. Skipped for short posts where it adds
// nothing.
export function TableOfContents({ items }: { items: TocItem[] }) {
  if (items.length < 3) return null;
  return (
    <nav
      aria-label="Table of contents"
      className="not-prose mb-10 rounded-2xl border border-ink-900/10 bg-white p-5 sm:p-6"
    >
      <p className="text-xs font-semibold uppercase tracking-wider text-ink-700/55">
        On this page
      </p>
      <ol className="mt-3 space-y-1.5 text-sm">
        {items.map((h, i) => (
          <li key={`${h.id}-${i}`} className={h.level === 3 ? 'ml-4' : ''}>
            <a
              href={`#${h.id}`}
              className={`text-ink-700 transition-colors hover:text-amber-accent hover:underline ${
                h.level === 2 ? 'font-medium' : 'text-ink-700/85'
              }`}
            >
              {h.text}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
