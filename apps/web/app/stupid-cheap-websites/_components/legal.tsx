import type { ReactNode } from 'react';
import { archivo, Arrow, Footer, Wordmark } from './brand';
import styles from '../page.module.css';

// Header + footer frame for every brand page other than the homepage.
export function BrandShell({ mainClassName, children }: { mainClassName?: string; children: ReactNode }) {
  return <div className={`${styles.page} ${archivo.variable}`}>
    <a className={styles.skipLink} href="#main">Skip to content</a>
    <header className={styles.header}>
      <Wordmark href="/" />
      {/* Plain anchors: these paths are proxy rewrites on the brand domain, so a full load is the reliable route. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <nav aria-label="Main navigation"><a className={styles.headerCta} href="/#hero-preview">Get my free preview <Arrow /></a></nav>
    </header>
    <main id="main" className={`${styles.container} ${mainClassName}`}>{children}</main>
    <Footer homeHref="/" />
  </div>;
}

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return <BrandShell mainClassName={styles.legal}>
    <h1>{title}</h1>
    <p className={styles.legalUpdated}>Last updated {updated}</p>
    {children}
  </BrandShell>;
}
