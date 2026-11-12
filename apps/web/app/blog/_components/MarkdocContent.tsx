import * as React from 'react';
import Markdoc, { type Node } from '@markdoc/markdoc';
import { transformMarkdoc } from '@/lib/marketing-blog/markdoc';
import { CtaBlock } from './CtaBlock';
import { Callout } from './Callout';

// Renders a post's Markdoc AST (from the Keystatic reader) to React on the
// server. Standard nodes become plain HTML tags styled by `.blog-prose`; the
// custom `Cta`/`Callout` Tag names map to our components here.
export function MarkdocContent({ node }: { node: Node }) {
  const renderable = transformMarkdoc(node);
  return (
    <div className="blog-prose">
      {Markdoc.renderers.react(renderable, React, {
        components: { Cta: CtaBlock, Callout },
      })}
    </div>
  );
}
