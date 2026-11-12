import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerClient } from '@/lib/supabase/server';
import { SETTING_KEYS, type SettingKey, setSetting } from '@/lib/platform-settings';

// Validation tier per setting key — keep the rules close to the key list so
// adding a new setting is one switch case. Percent values must be 0-100.
function validateValue(key: SettingKey, value: string): string | null {
  switch (key) {
    case SETTING_KEYS.AFFILIATE_DEFAULT_COMMISSION_PCT:
    case SETTING_KEYS.REP_DEFAULT_COMMISSION_PCT: {
      const n = parseInt(value, 10);
      if (!Number.isFinite(n) || n < 0 || n > 100) {
        return 'must be an integer 0–100';
      }
      return null;
    }
    default:
      return null;
  }
}

const ALLOWED_KEYS = Object.values(SETTING_KEYS) as string[];

const patchSchema = z.object({
  key: z.string().refine((k) => ALLOWED_KEYS.includes(k), 'unknown_key'),
  value: z.string().max(200),
});

async function getAdminUserId(): Promise<string | null> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== process.env.ADMIN_EMAIL) return null;
  return user.id;
}

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  const userId = await getAdminUserId();
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'validation_failed' }, { status: 400 });
  }

  const key = parsed.data.key as SettingKey;
  const validationError = validateValue(key, parsed.data.value);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  await setSetting({ key, value: parsed.data.value, userId });
  return NextResponse.json({ success: true });
}
