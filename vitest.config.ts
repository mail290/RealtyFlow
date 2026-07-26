import { defineConfig } from 'vitest/config';

// Scoped to the pure Care engine tests so the runner does not need the
// app's React/Vite plugin chain.
export default defineConfig({
  test: {
    include: ['lib/**/*.test.ts'],
    environment: 'node',
  },
});
