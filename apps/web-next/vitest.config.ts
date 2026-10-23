import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    fileParallelism: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Exercise the Edge Function with the same real client in Node; only its
      // Deno entry point and external HTTP transport are supplied by tests.
      'https://esm.sh/@supabase/supabase-js@2': '@supabase/supabase-js',
    },
  },
})
