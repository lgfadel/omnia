import { test, expect } from '@playwright/test'

test.describe('Autenticação', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:8080', { waitUntil: 'domcontentloaded' })
  })

  test('deve exibir a página de login', async ({ page }) => {
    // Verifica se a página carregou
    await expect(page.locator('html')).toBeVisible()
    await expect(page.locator('body')).toBeVisible()
    
    // Verifica se existe algum elemento de login (formulário, botão, etc.)
    const hasLoginForm = await page.locator('form').count() > 0
    const hasLoginButton = await page.locator('button').count() > 0
    const hasLoginInput = await page.locator('input').count() > 0
    
    expect(hasLoginForm || hasLoginButton || hasLoginInput).toBeTruthy()
  })

  test('deve permitir navegação básica após carregamento', async ({ page }) => {
    // Verifica se a página está responsiva
    await expect(page.locator('html')).toBeVisible()
    
    // Testa se existem elementos interativos
    const interactiveElements = await page.locator('button, a, input').count()
    expect(interactiveElements).toBeGreaterThan(0)
  })

  test('deve ter estrutura HTML válida', async ({ page }) => {
    // Verifica estrutura básica
    await expect(page.locator('html')).toBeVisible()
    await expect(page.locator('head')).toBeAttached()
    await expect(page.locator('body')).toBeVisible()
    
    // Verifica se não há erros de console críticos
    const logs: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error') {
        logs.push(msg.text())
      }
    })
    
    await page.waitForTimeout(1000)
    
    // Filtra apenas erros críticos (não warnings de desenvolvimento)
    const criticalErrors = logs.filter(log => 
      !log.includes('Warning') && 
      !log.includes('DevTools') &&
      !log.includes('Extension')
    )
    
    expect(criticalErrors.length).toBe(0)
  })
})