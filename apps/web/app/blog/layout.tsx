import Link from 'next/link';
import { getActiveCategories } from '@/lib/marketing-blog/posts';
import { categoryUrl } from '@/lib/marketing-blog/config';
import { CTA } from '@/lib/marketing-blog/cta';

// Shared chrome for every /blog route: a slim sticky header (home link + CTA)
// and a footer with real internal links. This is what keeps blog pages from
// being orphaned (UNIVERSAL §20) and gives every article a persistent path back
// to the product.
export default async function BlogLayout({ children }: { children: React.ReactNode }) {
  const categories = await getActiveCategories();
  const year = new Date().getFullYear();

  return (
    <div className="flex min-h-screen flex-col bg-cream-50">
      <header className="sticky top-0 z-40 border-b border-ink-900/10 bg-cream-50/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
          <Link href="/" className="flex items-center gap-2 font-display text-lg font-semibold tracking-tight text-ink-900">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-accent" />
            StoopCraft
          </Link>
          <div className="flex items-center gap-5">
            <Link href="/blog" className="text-sm font-medium text-ink-700 transition-colors hover:text-ink-900">
              Blog
            </Link>
            <a
              href={CTA.href}
              className="inline-flex items-center rounded-full bg-amber-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#1d4ed8]"
            >
              {CTA.buttonLabel}
            </a>
          </div>
        </div>
      </header>

      <div className="flex-1">{children}</div>

      <footer className="mt-auto bg-ink-900 text-cream-100/70">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-14 sm:grid-cols-[1.6fr_1fr_1fr]">
          <div>
            <Link href="/" className="flex items-center gap-2 font-display text-lg font-semibold text-cream-50">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-accent" />
              StoopCraft
            </Link>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-cream-100/60">
              We build your website first. Launch it for $99/mo — hosting, domain, edits, and
              support included. Pay only if you love it.
            </p>
            <a
              href={CTA.href}
              className="mt-5 inline-flex items-center rounded-full bg-amber-accent px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1d4ed8]"
            >
              {CTA.buttonLabel}
            </a>
          </div>

          <nav aria-label="Company">
            <p className="text-xs font-semibold uppercase tracking-wider text-cream-100/40">StoopCraft</p>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li><Link href="/" className="transition-colors hover:text-cream-50">Home</Link></li>
              <li><a href="/#work" className="transition-colors hover:text-cream-50">Our work</a></li>
              <li><a href="/#pricing" className="transition-colors hover:text-cream-50">Pricing</a></li>
              <li><Link href="/login" className="transition-colors hover:text-cream-50">Customer portal</Link></li>
            </ul>
          </nav>

          <nav aria-label="Blog">
            <p className="text-xs font-semibold uppercase tracking-wider text-cream-100/40">Blog</p>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li><Link href="/blog" className="transition-colors hover:text-cream-50">All articles</Link></li>
              {categories.slice(0, 4).map((c) => (
                <li key={c.slug}>
                  <Link href={categoryUrl(c.slug)} className="transition-colors hover:text-cream-50">
                    {c.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="border-t border-white/10">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-6 text-xs text-cream-100/45 sm:flex-row">
            <span>© {year} StoopCraft. All rights reserved.</span>
            <div className="flex gap-5">
              <Link href="/privacy" className="transition-colors hover:text-cream-50">Privacy</Link>
              <Link href="/terms" className="transition-colors hover:text-cream-50">Terms</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
