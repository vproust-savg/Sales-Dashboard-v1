// FILE: server/vitest.config.ts
// PURPOSE: Vitest configuration for backend tests
// USED BY: `npm test` command
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
    },
  },
});
