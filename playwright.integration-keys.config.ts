import { defineConfig, devices } from '@playwright/test'

// CI installs bundled Chromium; locally this uses the installed Chrome channel.
// Set PLAYWRIGHT_USE_BUNDLED_CHROMIUM=true after `npx playwright install chromium`
// if Chrome is unavailable on the workstation.
const channel: 'chrome' | undefined = process.env.CI || process.env.PLAYWRIGHT_USE_BUNDLED_CHROMIUM === 'true' ? undefined : 'chrome'

// Fully isolated component/HTTP smoke: no Next server, .env or Supabase project.
export default defineConfig({
  testDir:'./tests',
  testMatch:'integration-keys-isolated.spec.ts',
  reporter:'list',
  workers:1,
  use:{...devices['Desktop Chrome'],channel,trace:'off'},
  projects:[{name:'chromium',use:{...devices['Desktop Chrome'],channel}}],
})
