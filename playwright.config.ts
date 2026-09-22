import { defineConfig, devices } from '@playwright/test'

const isCI = !!process.env.CI

// Suíte de fumaça: o app compilado sobe, redireciona quem não tem sessão para
// o login e renderiza sem erro de console. Não depende de banco — sem cookie de
// sessão o middleware não chega a consultar o Supabase —, então o CI roda com
// credenciais de mentira e nunca toca a produção.
export default defineConfig({
  testDir: './tests',
  // A regressão visual depende de snapshots versionados e tem config própria
  // (playwright.visual.config.ts).
  testIgnore: ['**/visual-regression.spec.ts'],
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  reporter: isCI ? [['github'], ['html', { open: 'never' }]] : 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  // Um navegador basta para fumaça no CI; localmente dá para ver os três.
  projects: isCI
    ? [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }]
    : [
        { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
        { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
        { name: 'webkit', use: { ...devices['Desktop Safari'] } },
      ],
  webServer: {
    // No CI o build de produção já foi gerado no passo anterior; testar contra
    // ele é testar o que vai para o ar, não o servidor de desenvolvimento.
    command: isCI ? 'npm run start' : 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !isCI,
    timeout: 120 * 1000,
  },
})
