import { parseSocialLinks } from '@/lib/tenant';
import type { SocialLink } from '@dfy/db';
import type { SectionProps } from '../types';

// ============================================================================
// Follow — high-prominence social CTA block.
//
// Service businesses (barbers, salons, lash artists) live and die by their
// Instagram/TikTok feed. The footer icon row is too muted to drive action;
// this section gives socials a dedicated stop with brand-colored buttons and
// the @handle pulled from each URL so it reads personal, not generic.
//
// Platforms with an empty URL render as non-clickable previews using the
// platform label — unclaimed sites still show what the section looks like so
// customers can picture it before filling in their real handles. Section
// visibility itself is controlled by the section `enabled` toggle.
// ============================================================================

const DEFAULT_PLATFORMS: SocialLink['platform'][] = ['tiktok', 'instagram', 'facebook'];

const PLATFORM_LABEL: Record<SocialLink['platform'], string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  twitter: 'X',
  linkedin: 'LinkedIn',
};

// Brand backgrounds keep each button visually distinct so visitors recognize
// the platform at a glance (matches the OrderingLinks treatment for restaurants).
// Instagram uses its full gradient since the flat pink reads weaker; the others
// have a single canonical brand color.
const PLATFORM_BG: Record<SocialLink['platform'], string> = {
  instagram:
    'linear-gradient(135deg, #f9ce34 0%, #ee2a7b 50%, #6228d7 100%)',
  facebook: '#1877f2',
  tiktok: '#000000',
  youtube: '#ff0000',
  twitter: '#000000',
  linkedin: '#0a66c2',
};

// Pull the human-readable handle out of a profile URL so the section can
// surface "@guzmanbarbershop" instead of a raw href. Falls back to the
// platform name when the URL doesn't fit a known shape (e.g. a Facebook
// vanity URL with multiple path segments).
function extractHandle(platform: SocialLink['platform'], url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/^\/+|\/+$/g, '');
    if (!path) return PLATFORM_LABEL[platform];
    // tiktok: /@handle  —  instagram/twitter/youtube: /handle
    const first = path.split('/')[0] ?? '';
    const stripped = first.startsWith('@') ? first.slice(1) : first;
    if (!stripped) return PLATFORM_LABEL[platform];
    // Facebook page IDs / numeric vanity slugs read worse than the platform
    // name — only show the handle when it looks like a real username.
    if (platform === 'facebook' && /^\d+$/.test(stripped)) return PLATFORM_LABEL[platform];
    return `@${stripped}`;
  } catch {
    return PLATFORM_LABEL[platform];
  }
}

