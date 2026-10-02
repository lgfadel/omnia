import { defineConfig } from 'vite'
import path from 'node:path'
import tailwindcss from 'tailwindcss'
import autoprefixer from 'autoprefixer'
import appTailwind from '../../apps/web-next/tailwind.config'

const repository = path.resolve(__dirname, '../..')

export default defineConfig({
  root: __dirname,
  envDir: __dirname,
  esbuild: { jsx: 'automatic' },
  resolve: {
    alias: [
      { find: '@/repositories/ataMinutasRepo.supabase', replacement: path.resolve(__dirname, 'fixtures.ts') },
      { find: '@/repositories/ataTranscriptionsRepo.supabase', replacement: path.resolve(__dirname, 'fixtures.ts') },
      { find: '@/lib/ataMinutaDocx', replacement: path.resolve(__dirname, 'fixtures.ts') },
      { find: '@', replacement: path.resolve(repository, 'apps/web-next/src') },
    ],
  },
  css: { postcss: { plugins: [tailwindcss({ ...appTailwind, content: [path.resolve(repository, 'apps/web-next/src/**/*.{ts,tsx}'), path.resolve(__dirname, '*.tsx')] }), autoprefixer()] } },
  server: { host: '127.0.0.1', port: 4179, strictPort: true, fs: { allow: [repository] } },
})
