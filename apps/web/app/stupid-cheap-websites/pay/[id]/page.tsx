// Stupid Cheap Websites' activation page — the brand's counterpart to
// /pay/[id]. Served at stupidcheapwebsites.com/pay/<clientId> (proxy rewrite)
// and linked from the claim banner on a SCW client's preview. Only SCW clients
// resolve here; StoopCraft's /pay/[id] sends SCW clients to this page.

import type { Metadata } from 'next';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { CHEAP_BRAND, isCheapBrandClient } from '@/lib/marketing-brand';
import { cheapMetadata } from '../../_components/brand';
import { BrandShell } from '../../_components/legal';
import styles from '../../page.module.css';
import { LaunchButton } from './launch-button';

type PageProps = { params: Promise<{ id: string }> };

export const metadata: Metadata = {
  ...cheapMetadata({
    title: `Launch your website | ${CHEAP_BRAND.name}`,
    description: `Launch your website for $${CHEAP_BRAND.monthly}/month.`,
    path: '/',
  }),
  alternates: undefined,
  robots: { index: false, follow: false },
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const INCLUDED = [
  'Your website, designed and written for you',
  'Hosting & SSL security',
  'Your domain connected',
  'Mobile-friendly layout & contact form',
  'Text & photo updates handled for you',
];

function Message({ title, children }: { title: string; children: React.ReactNode }) {
  return <BrandShell mainClassName={styles.activate}><h1>{title}</h1><p>{children}</p></BrandShell>;
}

export default async function CheapPayPage({ params }: PageProps) {
  const { id } = await params;
  const contact = <a href={`mailto:${CHEAP_BRAND.email}`}>{CHEAP_BRAND.email}</a>;
  const notFound = <Message title="Link not found">This launch link doesn’t look right. Double-check the link or email us at {contact}.</Message>;

  if (!UUID_RE.test(id)) return notFound;

  const { data: client } = await createServiceRoleClient()
    .from('clients')
    .select('id, business_name, status, owner_user_id, brand')
    .eq('id', id)
    .single();

  if (!client || !isCheapBrandClient(client.brand)) return notFound;

  if (client.status === 'claimed' || client.owner_user_id) {
    return <Message title="You’re all set">Your plan is already active. Need a change to your website? Email us at {contact}.</Message>;
  }

  const businessName = client.business_name?.trim() || 'your business';

  return <BrandShell mainClassName={styles.activate}>
    <p className={styles.eyebrow} style={{ justifyContent: 'center' }}>YOUR WEBSITE IS READY</p>
    <h1>Launch <span className={styles.highlight}>{businessName}</span>.</h1>
    <p>Like your preview? Launch it and we’ll connect your domain and keep it running.</p>
    <div className={styles.priceCard}>
      <span className={styles.planLabel}>ONE WEBSITE. ONE SIMPLE PLAN.</span>
      <div className={styles.bigPrice}><span>$</span><strong>{CHEAP_BRAND.monthly}</strong><span>/month</span></div>
      <p>$0 setup. Cancel anytime.</p>
      <ul>{INCLUDED.map(x => <li key={x}><span aria-hidden="true">✓</span>{x}</li>)}</ul>
      <LaunchButton clientId={client.id} label={`Launch my website. $${CHEAP_BRAND.monthly}/month`} />
    </div>
    <p className={styles.activateNote}>Secure checkout by Stripe. No long-term contract. By launching you agree to our <a href="/terms">terms</a>.</p>
  </BrandShell>;
}
