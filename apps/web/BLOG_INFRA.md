# StoopCraft Blog — Infrastructure & Authoring Guide

The marketing blog at **stoopcraft.com/blog** is a git-based, Keystatic-modeled
content system. Content lives as Markdoc files in the repo and is rendered by
Next at request time. There is **no admin GUI** — a post is a file you write and
commit.

> Content quality is governed by the two root guideline files, which are
> mandatory: [`BLOG_GUIDELINES.md`](../../BLOG_GUIDELINES.md) (StoopCraft-specific)
> and [`UNIVERSAL_BLOG_GUIDELINES.md`](../../UNIVERSAL_BLOG_GUIDELINES.md).
> This file only covers the *mechanics*.

## Where things live

| Path | Purpose |
| --- | --- |
| `keystatic.config.ts` | The content **schema** (single source of truth for frontmatter fields). |
| `content/blog/<slug>/index.mdoc` | One post per folder. Frontmatter + Markdoc body. |
| `public/blog/covers/<slug>.webp` | Cover images (git-tracked; served statically). |
| `public/blog/inline/…` | Inline post images. |
| `lib/marketing-blog/` | Reader, data layer, Markdoc render config, SEO builders, CTA copy. |
| `lib/marketing-blog/categories.ts` | The fixed category taxonomy (topic clusters). |
| `app/blog/` | Routes: index, `[slug]`, `category/[category]`, `rss.xml`, shared layout. |
| `scripts/fetch-cover.mjs` | Download + optimize a Pexels/Unsplash cover. |

> ⚠️ **Images must live under `public/blog/`, never inside `content/blog/`.**
> The repo's `.gitignore` ignores `*.jpg` everywhere except `apps/web/public/**`,
> so a co-located cover would be silently untracked and 404 in production.

## Add a post

1. **Follow the guideline workflow first** (brief → research → intent → draft →
   sufficiency gate → fact-check). Don't start from a title.

2. **Pick a slug** (kebab-case, stable forever — it's the URL) and create:
   `content/blog/<slug>/index.mdoc`.

3. **Cover image** (optional but recommended). Find a topic-appropriate photo on
   Unsplash or Pexels, then:
   ```bash
   node scripts/fetch-cover.mjs "<image-url>" <slug>
   ```
   Record the attribution in `coverCredit`.

4. **Write frontmatter + body** (see template below).

5. **Preview locally**: `pnpm --filter web dev`, open `/blog/<slug>`. Drafts
   (`draft: true`) are visible in dev but excluded from the index, sitemap, RSS,
   related posts, and 404 in production.

6. **Validate**: `pnpm --filter web typecheck && pnpm --filter web build`.

7. **Commit** the `.mdoc` + any images. Sitemap and RSS update automatically.

## Post template (`content/blog/<slug>/index.mdoc`)

```markdoc
---
title: Your Specific, Accurate Title
description: A ~150–160 char meta description aligned to the primary query.
publishedDate: 2026-08-10
author: The StoopCraft Team
category: website-fundamentals
tags:
  - example-tag
cover: your-slug.webp
coverAlt: Descriptive alt text for the cover
coverCredit: Photo by Jane Doe on Unsplash
featured: false
draft: true
faqs:
  - question: A real question searchers ask?
    answer: A concise, useful answer.
---

Open with the reader's problem and a useful answer — no "In today's digital
landscape" filler. Body headings start at **H2** (the title is the only H1).

## A useful section

Short, scannable paragraphs. Lists where they genuinely help.

{% callout type="tip" %}
An optional aside for a tip, note, or warning.
{% /callout %}

Write your article-specific product bridge here, then let the closing CTA land.
A CTA block is **auto-appended to every post** — use `{% cta %}` only if you also
want one mid-article.
```

### Category values

Set `category` to one of the slugs in `lib/marketing-blog/categories.ts`
(`website-fundamentals`, `industry-guides`, `website-conversion`, `local-seo`,
`buying-decisions`, `launching-a-business`, `trends`). Each populated category
gets a hub page at `/blog/category/<slug>`.

## What's automated

- **CTA** — the verified product bridge (`lib/marketing-blog/cta.ts`) closes
  every post. Update it in one place; never hand-copy CTA paragraphs.
- **Related reading** — auto-derived from the same category (backfilled so no
  post is orphaned).
- **SEO** — per-post canonical, OpenGraph/Twitter, and JSON-LD
  (`BlogPosting` + `BreadcrumbList` + `FAQPage`) are generated from frontmatter.
  `sitemap.xml` and `/blog/rss.xml` regenerate from the content automatically.

## Not included (by design)

- No Keystatic admin GUI (it targets Next 14 / React 18; this is Next 16 /
  React 19). Editing = write the file.
- No auto-generated per-post OG images, city/service programmatic pages, or
  Search Console loop yet — layer on later if needed.
