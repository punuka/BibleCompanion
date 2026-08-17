import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.test.ts'],
    // Tests never call the live Gemini API — see the note in test/setup.ts.
    setupFiles: ['test/setup.ts'],
  },
  resolve: {
    alias: {
      '@bible/shared': fileURLToPath(new URL('../../packages/shared/src/index.ts', import.meta.url)),
    },
  },
});
