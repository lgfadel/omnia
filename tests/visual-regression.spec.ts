import { test, expect } from '@playwright/test'

test.describe('Visual Regression Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:8080', { waitUntil: 'domcontentloaded' })
    // Aguarda um pouco para garantir que todos os elementos carregaram
    await page.waitForTimeout(2000)
  })

  test('deve manter a aparência da página inicial', async ({ page }) => {
    // Aguarda elementos essenciais carregarem
    await expect(page.locator('body')).toBeVisible()
    
    // Captura screenshot da página completa
    await expect(page).toHaveScreenshot('homepage-full.png', {
      fullPage: true,
      animations: 'disabled',
      caret: 'hide'
    })
  })

  test('deve manter a aparência em diferentes viewports', async ({ page }) => {
    // Desktop
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.waitForTimeout(1000)
    await expect(page).toHaveScreenshot('homepage-desktop.png', {
      fullPage: false,
      animations: 'disabled',
      caret: 'hide'
    })

    // Tablet
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.waitForTimeout(1000)
    await expect(page).toHaveScreenshot('homepage-tablet.png', {
      fullPage: false,
      animations: 'disabled',
      caret: 'hide'
    })

    // Mobile
    await page.setViewportSize({ width: 375, height: 667 })
    await page.waitForTimeout(1000)
    await expect(page).toHaveScreenshot('homepage-mobile.png', {
      fullPage: false,
      animations: 'disabled',
      caret: 'hide'
    })
  })

  test('deve manter a aparência dos componentes principais', async ({ page }) => {
    // Verifica se existem componentes específicos para capturar
    const header = page.locator('header, [data-testid="header"], nav').first()
    const headerCount = await header.count()
    
    if (headerCount > 0) {
      await expect(header).toHaveScreenshot('component-header.png', {
        animations: 'disabled',
        caret: 'hide'
      })
    }

    // Sidebar se existir
    const sidebar = page.locator('aside, [data-testid="sidebar"], .sidebar').first()
    const sidebarCount = await sidebar.count()
    
    if (sidebarCount > 0) {
      await expect(sidebar).toHaveScreenshot('component-sidebar.png', {
        animations: 'disabled',
        caret: 'hide'
      })
    }

    // Main content area
    const main = page.locator('main, [data-testid="main"], .main-content').first()
    const mainCount = await main.count()
    
    if (mainCount > 0) {
      await expect(main).toHaveScreenshot('component-main.png', {
        animations: 'disabled',
        caret: 'hide'
      })
    }
  })

  test('deve manter a aparência dos formulários', async ({ page }) => {
    const forms = page.locator('form')
    const formCount = await forms.count()
    
    if (formCount > 0) {
      // Captura o primeiro formulário encontrado
      const firstForm = forms.first()
      await expect(firstForm).toHaveScreenshot('component-form.png', {
        animations: 'disabled',
        caret: 'hide'
      })
    }
  })

  test('deve manter a aparência dos botões e elementos interativos', async ({ page }) => {
    const buttons = page.locator('button')
    const buttonCount = await buttons.count()
    
    if (buttonCount > 0) {
      // Captura uma área que contenha botões
      const buttonContainer = page.locator('div').filter({ has: page.locator('button') }).first()
      const containerCount = await buttonContainer.count()
      
      if (containerCount > 0) {
        await expect(buttonContainer).toHaveScreenshot('component-buttons.png', {
          animations: 'disabled',
          caret: 'hide'
        })
      }
    }
  })

  test('deve manter a aparência em modo escuro (se disponível)', async ({ page }) => {
    // Tenta encontrar um toggle de tema
    const themeToggle = page.locator(
      '[data-testid*="theme"], [aria-label*="theme"], [aria-label*="dark"], button[title*="theme"]'
    )
    const toggleCount = await themeToggle.count()
    
    if (toggleCount > 0) {
      // Clica no toggle de tema
      await themeToggle.first().click()
      await page.waitForTimeout(1000)
      
      // Captura screenshot em modo escuro
      await expect(page).toHaveScreenshot('homepage-dark-mode.png', {
        fullPage: false,
        animations: 'disabled',
        caret: 'hide'
      })
    }
  })

  test('deve detectar mudanças visuais não intencionais', async ({ page }) => {
    // Este teste serve como baseline para detectar mudanças
    await expect(page.locator('body')).toBeVisible()
    
    // Captura screenshot com configurações específicas para detecção de mudanças
    await expect(page).toHaveScreenshot('visual-baseline.png', {
      fullPage: true,
      animations: 'disabled',
      caret: 'hide',
      mask: [
        // Mascara elementos que podem mudar (timestamps, etc.)
        page.locator('[data-testid*="timestamp"]'),
        page.locator('.timestamp'),
        page.locator('[data-testid*="date"]')
      ]
    })
  })
})