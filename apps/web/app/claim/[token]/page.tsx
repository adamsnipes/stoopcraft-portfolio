import { notFound } from 'next/navigation';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { ClaimForm } from './ClaimForm';

type Params = Promise<{ token: string }>;

export default async function ClaimPage({ params }: { params: Params }) {
  const { token } = await params;

  // Verify token exists and belongs to an unclaimed business
  const supabase = createServiceRoleClient();
  const { data: client } = await supabase
    .from('clients')
    .select('id, business_name, city, state, niche, slug')
    .eq('claim_token', token)
    .is('owner_user_id', null) // only un-owned clients can be claimed
    .single();

  if (!client) notFound();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white rounded-lg border p-8 max-w-md w-full">
        <h1 className="text-2xl font-bold mb-2">Claim your site</h1>
        <p className="text-gray-600 mb-6">
          We built a website for <strong>{client.business_name}</strong> in {client.city}, {client.state}.
          Enter your email to claim it.
        </p>
        <ClaimForm token={token} clientId={client.id} businessName={client.business_name} />
      </div>
    </div>
  );
}

export async function generateMetadata({ params }: { params: Params }) {
  return {
    title: 'Claim Your Free Website',
    robots: { index: false, follow: false },
  };
}
