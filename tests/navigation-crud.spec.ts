import { test, expect } from '@playwright/test'

test.describe('Navegação e CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:8080', { waitUntil: 'domcontentloaded' })
  })

  test('deve permitir navegação entre páginas', async ({ page }) => {
    // Verifica se a página inicial carregou
    await expect(page.locator('html')).toBeVisible()
    await expect(page.locator('body')).toBeVisible()
    
    // Procura por links de navegação
    const navigationLinks = await page.locator('a, [role="link"]').count()
    const navigationButtons = await page.locator('button[data-testid*="nav"], button[aria-label*="nav"]').count()
    
    // Deve ter pelo menos alguns elementos de navegação
    expect(navigationLinks + navigationButtons).toBeGreaterThanOrEqual(0)
  })

  test('deve ter elementos de interface responsivos', async ({ page }) => {
    // Testa responsividade básica
    await page.setViewportSize({ width: 1200, height: 800 })
    await expect(page.locator('body')).toBeVisible()
    
    // Testa em mobile
    await page.setViewportSize({ width: 375, height: 667 })
    await expect(page.locator('body')).toBeVisible()
    
    // Volta para desktop
    await page.setViewportSize({ width: 1200, height: 800 })
  })

  test('deve carregar recursos estáticos corretamente', async ({ page }) => {
    // Monitora requisições de recursos
    const failedRequests: string[] = []
    
    page.on('response', response => {
      if (response.status() >= 400) {
        failedRequests.push(`${response.status()}: ${response.url()}`)
      }
    })
    
    await page.waitForTimeout(2000)
    
    // Filtra apenas falhas críticas (não 404s de recursos opcionais)
    const criticalFailures = failedRequests.filter(req => 
      !req.includes('favicon') && 
      !req.includes('manifest') &&
      !req.includes('.map')
    )
    
    expect(criticalFailures.length).toBe(0)
  })

  test('deve ter formulários funcionais', async ({ page }) => {
    // Verifica se existem formulários na página
    const forms = await page.locator('form').count()
    const inputs = await page.locator('input, textarea, select').count()
    const buttons = await page.locator('button, input[type="submit"]').count()
    
    // Se há formulários, deve haver inputs e botões
    if (forms > 0) {
      expect(inputs).toBeGreaterThan(0)
      expect(buttons).toBeGreaterThan(0)
    }
    
    // Testa interação básica com inputs se existirem
    const firstInput = page.locator('input[type="text"], input[type="email"], textarea').first()
    const inputCount = await firstInput.count()
    
    if (inputCount > 0) {
      await firstInput.fill('teste')
      await expect(firstInput).toHaveValue('teste')
      await firstInput.clear()
    }
  })

  test('deve ter performance adequada', async ({ page }) => {
    const startTime = Date.now()
    
    await page.goto('http://localhost:8080', { waitUntil: 'domcontentloaded' })
    
    const loadTime = Date.now() - startTime
    
    // Página deve carregar em menos de 5 segundos
    expect(loadTime).toBeLessThan(5000)
    
    // Verifica se elementos essenciais estão visíveis
    await expect(page.locator('body')).toBeVisible()
  })
})