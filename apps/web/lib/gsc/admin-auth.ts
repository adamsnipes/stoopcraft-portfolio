import { createServerClient } from '@/lib/supabase/server';

/** Returns the admin's email, or null if the caller isn't the platform admin.
 *  Mirrors the gate used by the other /api/admin routes. */
export async function assertAdmin(): Promise<string | null> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return null;
  return user.email === process.env.ADMIN_EMAIL ? user.email : null;
}
