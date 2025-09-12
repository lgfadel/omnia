import { test, expect } from '@playwright/test';

test.describe('OMNIA - Navegação Básica', () => {
  test('deve carregar a página inicial', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    
    // Verifica se a página carregou
    await expect(page.locator('body')).toBeVisible();
  });

  test('deve exibir elementos básicos', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    
    // Verifica se o HTML básico está presente
    await expect(page.locator('html')).toBeVisible();
    await expect(page.locator('body')).toBeVisible();
  });
});