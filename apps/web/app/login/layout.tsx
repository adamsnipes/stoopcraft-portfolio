import type { Metadata } from 'next';

// Auth screen: no SEO value and a poor search result. Keep it out of the index
// (robots.ts also disallows it, but noindex is the enforceable half — a Disallow
// alone can still leave a URL-only entry in results). Metadata must be declared
// on this server layout, since page.tsx is a Client Component.
export const metadata: Metadata = {
  title: 'Log in',
  robots: { index: false, follow: false },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
