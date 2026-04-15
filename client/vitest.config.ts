// FILE: client/vitest.config.ts
// PURPOSE: Vitest configuration for client-side tests
// USED BY: `npx vitest run` in client/
// EXPORTS: Vitest config

import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  // WHY: React plugin enables JSX transform for test files that use JSX (e.g. useReport.test.ts
  // with @vitest-environment happy-dom). Pure node tests are unaffected.
  plugins: [react()],
  test: {
    globals: true,
    environment: 'node',
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, '../shared'),
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
