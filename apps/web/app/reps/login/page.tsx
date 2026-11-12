// Legacy URL — the public funnel has been collapsed into /affiliates so
// every new signup is kind='affiliate' (admin can later promote specific
// ones to kind='rep' from /admin/reps). Returning users who bookmarked
// /reps/login can still sign in this way: the redirect preserves the
// magic-link round-trip (affiliates/login → /auth/callback → /reps).

import { redirect } from 'next/navigation';

export default function RepsLoginRedirect(): never {
  redirect('/affiliates/login');
}
