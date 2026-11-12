import type { Metadata } from 'next';

export const metadata: Metadata = { title: "Cancel Subscription" };

export default function CancelLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