function SocialIcon({ platform }: { platform: SocialLink['platform'] }) {
  // Larger than the footer icon (24 vs 18) so it carries the bigger button.
  const common = {
    width: 24,
    height: 24,
    viewBox: '0 0 24 24',
    fill: 'currentColor',
    'aria-hidden': true,
  } as const;
  switch (platform) {
    case 'facebook':
      return (
        <svg {...common}>
          <path d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.78-3.89 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.77l-.44 2.89h-2.33v6.99A10 10 0 0 0 22 12Z" />
        </svg>
      );
    case 'instagram':
      return (
        <svg {...common}>
          <path d="M12 2.16c3.2 0 3.58 0 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.22.06 1.27.07 1.65.07 4.86s0 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23a3.74 3.74 0 0 1-.9 1.38c-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58 0-4.85-.07c-1.17-.05-1.8-.25-2.23-.41a3.74 3.74 0 0 1-1.38-.9 3.74 3.74 0 0 1-.9-1.38c-.16-.42-.36-1.06-.41-2.23-.06-1.27-.07-1.65-.07-4.85s0-3.58.07-4.86c.05-1.16.25-1.8.41-2.22.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41 1.27-.06 1.65-.07 4.85-.07Zm0 5.34a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9Zm0 1.62a2.88 2.88 0 1 1 0 5.76 2.88 2.88 0 0 1 0-5.76Zm4.69-2.92a1.05 1.05 0 1 0 0 2.1 1.05 1.05 0 0 0 0-2.1Z" />
        </svg>
      );
    case 'tiktok':
      return (
        <svg {...common}>
          <path d="M19.6 6.3a4.8 4.8 0 0 1-2.7-1.2 4.8 4.8 0 0 1-1.4-2.7h-3v13a2.4 2.4 0 1 1-1.7-2.3v-3.1a5.5 5.5 0 1 0 4.8 5.4V9.6a7.7 7.7 0 0 0 4 1.2v-3a4.8 4.8 0 0 1 0 .5Z" />
        </svg>
      );
    case 'youtube':
      return (
        <svg {...common}>
          <path d="M22.5 8.1s-.2-1.5-.85-2.15c-.8-.85-1.7-.85-2.1-.9C16.5 4.8 12 4.8 12 4.8s-4.5 0-7.55.25c-.4.05-1.3.05-2.1.9C1.7 6.6 1.5 8.1 1.5 8.1S1.3 9.85 1.3 11.6v1.65c0 1.75.2 3.5.2 3.5s.2 1.5.85 2.15c.8.85 1.85.82 2.3.92 1.7.16 7.35.21 7.35.21s4.5-.01 7.55-.26c.4-.05 1.3-.05 2.1-.9.65-.65.85-2.15.85-2.15s.2-1.75.2-3.5V11.6c0-1.75-.2-3.5-.2-3.5Zm-12.6 7.13V8.78l5.85 3.23-5.85 3.22Z" />
        </svg>
      );
    case 'twitter':
      return (
        <svg {...common}>
          <path d="M18.9 4.5h2.94L14.7 12.7l8.4 11.05h-6.6L11.4 16.9l-5.9 6.85H2.55l7.65-8.78L2.1 4.5h6.78L13.8 11.1l5.1-6.6Zm-1.03 17.6h1.63L7.32 6.07H5.57l12.3 16.03Z" />
        </svg>
      );
    case 'linkedin':
      return (
        <svg {...common}>
          <path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9.5h4v11H3v-11Zm6.5 0H13v1.5h.05c.5-.9 1.7-1.85 3.5-1.85 3.75 0 4.45 2.45 4.45 5.65v5.7h-4v-5.05c0-1.2-.02-2.75-1.68-2.75-1.68 0-1.93 1.3-1.93 2.65v5.15h-4v-11Z" />
        </svg>
      );
  }
}

export function Follow({ content }: SectionProps) {
  const parsed = parseSocialLinks(content.social_links);
  // Ensure the default platforms always appear (even on legacy rows that
  // pre-date the tiktok default) so the section reads complete in preview.
  const byPlatform = new Map(parsed.map((l) => [l.platform, l]));
  for (const p of DEFAULT_PLATFORMS) {
    if (!byPlatform.has(p)) byPlatform.set(p, { platform: p, url: '' });
  }
  const socials = Array.from(byPlatform.values());

  return (
    <section
      id="follow"
      className="dfy-follow py-20 px-6"
      style={{ background: 'var(--section-bg, var(--color-background))' }}
    >
      <div className="max-w-3xl mx-auto text-center">
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '0.75rem',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--color-accent)',
            marginBottom: '0.75rem',
          }}
        >
          Stay in the loop
        </p>
        <h2
          className="text-3xl md:text-4xl font-bold mb-4"
          style={{
            fontFamily: 'var(--font-heading)',
            color: 'var(--color-text)',
          }}
        >
          Follow our latest work
        </h2>
        <p
          className="text-base mb-10"
          style={{ color: 'color-mix(in srgb, var(--color-text) 70%, transparent)' }}
        >
          See fresh photos, drops, and behind-the-scenes from the chair.
        </p>

        <div className="flex flex-wrap justify-center gap-3">
          {socials.map((s) => {
            const hasUrl = s.url.trim() !== '';
            const sharedClass =
              'inline-flex items-center gap-2.5 px-5 py-3 font-medium text-sm transition-all';
            const sharedStyle = {
              background: PLATFORM_BG[s.platform],
              color: '#ffffff',
              borderRadius: 'var(--radius)',
            };
            const label = hasUrl ? extractHandle(s.platform, s.url) : PLATFORM_LABEL[s.platform];
            return hasUrl ? (
              <a
                key={s.platform}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Follow on ${PLATFORM_LABEL[s.platform]}`}
                className={`${sharedClass} hover:-translate-y-0.5 hover:shadow-lg`}
                style={sharedStyle}
              >
                <SocialIcon platform={s.platform} />
                <span>{label}</span>
              </a>
            ) : (
              <span
                key={s.platform}
                aria-label={PLATFORM_LABEL[s.platform]}
                className={sharedClass}
                style={sharedStyle}
              >
                <SocialIcon platform={s.platform} />
                <span>{label}</span>
              </span>
            );
          })}
        </div>
      </div>
    </section>
  );
}
