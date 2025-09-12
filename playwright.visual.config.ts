import { defineConfig, devices } from '@playwright/test'

/**
 * Configuração específica para testes de regressão visual
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests',
  testMatch: '**/visual-regression.spec.ts',
  
  /* Executa testes em paralelo */
  fullyParallel: true,
  
  /* Falha o build em CI se você deixou test.only no código fonte */
  forbidOnly: !!process.env.CI,
  
  /* Retry em CI apenas */
  retries: process.env.CI ? 2 : 0,
  
  /* Opt out de parallel tests em CI */
  workers: process.env.CI ? 1 : undefined,
  
  /* Reporter para visual regression */
  reporter: [
    ['html', { outputFolder: 'playwright-report-visual' }],
    ['json', { outputFile: 'test-results-visual.json' }]
  ],
  
  /* Configuração compartilhada para todos os projetos */
  use: {
    /* URL base para usar em actions como `await page.goto('/')` */
    baseURL: 'http://localhost:8080',
    
    /* Coleta trace em retry de testes que falharam */
    trace: 'on-first-retry',
    
    /* Screenshot em falhas */
    screenshot: 'only-on-failure',
    
    /* Video em falhas */
    video: 'retain-on-failure',
    
    /* Configurações específicas para visual testing */
    actionTimeout: 10000,
    navigationTimeout: 30000,
  },
  
  /* Configuração de projetos para diferentes browsers e viewports */
  projects: [
    {
      name: 'chromium-desktop',
      use: { 
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 }
      },
    },
    {
      name: 'chromium-tablet',
      use: { 
        ...devices['Desktop Chrome'],
        viewport: { width: 768, height: 1024 }
      },
    },
    {
      name: 'chromium-mobile',
      use: { 
        ...devices['Desktop Chrome'],
        viewport: { width: 375, height: 667 }
      },
    },
  ],
  
  /* Configuração do servidor de desenvolvimento */
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:8080',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
  
  /* Configurações específicas para screenshots */
  expect: {
    /* Threshold para comparação de screenshots (0-1) */
    toHaveScreenshot: {
      threshold: 0.2
    },
    /* Timeout para assertions */
    timeout: 10000
  },
  
  /* Diretório para armazenar screenshots de referência */
  snapshotDir: './tests/visual-regression-screenshots',
  
  /* Configurações de output */
  outputDir: './test-results-visual',
})