import Link from 'next/link';

// Visible breadcrumb trail. The matching BreadcrumbList JSON-LD is emitted
// separately by each route via lib/marketing-blog/seo.ts (§28, §20).
//
// `tone` adapts the colors to the surface: "dark" for light backgrounds (the
// post header), "light" for the dark mastheads (index + category).
export function Breadcrumbs({
  items,
  tone = 'dark',
}: {
  items: { name: string; href?: string }[];
  tone?: 'dark' | 'light';
}) {
  const styles =
    tone === 'light'
      ? { nav: 'text-cream-100/75', link: 'hover:text-white', sep: 'text-cream-100/40', current: 'text-cream-50' }
      : { nav: 'text-ink-700/70', link: 'hover:text-amber-accent', sep: 'text-ink-700/40', current: 'text-ink-700' };

  return (
    <nav aria-label="Breadcrumb" className={`text-xs ${styles.nav}`}>
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <li key={i} className="flex items-center gap-1.5">
              {item.href && !last ? (
                <Link href={item.href} className={styles.link}>
                  {item.name}
                </Link>
              ) : (
                <span className={last ? styles.current : ''} aria-current={last ? 'page' : undefined}>
                  {item.name}
                </span>
              )}
              {!last && <span aria-hidden className={styles.sep}>/</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
