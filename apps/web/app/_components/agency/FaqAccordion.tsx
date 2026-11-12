'use client';

// Accordion for the agency landing page FAQ. Single-open behavior — opening
// one item collapses the others. Pure client state, no data deps.

import { useState } from 'react';

const FAQS: { q: string; a: string }[] = [
  {
    q: 'Is the preview really free?',
    a: 'Yes. We design and build your custom website preview at no cost and show you the finished result first. There’s no card, no deposit, and no obligation. If you don’t love it, you walk away owing nothing.',
  },
  {
    q: 'What does the $99/month include?',
    a: 'Everything to keep your site live and cared for: hosting, SSL, your custom domain, unlimited edits, ongoing updates, and real human support. No upfront fees and no long-term contract — cancel anytime.',
  },
  {
    q: 'What kind of website do I get?',
    a: 'A custom, mobile-first website designed from scratch for your business — not a template. We write the copy, design around your brand, and build it to load fast and turn visitors into calls, bookings, and customers.',
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

export function FaqAccordion() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="divide-y divide-white/10 rounded-3xl border border-white/10 bg-white/[0.02] overflow-hidden">
      {FAQS.map((faq, i) => {
        const isOpen = open === i;
        return (
          <div key={faq.q}>
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : i)}
              aria-expanded={isOpen}
              className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left transition-colors hover:bg-white/[0.03] sm:px-8"
            >
              <span className="font-display text-lg font-medium text-cream-50">{faq.q}</span>
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/15 text-cream-50 transition-transform duration-300 ${
                  isOpen ? 'rotate-45 bg-amber-accent text-ink-900' : ''
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
                <p className="px-6 pb-6 text-[15px] leading-relaxed text-cream-100/65 sm:px-8 sm:pb-7 max-w-2xl">
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
