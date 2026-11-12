'use client';

import { useState } from 'react';

type RepTemplate = {
  key: string;
  channel: 'sms' | 'email' | 'dm';
  title: string;
  body: string;
};

type AffiliateTemplate = {
  key: string;
  // Tagged variant: each affiliate template gets a utm_source baked into the
  // link so per-channel attribution lights up in the funnel breakdown.
  channel: 'twitter' | 'youtube' | 'instagram' | 'blog' | 'newsletter' | 'discord' | 'tiktok';
  title: string;
  body: string;
};

type Template = RepTemplate | AffiliateTemplate;

function tag(refLink: string, source: string): string {
  return `${refLink}?utm_source=${source}`;
}

function buildRepTemplates(refLink: string, repName: string): RepTemplate[] {
  const me = repName || 'a friend';
  return [
    {
      key: 'sms-cold',
      channel: 'sms',
      title: 'SMS — cold intro to a local business',
      body: `Hey — saw your shop online and noticed you don't have a website (or yours is from 2014). I'm with Stoopcraft; we can spin up a real site for you in under 60 seconds, free to preview: ${refLink}`,
    },
    {
      key: 'sms-followup',
      channel: 'sms',
      title: 'SMS — follow-up after an in-person convo',
      body: `Hey, nice meeting you. Here's the link I mentioned — type your business name and the preview generates on the spot. No card, no signup: ${refLink}`,
    },
    {
      key: 'email-cold',
      channel: 'email',
      title: 'Email — cold pitch',
      body: `Hi,

I run partnerships with Stoopcraft. We help local shops get a real, modern website live in a single click — no designer, no setup fee. $99/mo all-in: hosting, edits, domain.

If you want to see what yours would look like, here's the link to generate a free preview (takes about a minute, no signup):

${refLink}

If it's not for you, no worries — just figured you'd want to see it.

— ${me}`,
    },
    {
      key: 'dm-instagram',
      channel: 'dm',
      title: 'Instagram DM — short and friendly',
      body: `Hey! Your feed is great. We built a tool that turns a business name into a full website in ~60 seconds — thought yours would look really good with one. Free to preview, no signup: ${refLink}`,
    },
    {
      key: 'sms-warm',
      channel: 'sms',
      title: 'SMS — to a prospect who said "let me think"',
      body: `Hey, no pressure — just sending the preview link again so it doesn't get lost: ${refLink}. Takes 60 seconds and you can keep the URL even if you don't buy.`,
    },
  ];
}

