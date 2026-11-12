// Canonical CTA copy — the single source of truth for the product bridge that
// closes every post (BLOG_GUIDELINES §18, UNIVERSAL §22).
//
// Every claim here is verified against StoopCraft's authoritative landing-page
// copy (app/page.tsx): free custom preview usually within ~2 hours; launch for
// $99/mo with hosting, domain, unlimited edits, and support included; no card
// required; nothing owed if you walk away. It deliberately makes NO guarantee
// of rankings, leads, calls, or revenue (BLOG_GUIDELINES §4, §18).
//
// The CTA lives in one place so it never drifts and so we don't ship the
// "identical CTA paragraph across dozens of posts" anti-pattern by accident —
// the heading/body are shared, but each post reaches it through its own
// article-specific bridge paragraph written in the body.

export const CTA = {
  eyebrow: 'From StoopCraft',
  heading: 'See the website we’d build for your business',
  body: 'StoopCraft designs a custom website preview for your business — free, usually within about two hours. If you love it, launch for $99/mo with hosting, your own domain, unlimited edits, and real human support included. No card required, and nothing owed if you walk away.',
  buttonLabel: 'Get my free preview',
  /** Apex homepage lead form. Relative so it works from any /blog page. */
  href: '/#apply',
  /** Small reassurance line under the button. */
  footnote: 'No card required · Preview in ~2 hours · Cancel anytime',
} as const;
