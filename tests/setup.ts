import { existsSync } from 'fs';
import { resolve } from 'path';

export function setup() {
  // Load test-specific env first (local Supabase or dedicated test project).
  // Falls back to .env.local so unit tests still work, but integration tests
  // will skip themselves if TEST_SUPABASE_URL is not set.
  const testEnv = resolve(process.cwd(), '.env.test.local');
  const localEnv = resolve(process.cwd(), '.env.local');
  if (existsSync(testEnv)) process.loadEnvFile(testEnv);
  else if (existsSync(localEnv)) process.loadEnvFile(localEnv);
}
