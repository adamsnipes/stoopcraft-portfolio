'use client';

// FAQ accordion for the landscapers campaign LP. Light sibling of the agency
// FaqAccordion (which is styled for the dark homepage). Same single-open
// behavior; content is tuned to speak to landscaping / lawn-care owners while
// keeping the offer identical to the main site.

import { useState } from 'react';

const FAQS: { q: string; a: string }[] = [
  {
    q: 'Is the preview really free?',
    a: 'Yes. We design and build a custom website for your landscaping business at no cost and show you the finished result first. There’s no card, no deposit, and no obligation. If you don’t love it, you walk away owing nothing.',
  },
  {
    q: 'What does the $99/month include?',
    a: 'Everything to keep your site live and cared for: hosting, SSL, your custom domain, unlimited edits (new photos, services, or seasonal offers anytime), ongoing updates, and real human support. No upfront fees and no long-term contract — cancel anytime.',
  },
  {
    q: 'I already get most of my work by word of mouth. Why do I need a site?',
    a: 'Referrals still check you out online before they call. A clean site with your work, service area, and a quote form turns those looks into booked jobs — and helps you show up when someone Googles a landscaper near them. It works for you 24/7, even in your busy season.',
  },
  {
    q: 'Can you show off my past projects?',
    a: 'Absolutely. A photo gallery of your lawns, beds, hardscapes, and cleanups is one of the most persuasive things on the page. Send us photos from your phone and we’ll build the gallery for you — you can add more anytime.',
  },
  {
    q: 'How quickly will I see the preview?',
    a: 'Within 2 hours of you sending your details. You review a live preview link, tell us what to change, and revisions are included — we keep refining until it’s right.',
  },
  {
    q: 'What happens if I don’t like it?',
    a: 'Nothing. No invoices, no awkward conversations, no obligation. You only start the $99/month plan if you choose to launch. Don’t love the preview? Walk away — you owe us nothing.',
  },
];

export function LandscapersFaq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="divide-y divide-black/10 overflow-hidden rounded-3xl border border-black/10 bg-white">
      {FAQS.map((faq, i) => {
        const isOpen = open === i;
        return (
          <div key={faq.q}>
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : i)}
              aria-expanded={isOpen}
              className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left transition-colors hover:bg-black/[0.02] sm:px-8"
            >
              <span className="font-display text-lg font-medium text-[#161616]">{faq.q}</span>
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-black/15 text-[#161616] transition-transform duration-300 ${
                  isOpen ? 'rotate-45 border-transparent bg-amber-accent text-white' : ''
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
                <p className="max-w-2xl px-6 pb-6 text-[15px] leading-relaxed text-[#161616]/65 sm:px-8 sm:pb-7">
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
