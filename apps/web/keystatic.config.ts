import { config, collection, fields } from '@keystatic/core';
import { BLOG_CATEGORIES, DEFAULT_CATEGORY_SLUG } from './lib/marketing-blog/categories';

// ============================================================================
// Keystatic — StoopCraft marketing blog (stoopcraft.com/blog)
// ----------------------------------------------------------------------------
// Content-layer-only setup: this file is the single source of truth for the
// blog's content SCHEMA. Posts are authored as Markdoc files under
// content/blog/<slug>/index.mdoc and read at request time via the Reader API
// (@keystatic/core/reader) in lib/marketing-blog/. We deliberately do NOT mount
// the Keystatic Admin UI (it targets Next 14 / React 18; this app is a
// customized Next 16 / React 19 build). Editing = write the .mdoc file + commit.
//
// IMPORTANT (gitignore): `*.jpg` is globally ignored except under
// apps/web/public/**. So every image field stores into public/blog/** — NOT
// co-located in the content folder, where covers would be silently untracked.
// ============================================================================

export default config({
  // Local storage: content lives in this repo as flat files, committed to git.
  storage: { kind: 'local' },
  ui: {
    brand: { name: 'StoopCraft Blog' },
  },
  collections: {
    posts: collection({
      label: 'Blog posts',
      slugField: 'title',
      // Folder-per-post keeps each article self-contained and avoids a
      // hundreds-of-files flat directory as the blog scales.
      path: 'content/blog/*/',
      format: { contentField: 'content' },
      entryLayout: 'content',
      columns: ['title', 'publishedDate'],
      schema: {
        title: fields.slug({
          name: {
            label: 'Title',
            description: 'The H1 and <title>. Specific and accurate (BLOG_GUIDELINES §16).',
            validation: { length: { min: 1, max: 120 } },
          },
          slug: {
            label: 'URL slug',
            description: 'The path: /blog/<slug>. Never change after publishing (breaks links & rankings).',
          },
        }),
        description: fields.text({
          label: 'Meta description',
          description:
            'Search-result snippet, ~150–160 chars. Aligned to the primary query (UNIVERSAL §17). Reads like a useful snippet, not keyword stuffing.',
          multiline: true,
          validation: { length: { min: 1, max: 220 } },
        }),
        publishedDate: fields.date({
          label: 'Published date',
          validation: { isRequired: true },
          defaultValue: { kind: 'today' },
        }),
        updatedDate: fields.date({
          label: 'Last updated',
          description: 'Only set when the article is MATERIALLY improved — never to fake freshness (UNIVERSAL §23).',
        }),
        author: fields.text({
          label: 'Author byline',
          defaultValue: 'The StoopCraft Team',
        }),
        category: fields.select({
          label: 'Category',
          description: 'Topic cluster (BLOG_GUIDELINES §10). Drives the category hub + related posts.',
          options: BLOG_CATEGORIES.map((c) => ({ label: c.label, value: c.slug })),
          defaultValue: DEFAULT_CATEGORY_SLUG,
        }),
        tags: fields.array(fields.text({ label: 'Tag' }), {
          label: 'Tags',
          description: 'Optional. Freeform keywords for internal grouping.',
          itemLabel: (props) => props.value,
        }),
        cover: fields.image({
          label: 'Cover image',
          description:
            'Sourced from Pexels/Unsplash and optimized via scripts/fetch-cover.mjs. Stored under public/blog/covers.',
          directory: 'public/blog/covers',
          publicPath: '/blog/covers/',
        }),
        coverAlt: fields.text({
          label: 'Cover alt text',
          description: 'Natural, descriptive — no keyword stuffing (UNIVERSAL §29).',
        }),
        coverCredit: fields.text({
          label: 'Cover credit',
          description: 'Photographer + source attribution, e.g. "Photo by Jane Doe on Unsplash".',
        }),
        featured: fields.checkbox({
          label: 'Featured',
          description: 'Surfaces the post at the top of the blog index.',
          defaultValue: false,
        }),
        draft: fields.checkbox({
          label: 'Draft',
          description: 'Hidden from the index, sitemap, RSS, and related posts. Direct URL 404s in production.',
          defaultValue: false,
        }),
        canonicalUrl: fields.url({
          label: 'Canonical URL override',
          description: 'Leave blank to self-canonicalize to /blog/<slug> (the default and correct choice for original posts).',
        }),
        faqs: fields.array(
          fields.object({
            question: fields.text({ label: 'Question' }),
            answer: fields.text({ label: 'Answer', multiline: true }),
          }),
          {
            label: 'FAQs',
            description: 'Optional. Rendered on-page AND emitted as FAQPage structured data (UNIVERSAL §28). Only real, useful Q&A.',
            itemLabel: (props) => props.fields.question.value || 'FAQ',
          }
        ),
        content: fields.markdoc({
          label: 'Body',
          description:
            'Markdoc. One H1 comes from the title — start body headings at H2. A CTA is auto-appended; use {% cta %} for an extra inline CTA.',
          options: {
            image: {
              directory: 'public/blog/inline',
              publicPath: '/blog/inline/',
            },
          },
        }),
      },
    }),
  },
});
