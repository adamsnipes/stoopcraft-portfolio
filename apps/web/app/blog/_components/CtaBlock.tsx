import { CTA } from '@/lib/marketing-blog/cta';

// The product bridge that closes every post (auto-rendered by the post route)
// and can also be dropped mid-article via the {% cta %} Markdoc tag. Dark
// cobalt-accented card so it stands out against the light reading surface and
// echoes the homepage hero. `not-prose` keeps the blog-prose typography rules
// off it.
export function CtaBlock() {
  return (
    <aside className="not-prose relative my-14 overflow-hidden rounded-3xl border border-white/10 bg-ink-900 px-7 py-10 text-cream-50 sm:px-10 sm:py-12">
      <div
        aria-hidden
        className="glow-amber pointer-events-none absolute inset-0 opacity-70"
      />
      <div className="relative max-w-2xl">
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-amber-accent-soft">
          {CTA.eyebrow}
        </p>
        <h2 className="font-display text-2xl font-semibold leading-tight sm:text-3xl">
          {CTA.heading}
        </h2>
        <p className="mt-4 text-base leading-relaxed text-cream-100/85">
          {CTA.body}
        </p>
        <a
          href={CTA.href}
          className="group mt-7 inline-flex items-center justify-center gap-2 rounded-full bg-amber-accent px-7 py-3.5 text-sm font-semibold text-white shadow-[0_10px_30px_-12px_rgba(37,99,235,0.9)] transition-colors hover:bg-[#1d4ed8]"
        >
          {CTA.buttonLabel}
          <span aria-hidden className="transition-transform group-hover:translate-x-0.5">
            →
          </span>
        </a>
        <p className="mt-4 text-xs text-cream-100/55">{CTA.footnote}</p>
      </div>
    </aside>
  );
}
