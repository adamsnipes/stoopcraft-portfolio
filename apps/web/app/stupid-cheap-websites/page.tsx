import type { Metadata } from 'next';
import { CHEAP_BRAND } from '@/lib/marketing-brand';
import { PreviewForm } from './preview-form';
import { archivo, Arrow, cheapMetadata, Footer, Wordmark } from './_components/brand';
import styles from './page.module.css';

const title = 'Business Websites for $40/Month | Stupid Cheap Websites';
const description = 'A proper business website for $40/month. We handle the design, writing, hosting, and updates. $0 upfront. See your free preview before you pay.';

export const metadata: Metadata = cheapMetadata({ title, description, path: '/' });

const work = [
  { name: 'Nimbus Pest Defense', type: 'Pest control', image: '/work/clients/nimbus-pest.jpg', color: '#d7f1f5' },
  { name: 'Vista Mobile Bar', type: 'Events & hospitality', image: '/work/clients/vista.jpg', color: '#f1e4d6' },
  { name: 'Willow & Wave', type: 'Local services', image: '/work/clients/willow-wave.jpg', color: '#e5e9df' },
];
const included = [
  ['01', 'The whole website.', 'A professional landing page built around your business, your services, and getting people to contact you.'],
  ['02', 'Words? We write them.', 'Headlines, service descriptions, and the details your customers need. No homework assignment for you.'],
  ['03', 'Good on every screen.', 'Easy to read, quick to load, and simple to use on phones, tablets, and computers.'],
  ['04', 'The technical stuff.', 'Hosting, SSL security, and connecting your domain. We look after the bits you don’t want to think about.'],
  ['05', 'A way to get inquiries.', 'Click-to-call buttons and a contact form that sends customer inquiries straight to your inbox.'],
  ['06', 'Help after launch.', 'Need to change your hours, a photo, or a line of text? Send us the update and we handle it.'],
];
const faqs = [
  ['Is it actually $40/month?', 'Yes. $40/month for the website and its ongoing hosting, security, and text and photo updates. Design, writing, and your preview cost $0 upfront. You only start paying if you choose to launch.'],
  ['Why so cheap?', 'We focus on straightforward business websites and keep the process simple. You get a focused landing page and ongoing care for one monthly price. Bigger custom projects can be discussed separately.'],
  ['What if I don’t like the preview?', 'Tell us what you’d like changed. You can review the design before committing. If you decide to pass, you owe nothing.'],
  ['Can you use my existing domain?', 'Yes. We can connect a domain you already own, and your current website stays online while you review the preview. If you need a new domain, we’ll help you arrange one and confirm any registration cost first.'],
  ['What kind of businesses is this for?', 'Local services, contractors, cleaners, landscapers, photographers, consultants, and other small businesses that need a professional online home. Online stores and complex custom applications need a separate quote.'],
  ['Can I cancel?', 'Yes. There’s no minimum term. If you cancel, your hosted website goes offline at the end of your paid billing period. Your domain remains yours. We’ll confirm any file-transfer options before you launch.'],
];

