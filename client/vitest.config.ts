// FILE: client/vitest.config.ts
// PURPOSE: Vitest configuration for client-side tests
// USED BY: `npx vitest run` in client/
// EXPORTS: Vitest config

import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
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
