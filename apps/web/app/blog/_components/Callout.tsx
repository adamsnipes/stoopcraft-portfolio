import type { ReactNode } from 'react';

// Styled aside for the {% callout %} Markdoc tag. Three intents, cobalt-family
// palette so it stays on-brand. `not-prose` opts out of blog-prose spacing.
const STYLES: Record<string, { wrap: string; label: string; heading: string }> = {
  note: {
    wrap: 'border-amber-accent/30 bg-amber-accent/5',
    label: 'text-amber-accent',
    heading: 'Note',
  },
  tip: {
    wrap: 'border-emerald-500/30 bg-emerald-500/5',
    label: 'text-emerald-700',
    heading: 'Tip',
  },
  warning: {
    wrap: 'border-amber-500/40 bg-amber-500/10',
    label: 'text-amber-700',
    heading: 'Heads up',
  },
};

export function Callout({
  type = 'note',
  title,
  children,
}: {
  type?: 'note' | 'tip' | 'warning';
  title?: string;
  children?: ReactNode;
}) {
  const style = STYLES[type] ?? STYLES.note!;
  return (
    <div className={`not-prose my-6 rounded-xl border-l-4 px-5 py-4 ${style.wrap}`}>
      <p className={`mb-1 text-xs font-semibold uppercase tracking-wider ${style.label}`}>
        {title || style.heading}
      </p>
      <div className="text-[0.95rem] leading-relaxed text-ink-800 [&_a]:text-amber-accent [&_a]:underline">
        {children}
      </div>
    </div>
  );
}