export default function CheapWebsitesPage() {
  return <div id="top" className={`${styles.page} ${archivo.variable}`}>
    <a className={styles.skipLink} href="#main">Skip to content</a>
    <div className={styles.announcement}>SMALL BUSINESS. SMALL PRICE. BIG “WHY DIDN’T I DO THIS SOONER?” ENERGY.</div>
    <header className={styles.header}>
      <Wordmark />
      <nav aria-label="Main navigation"><a href="#work">The work</a><a href="#price">The price</a><a className={styles.headerCta} href="#hero-preview">Get my free preview <Arrow /></a></nav>
    </header>

    <main id="main">
      <section className={`${styles.container} ${styles.hero}`} aria-labelledby="hero-title">
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}><span className={styles.statusDot} /> DONE-FOR-YOU BUSINESS WEBSITES</p>
          <h1 id="hero-title">Stupid cheap.<br /><span className={styles.highlight}>Seriously good.</span></h1>
          <p className={styles.heroDescription}>A proper website for your business.<br />For <strong>${CHEAP_BRAND.monthly}/month.</strong> Yep, the whole thing.</p>
          <p className={styles.heroDetail}>We design it, write it, and keep it running.<br />You get back to doing what you do.</p>
          <p className={styles.microcopy}>$0 upfront. No card to preview. Pay only if you launch.</p>
          <div className={styles.heroChecks}><span>✓ Built for your business</span><span>✓ Updates handled</span><span>✓ Cancel anytime</span></div>
        </div>
        <div id="hero-preview" className={styles.heroForm}>
          <PreviewForm location="hero" compact />
        </div>
      </section>

      <div className={styles.trustStrip}><span>YOU RUN A BUSINESS.<br /><strong>WE’LL RUN YOUR WEBSITE.</strong></span><p>Contractors <span>✳</span> Cleaners <span>✳</span> Landscapers <span>✳</span> Local shops <span>✳</span> Consultants</p></div>

      <section id="work" className={`${styles.container} ${styles.section}`} aria-labelledby="work-title">
        <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>THE WORK SPEAKS FOR ITSELF</p><h2 id="work-title">This is what<br /><span className={styles.underline}>stupid cheap looks like.</span></h2></div><p>A few examples from our team.<br />Your business gets its own look.</p></div>
        <div className={styles.workGrid}>{work.map(item => <a key={item.name} className={styles.workCard} href={item.image} target="_blank" rel="noopener noreferrer" aria-label={`View larger ${item.name} website preview (opens in a new tab)`}>
          <div className={styles.workImage} style={{ background: item.color }}>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={item.image} alt={`${item.name} example website`} width="1440" height="900" loading="lazy" /></div>
          <div className={styles.workCaption}><div><strong>{item.name}</strong><span>{item.type}</span></div><Arrow /></div>
        </a>)}</div>
        <p className={styles.portfolioNote}>Anonymized examples of our team’s work. Business names and contact details are illustrative.</p>
      </section>

      <section className={styles.includedSection} aria-labelledby="included-title"><div className={`${styles.container} ${styles.section}`}>
        <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>YES, THAT’S INCLUDED</p><h2 id="included-title">Your website.<br />Off your to-do list.</h2></div><p>No builder to wrestle with.<br />No tech stuff to figure out.</p></div>
        <div className={styles.includedGrid}>{included.map(([number, heading, text]) => <article key={number}><span className={styles.itemNumber}>{number} /</span><h3>{heading}</h3><p>{text}</p></article>)}</div>
      </div></section>

      <section className={`${styles.container} ${styles.section}`} aria-labelledby="process-title">
        <p className={styles.eyebrow}>THE ENTIRE PROCESS. REALLY.</p><h2 id="process-title">Three steps.<br />Zero website homework.</h2>
        <ol className={styles.steps}>
          <li><span>01</span><h3>Tell us about you.</h3><p>Your business name, what you do, and where to send the preview. Start with either short form on this page.</p></li>
          <li><span>02</span><h3>We make the website.</h3><p>Design, words, and the details. You get a finished preview to look through and give feedback on.</p></li>
          <li><span>03</span><h3>Like it? Let’s launch.</h3><p>Give us the go-ahead and we connect your domain. Your $40/month starts when you launch.</p></li>
        </ol>
      </section>

      <section id="price" className={styles.pricingSection} aria-labelledby="price-title"><div className={`${styles.container} ${styles.pricingGrid}`}>
        <div><p className={styles.eyebrow}>THE PRICE. WITHOUT THE SALES CALL.</p><h2 id="price-title">Keep your money<br />for the other<br /><span>business stuff.</span></h2><p className={styles.pricingIntro}>A website should help you run your business.<br />So should the price.</p><a href="#preview" className={styles.textLink}>See your website before you pay <Arrow /></a></div>
        <div className={styles.priceCard}><span className={styles.planLabel}>ONE WEBSITE. ONE SIMPLE PLAN.</span><div className={styles.bigPrice}><span>$</span><strong>{CHEAP_BRAND.monthly}</strong><span>/month</span></div><p>$0 setup. $0 to see your preview.</p><ul>{['Professional business landing page', 'Design & website copy written for you', 'Hosting & SSL security', 'Your existing domain connected', 'Mobile-friendly layout & contact form', 'Text & photo updates handled for you', 'Basic page titles & search metadata'].map(x => <li key={x}><span aria-hidden="true">✓</span>{x}</li>)}</ul><a className={styles.button} href="#preview">Build my free preview <Arrow /></a><small>Pay only if you launch. Cancel anytime.<br />New domain registration, if needed, is confirmed separately.</small></div>
      </div></section>

      <section className={`${styles.container} ${styles.section} ${styles.faqSection}`} aria-labelledby="faq-title"><div><p className={styles.eyebrow}>FAIR QUESTIONS</p><h2 id="faq-title">“Okay, but…”</h2><p>We’d ask too.</p></div><div className={styles.faqList}>{faqs.map(([q, a]) => <details key={q}><summary>{q}<span aria-hidden="true">+</span></summary><p>{a}</p></details>)}</div></section>

      <section id="preview" className={styles.formSection} aria-labelledby="preview-title"><div className={`${styles.container} ${styles.formGrid}`}><div><p className={styles.eyebrow}>LET’S GET YOUR BUSINESS ONLINE</p><h2 id="preview-title">You’re good<br />at your thing.<br /><span className={styles.highlight}>This is ours.</span></h2><p>Tell us a little about your business.<br />We’ll make you something worth showing off.</p><div className={styles.formPromise}><strong>Free to preview. $40/month to launch.</strong><span>No card. No commitment. No awkward sales call.</span></div></div><PreviewForm location="footer" /></div></section>
    </main>
    <Footer />
    <a className={styles.mobileCta} href="#hero-preview"><span><strong>$40</strong>/month</span><span>Get my free preview ↗</span></a>
  </div>;
}