function buildAffiliateTemplates(refLink: string): AffiliateTemplate[] {
  return [
    {
      key: 'twitter-short',
      channel: 'twitter',
      title: 'Twitter / X — short post',
      body: `If you run a local business and you still don't have a website (or yours is from 2014), this is the easiest fix on the internet. Type your business name → full site live in 60 seconds. $99/mo, no setup, no designer.

${tag(refLink, 'twitter')}`,
    },
    {
      key: 'twitter-thread',
      channel: 'twitter',
      title: 'Twitter / X — thread opener',
      body: `Most local businesses still don't have a real website. Not a Facebook page. Not a Yelp listing. A real one.

Stoopcraft fixes that in 60 seconds. Type the business name, the AI builds the whole site — hero, services, gallery, contact, the works.

$99/mo all-in (hosting + domain + edits). Watch:

${tag(refLink, 'twitter')}`,
    },
    {
      key: 'youtube-description',
      channel: 'youtube',
      title: 'YouTube — video description',
      body: `🔗 Stoopcraft (try it free — type your business name, full site generates in 60 seconds):
${tag(refLink, 'youtube')}

What it is:
A done-for-you website builder for local businesses. Type your business name, pick your shop on Google, get a real custom site live in under a minute. $99/mo all-in — hosting, domain, edits included.

Disclosure: this link is a referral — I get a small cut if you sign up. Doesn't cost you anything extra and it helps support this channel.`,
    },
    {
      key: 'instagram-caption',
      channel: 'instagram',
      title: 'Instagram — caption + bio link',
      body: `If you run a local business and your "website" is a Facebook page, watch this 👇

Stoopcraft builds you a real site in 60 seconds — hero, gallery, services, contact form, the works. $99/mo all-in.

Free preview link in my bio (or DM me).

${tag(refLink, 'instagram')}

#smallbusiness #localbusiness #website`,
    },
    {
      key: 'tiktok-caption',
      channel: 'tiktok',
      title: 'TikTok — caption',
      body: `if you own a barbershop / salon / restaurant / shop and your website is still a facebook page, fix it in 60 seconds 👇 link in bio

${tag(refLink, 'tiktok')}`,
    },
    {
      key: 'blog-intro',
      channel: 'blog',
      title: 'Blog post — intro paragraph',
      body: `If you've ever helped a local business owner with their "website" — meaning their Facebook page, their Yelp listing, or a five-year-old Wix draft they never finished — you know the problem. Building a real site costs them either money they don't have (designer + dev) or time they don't have (DIY). Most just give up.

Stoopcraft is the first tool I've seen that actually solves this. You type the business name, it pulls everything from Google — photos, address, hours, reviews — and builds a full custom site in under a minute. Hosting, domain, and edits included for $99/mo. Here's the preview link (it's free to generate, you don't even need to sign up):

${tag(refLink, 'blog')}

*Disclosure: this is a referral link. I get a small commission if you sign up. Doesn't cost you anything.*`,
    },
    {
      key: 'newsletter-blurb',
      channel: 'newsletter',
      title: 'Newsletter — paid section blurb',
      body: `**A tool I keep recommending: Stoopcraft.** It builds a complete website for a local business in about 60 seconds. You type the business name, it pulls the photos / hours / address from Google, and generates a real site — hero, gallery, services, contact form. $99/mo all-in (hosting + domain + portal for edits). I've sent half a dozen friends to it. Free preview:

${tag(refLink, 'newsletter')}`,
    },
    {
      key: 'discord-plug',
      channel: 'discord',
      title: 'Discord / Slack — community plug',
      body: `If anyone here runs a local business or knows someone who does — Stoopcraft generates a full website from just the business name in like 60 seconds. Pulls everything from Google. $99/mo all-in, includes hosting + domain + edits.

Free to preview, no signup: ${tag(refLink, 'discord')}`,
    },
  ];
}

export function OutreachTemplates({
  refLink,
  repName,
  kind = 'rep',
}: {
  refLink: string;
  repName: string;
  kind?: 'rep' | 'affiliate';
}) {
  const templates: Template[] =
    kind === 'affiliate' ? buildAffiliateTemplates(refLink) : buildRepTemplates(refLink, repName);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  async function copy(t: Template) {
    try {
      await navigator.clipboard.writeText(t.body);
      setCopiedKey(t.key);
      setTimeout(() => setCopiedKey((k) => (k === t.key ? null : k)), 1500);
    } catch {
      // Permissions denied — best-effort silent fail; user can manually
      // select + copy.
    }
  }

  return (
    <div className="space-y-3">
      {templates.map((t) => (
        <div key={t.key} className="bg-white border border-ink-900/10 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-display tracking-tight">{t.title}</div>
              <div className="text-xs uppercase tracking-wider text-ink-700/60 mt-0.5">
                {t.channel}
              </div>
            </div>
            <button
              onClick={() => copy(t)}
              className="bg-ink-900 text-cream-50 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-ink-800"
            >
              {copiedKey === t.key ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <textarea
            readOnly
            value={t.body}
            className="w-full border border-ink-900/10 rounded-lg px-3 py-2 bg-cream-50 text-sm font-mono whitespace-pre-wrap min-h-[140px]"
          />
        </div>
      ))}
    </div>
  );
}
