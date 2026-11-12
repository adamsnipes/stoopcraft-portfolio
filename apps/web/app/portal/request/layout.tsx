import type { Metadata } from 'next';

export const metadata: Metadata = { title: "Request a Change" };

export default function RequestLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
