import type { Metadata } from 'next';
import { Archivo } from 'next/font/google';
import { CHEAP_BRAND } from '@/lib/marketing-brand';
import styles from '../page.module.css';

export const archivo = Archivo({ subsets: ['latin'], variable: '--cheap-display' });

// Every page overrides the root layout's StoopCraft defaults (title template,
// siteName, og image), so nothing from the platform brand leaks into a share card.
export function cheapMetadata({ title, description, path }: { title: string; description: string; path: string }): Metadata {
  const url = `${CHEAP_BRAND.url}${path}`;
  return {
    metadataBase: new URL(CHEAP_BRAND.url),
    title: { absolute: title },
    description,
    applicationName: CHEAP_BRAND.name,
    alternates: { canonical: url },
    icons: { icon: '/cheap-websites/icon.svg', apple: '/cheap-websites/apple-icon.png' },
    openGraph: {
      type: 'website', url, siteName: CHEAP_BRAND.name,
      title, description,
      images: [{ url: '/cheap-websites/og-image.png', width: 1200, height: 630, alt: 'Stupid Cheap Websites. Seriously good websites for $40/month.' }],
    },
    twitter: { card: 'summary_large_image', title, description, images: ['/cheap-websites/og-image.png'] },
  };
}

export function Arrow({ className = '' }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 12h16m-7-7 7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export function Wordmark({ href = '#top' }: { href?: string }) {
  return <a className={styles.logo} href={href} aria-label="Stupid Cheap Websites home">
    <span>STUPID <span className={styles.logoHighlight}>CHEAP</span></span>
    <span className={styles.logoSmall}>WEBSITES<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M5 2v26l7-7 5 10 6-3-5-10h10Z" fill="currentColor" /></svg></span>
  </a>;
}

export function Footer({ homeHref = '#top' }: { homeHref?: string }) {
  return <footer className={`${styles.container} ${styles.footer}`}>
    <Wordmark href={homeHref} />
    <p>Small price. Proper website.<br /><span>© {new Date().getFullYear()} {CHEAP_BRAND.name}.</span></p>
    <div><a href="/privacy">Privacy policy</a><a href="/terms">Terms of service</a></div>
  </footer>;
}
