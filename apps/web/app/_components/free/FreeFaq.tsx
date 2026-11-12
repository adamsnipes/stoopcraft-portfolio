'use client';

// FAQ accordion for the /free-website LP. Light sibling of FaqAccordion.
//
// Ordered by objection strength, not by topic: the "is it really free / what's
// the catch" pair leads because that is what a cold visitor stalls on, and the
// price answer sits third and expands on the price already shown in the hero.
// Single-open behaviour, first item open on load.

import { useState } from 'react';

const FAQS: { q: string; a: string }[] = [
  {
    q: 'Is the website really free to build?',
    a: 'Yes. The design, the copywriting, and the build are all free, and you see the finished site before you commit to anything. There is no card, no deposit, and no invoice at the end. If you look at what we made and pass, you pass. You owe nothing.',
  },
  {
    q: "So what's the catch?",
    a: "There isn't a hidden one, but there is a business model. We build the site for free and make our money on the monthly plan that keeps it live: hosting, your domain, security, and unlimited edits whenever you need them. That plan is $99/month, and you only activate it if you love the preview. If you launch, we earn. If you don't, we spent a few hours and you keep the goodwill. That's the whole arrangement.",
  },
  {
    q: 'What does the $99/month cover?',
    a: 'Everything needed to keep your site online and looked after: hosting, SSL, your own custom domain, unlimited text and photo edits, ongoing updates, and a real person to email. No setup fee, no contract, cancel any time.',
  },
  {
    q: 'How fast do I see it?',
    a: 'Within 2 hours of your application, in most cases. You get a live preview link you can open on your phone. Tell us what to change and we keep revising. Revisions are included, and there is no limit on the free round.',
  },
  {
    q: 'Do I need to know anything technical?',
    a: "No. Most of the owners we build for have never had a website made before. You send us your business name and whatever you already have, whether that's a Google listing, a Facebook page, or a few photos, and we handle the design, the writing, the domain, and the hosting. Nothing to install, nothing to configure.",
  },
  {
    q: 'What if I already have a website?',
    a: "We'll rebuild it, and you can compare the two side by side before you switch anything. Your existing site stays up and untouched until you say go.",
  },
  {
    q: 'Do I own the site?',
    a: "Your domain is always yours and transfers to you at no cost, regardless of how long you've been with us. Your monthly plan includes a hosted website. If you want the site files to host elsewhere, we hand them over free after six months. Before six months, that optional file transfer costs $499 on the $99/month plan. This is only a fee for taking the files with you, not for cancelling your subscription.",
  },
  {
    q: 'What if I want out later?',
    a: 'Cancel any time from your account with no cancellation fee or minimum term. Your site stays live until the end of your paid billing period, then goes offline. You owe no $499 fee just for cancelling. That fee applies only if you choose to take the site files to another host before six months; file transfers are free after six months.',
  },
];

export function FreeFaq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="divide-y divide-black/[0.07] overflow-hidden rounded-3xl border border-black/[0.07] bg-white text-[#15120c]">
      {FAQS.map((faq, i) => {
        const isOpen = open === i;
        return (
          <div key={faq.q}>
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : i)}
              aria-expanded={isOpen}
              className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left transition-colors hover:bg-[var(--surface-inset)] sm:px-8"
            >
              <span className="font-display text-[1.05rem] font-semibold tracking-[-0.01em] text-[#15120c]">{faq.q}</span>
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-black/12 text-[#15120c] transition-transform duration-300 ${
                  isOpen ? 'rotate-45 border-transparent bg-amber-accent text-[var(--accent-ink)]' : ''
                }`}
              >
                <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none">
                  <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </span>
            </button>
            <div
              className={`grid transition-all duration-300 ease-out ${
                isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
              }`}
            >
              <div className="overflow-hidden">
                <p className="max-w-2xl px-6 pb-6 text-[15px] leading-relaxed text-[#15120c]/65 sm:px-8 sm:pb-7">
                  {faq.a}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
