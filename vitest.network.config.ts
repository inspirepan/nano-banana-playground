import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/network/**/*.test.ts'],
    testTimeout: 60_000,
  },
})
