type SearchParams = Promise<{ reason?: string }>;

const MESSAGES: Record<string, string> = {
  missing_session: "We couldn't find your checkout session.",
  invalid_session: "That checkout session isn't valid.",
  not_paid: 'Your payment is still processing — give it a moment and refresh.',
  no_email: "We couldn't read the email from your checkout.",
  user_create_failed: "We couldn't set up your account just yet.",
  signin_failed: "We couldn't sign you in automatically.",
};

export default async function WelcomeErrorPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { reason } = await searchParams;
  const message = MESSAGES[reason ?? ''] ?? 'Something went wrong.';
  const adminEmail = process.env.ADMIN_EMAIL ?? 'support';

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-cream-50">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-semibold mb-3">Welcome to StoopCraft</h1>
        <p className="text-ink-700 mb-4">{message}</p>
        <p className="text-sm text-ink-700/70">
          Your payment is safe. Try the link your operator sent again, or contact us at {adminEmail}.
        </p>
      </div>
    </div>
  );
}
