import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      // Mirror the apps/web tsconfig path mapping so unit tests can import
      // modules that themselves use `@/...` paths.
      '@/': fileURLToPath(new URL('./apps/web/', import.meta.url)),
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    globals: false,
    environment: 'node',
    testTimeout: 30000,
    globalSetup: ['./tests/setup.ts'],
    fileParallelism: false,
  },
});
