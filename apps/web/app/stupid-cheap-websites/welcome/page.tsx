// Where Stripe Checkout returns a Stupid Cheap Websites customer
// (stupidcheapwebsites.com/welcome?session_id=…). Unlike StoopCraft's /welcome,
// it doesn't sign them in to the StoopCraft portal: SCW customers send updates
// by email. The webhook claims the client and sends the payment email.

import type { Metadata } from 'next';
import { getStripe } from '@/lib/stripe';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { CHEAP_BRAND, isCheapBrandClient } from '@/lib/marketing-brand';
import { cheapMetadata } from '../_components/brand';
import { BrandShell } from '../_components/legal';
import styles from '../page.module.css';

type PageProps = { searchParams: Promise<{ session_id?: string }> };

export const metadata: Metadata = {
  ...cheapMetadata({ title: `Welcome | ${CHEAP_BRAND.name}`, description: 'Your website plan is active.', path: '/' }),
  alternates: undefined,
  robots: { index: false, follow: false },
};

async function paidBusinessName(sessionId: string | undefined): Promise<string | null> {
  if (!sessionId?.startsWith('cs_')) return null;
  try {
    const session = await getStripe().checkout.sessions.retrieve(sessionId);
    const paid = session.payment_status === 'paid' || session.payment_status === 'no_payment_required';
    const clientId = session.metadata?.['client_id'];
    if (!paid || session.metadata?.['plan'] !== 'scw' || !clientId) return null;
    const { data: client } = await createServiceRoleClient()
      .from('clients')
      .select('business_name, brand')
      .eq('id', clientId)
      .single();
    if (!client || !isCheapBrandClient(client.brand)) return null;
    return client.business_name?.trim() || 'your business';
  } catch {
    return null;
  }
}

export default async function CheapWelcomePage({ searchParams }: PageProps) {
  const businessName = await paidBusinessName((await searchParams).session_id);
  const contact = <a href={`mailto:${CHEAP_BRAND.email}`}>{CHEAP_BRAND.email}</a>;

  if (!businessName) {
    return <BrandShell mainClassName={styles.activate}>
      <h1>We couldn’t confirm that payment</h1>
      <p>If you were charged, don’t worry: email us at {contact} and we’ll sort it out.</p>
    </BrandShell>;
  }

  return <BrandShell mainClassName={styles.activate}>
    <p className={styles.eyebrow} style={{ justifyContent: 'center' }}>PAYMENT RECEIVED</p>
    <h1>You’re in. <span className={styles.highlight}>Nice.</span></h1>
    <p>Your ${CHEAP_BRAND.monthly}/month plan is active. We’re getting the website for <strong>{businessName}</strong> live and will email you as soon as it is.</p>
    <p className={styles.activateNote}>Want anything changed before launch? Email us at {contact}.</p>
  </BrandShell>;
}
