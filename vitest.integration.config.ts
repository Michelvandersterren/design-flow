import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.integration.test.ts'],
    setupFiles: ['src/test/setup-db.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    // Run sequentially — integration tests share a DB
    sequence: {
      concurrent: false,
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
