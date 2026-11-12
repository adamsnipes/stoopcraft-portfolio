import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { OnboardingForm } from './OnboardingForm';

export const metadata: Metadata = { title: "Set Up Your Website" };

export default async function OnboardingPage() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/');

  const admin = createServiceRoleClient();
  const { data: client } = await admin
    .from('clients')
    .select('id, business_name, slug, plan, status')
    .eq('owner_user_id', user.id)
    .single();

  if (!client) redirect('/');
  if (client.status === 'claimed' && client.plan) redirect('/portal');

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden lg:flex flex-col justify-between bg-gray-950 text-white w-[420px] shrink-0 p-12">
        <div>
          <div className="text-xl font-bold tracking-tight">StoopCraft</div>
        </div>

        <div className="space-y-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-2">You&apos;re setting up</p>
            <h2 className="text-3xl font-bold leading-tight">{client.business_name}</h2>
          </div>

          <ul className="space-y-4">
            {[
              { title: 'Done for you', body: 'We build and maintain everything — no tech skills needed.' },
              { title: 'Live in 24 hours', body: 'Your site will be published within 24 hours of subscribing.' },
              { title: 'Cancel anytime', body: 'No contracts. Stop or pause your plan whenever you want.' },
            ].map(({ title, body }) => (
              <li key={title} className="flex gap-3">
                <span className="mt-0.5 w-5 h-5 shrink-0 rounded-full bg-white/10 flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" viewBox="0 0 10 8" fill="none">
                    <path d="M1 4l2.5 2.5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <div>
                  <div className="text-sm font-semibold text-white">{title}</div>
                  <div className="text-sm text-gray-400">{body}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-gray-600">Questions? hello@stoopcraft.com</p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center bg-gray-50 px-6 py-12">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 w-full max-w-md">
          <div className="mb-7">
            <h1 className="text-2xl font-bold text-gray-900">Set up your site</h1>
            <p className="text-gray-500 text-sm mt-1">
              Let&apos;s get <span className="font-semibold text-gray-800">{client.business_name}</span> live.
            </p>
          </div>
          <OnboardingForm clientId={client.id} />
        </div>
      </div>
    </div>
  );
}
