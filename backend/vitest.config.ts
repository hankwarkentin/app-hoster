import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: ['dist', 'node_modules'],
    // Increase global test timeout to 60s to allow slower S3/localstack operations
    testTimeout: 60000,
  },
});
