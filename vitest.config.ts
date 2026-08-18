import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    include: ['tests/**/*.test.ts'],
  },
  resolve: {
    alias: {
      vscode: '/dev/null',
    },
  },
});
