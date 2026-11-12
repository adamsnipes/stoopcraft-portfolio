// Fixed category taxonomy for the StoopCraft marketing blog.
//
// These map 1:1 to the topic clusters in BLOG_GUIDELINES.md §10 so the blog
// builds deliberate topical authority instead of a flat pile of posts. Each
// category gets its own hub page at /blog/category/<slug> (topical authority +
// orphan prevention, UNIVERSAL_BLOG_GUIDELINES §19–20).
//
// This is the single source of truth: keystatic.config.ts builds the post
// `category` select from it, and the routes/sitemap read from it. Adding a
// cluster here is the only edit needed to introduce a new category.

export type BlogCategory = {
  /** URL segment: /blog/category/<slug>. Stored in each post's frontmatter. */
  slug: string;
  /** Human label shown in UI, breadcrumbs, and JSON-LD. */
  label: string;
  /** One-line intro rendered on the category hub page (and its meta description). */
  description: string;
};

export const BLOG_CATEGORIES: readonly BlogCategory[] = [
  {
    slug: 'website-fundamentals',
    label: 'Website Fundamentals',
    description:
      'What every local-business website needs — pages, structure, trust signals, and the basics that turn visitors into calls, quotes, and bookings.',
  },
  {
    slug: 'industry-guides',
    label: 'Industry Guides',
    description:
      'Website playbooks tailored to specific trades and local businesses — roofers, HVAC, plumbers, restaurants, dentists, salons, and more.',
  },
  {
    slug: 'website-conversion',
    label: 'Website Conversion',
    description:
      'Why sites fail to generate calls and how to fix it — CTAs, quote forms, booking flows, mobile experience, and clear next steps.',
  },
  {
    slug: 'local-seo',
    label: 'Local SEO & Discovery',
    description:
      'How local businesses get found — Google Business Profile, local search, service-area pages, reviews, and the site-plus-GBP relationship.',
  },
  {
    slug: 'buying-decisions',
    label: 'Website Buying Decisions',
    description:
      'Costs, tradeoffs, and comparisons for local-business owners deciding how to get a website — DIY vs done-for-you, monthly vs upfront, and hiring a designer.',
  },
  {
    slug: 'launching-a-business',
    label: 'Launching & Growing',
    description:
      'Website checklists and guidance for opening, rebranding, or expanding a local business — from grand-opening prep to new service areas.',
  },
  {
    slug: 'trends',
    label: 'Trends & Timely',
    description:
      'Timely, evergreen-first takes on events and changes that affect local-business demand and how customers find you online.',
  },
] as const;

const CATEGORY_BY_SLUG = new Map(BLOG_CATEGORIES.map((c) => [c.slug, c]));

/** Look up a category by slug (undefined if it isn't a known category). */
export function getCategory(slug: string): BlogCategory | undefined {
  return CATEGORY_BY_SLUG.get(slug);
}

/** Valid category slugs — the default is the first entry. */
export const CATEGORY_SLUGS = BLOG_CATEGORIES.map((c) => c.slug);
// Non-null assertion: BLOG_CATEGORIES is a non-empty literal above, but
// noUncheckedIndexedAccess widens [0] to `| undefined`.
export const DEFAULT_CATEGORY_SLUG = BLOG_CATEGORIES[0]!.slug;
