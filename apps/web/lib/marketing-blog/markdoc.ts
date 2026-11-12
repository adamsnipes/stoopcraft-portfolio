import Markdoc, {
  type Config,
  type Node,
  type Schema,
  type RenderableTreeNodes,
} from '@markdoc/markdoc';
import { SITE_URL } from './config';

// ============================================================================
// Markdoc transform config for blog bodies.
//
// Standard nodes (p, ul, tables, code, …) fall through to their default HTML
// tags and are styled by the `.blog-prose` wrapper in globals.css. We customize
// only what needs behavior:
//   • headings  → get slug `id`s so sections are deep-linkable
//   • links     → external links get target=_blank + rel=noopener
//   • {% cta %} tag      → the shared product CTA block
//   • {% callout %} tag  → styled aside for tips/warnings
//
// Markdoc is safe by construction (no raw HTML/JS execution), so no separate
// sanitization pass is needed (UNIVERSAL §24, §40).
// ============================================================================

/** Kebab-case slug for heading anchors. */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

/** Flatten a node's descendant text (for heading ids). */
function collectText(node: Node): string {
  let text = '';
  for (const child of node.walk()) {
    if (child.type === 'text' && typeof child.attributes.content === 'string') {
      text += child.attributes.content;
    }
  }
  return text;
}

const heading: Schema = {
  children: ['inline'],
  attributes: {
    level: { type: Number, required: true },
    id: { type: String },
  },
  transform(node: Node, config: Config) {
    const attributes = node.transformAttributes(config);
    const children = node.transformChildren(config);
    const level = Number(node.attributes.level) || 2;
    const id = slugify(collectText(node));
    return new Markdoc.Tag(`h${level}`, { ...attributes, id }, children);
  },
};

const link: Schema = {
  children: ['inline'],
  attributes: {
    href: { type: String, required: true },
    title: { type: String },
  },
  transform(node: Node, config: Config) {
    const attributes = node.transformAttributes(config);
    const children = node.transformChildren(config);
    const href = String(node.attributes.href ?? '');
    const isExternal =
      /^https?:\/\//i.test(href) && !href.includes('stoopcraft.com');
    const extra = isExternal
      ? { target: '_blank', rel: 'noopener noreferrer' }
      : {};
    return new Markdoc.Tag('a', { ...attributes, ...extra }, children);
  },
};

// Custom tags render to Tag names that MarkdocContent maps to React components.
const cta: Schema = {
  render: 'Cta',
  selfClosing: true,
  attributes: {},
};

const callout: Schema = {
  render: 'Callout',
  children: ['paragraph', 'list', 'inline'],
  attributes: {
    type: {
      type: String,
      default: 'note',
      matches: ['note', 'tip', 'warning'],
    },
    title: { type: String },
  },
};

export const markdocConfig: Config = {
  nodes: { heading, link },
  tags: { cta, callout },
  variables: { siteUrl: SITE_URL },
};

/** Parse-free transform: reader already gives us the AST `node`. */
export function transformMarkdoc(node: Node): RenderableTreeNodes {
  return Markdoc.transform(node, markdocConfig);
}

export type TocItem = { level: 2 | 3; text: string; id: string };

/**
 * Walk the article AST and collect H2/H3 headings (with the same slug ids the
 * renderer stamps on them) to drive the on-page table of contents. Anchor links
 * to these ids are what let Google surface "jump to" links in the SERP.
 */
export function extractHeadings(node: Node): TocItem[] {
  const items: TocItem[] = [];
  for (const child of node.walk()) {
    if (child.type !== 'heading') continue;
    const level = Number(child.attributes.level);
    if (level !== 2 && level !== 3) continue;
    const text = collectText(child);
    if (text) items.push({ level, text, id: slugify(text) });
  }
  return items;
}
