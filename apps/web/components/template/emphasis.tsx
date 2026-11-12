import type { ReactNode } from 'react';

type EmphasisOptions = {
  italic?: boolean;
  accentColor?: boolean;
};

/**
 * Render `text` and italicize the first case-insensitive occurrence of
 * `emphasis` if it appears in the text. Falls back to plain text when the
 * emphasis word is missing or doesn't match.
 */
export function renderEmphasized(
  text: string,
  emphasis: string | null | undefined,
  opts: EmphasisOptions = {},
): ReactNode {
  if (!emphasis) return text;

  const trimmed = emphasis.trim();
  if (trimmed.length === 0) return text;

  const lower = text.toLowerCase();
  const idx = lower.indexOf(trimmed.toLowerCase());
  if (idx < 0) return text;

  const before = text.slice(0, idx);
  const match = text.slice(idx, idx + trimmed.length);
  const after = text.slice(idx + trimmed.length);

  return (
    <>
      {before}
      <span
        style={{
          fontStyle: opts.italic ? 'italic' : undefined,
          color: opts.accentColor ? 'var(--color-accent)' : undefined,
          fontWeight: 'inherit',
        }}
      >
        {match}
      </span>
      {after}
    </>
  );
}
