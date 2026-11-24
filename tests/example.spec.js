// @ts-check
// Importa test para definir cenários e expect para realizar as verificações.
import { test, expect } from '@playwright/test';

// Primeiro cenário de exemplo: verifica o título da página do Playwright.
test('has title', async ({ page }) => {
  // Navega para uma URL externa usada apenas como demonstração.
  await page.goto('https://playwright.dev/');

  // toHaveTitle aguarda até o título corresponder à expressão regular.
  // /Playwright/ verifica se a palavra Playwright aparece no título.
  await expect(page).toHaveTitle(/Playwright/);
});

// Segundo cenário de exemplo: navega pela documentação usando um link visível.
test('get started link', async ({ page }) => {
  await page.goto('https://playwright.dev/');

  // getByRole encontra o link pelo seu papel acessível e pelo nome visível.
  await page.getByRole('link', { name: 'Get started' }).click();

  // Confirma que a página seguinte contém o título de nível heading chamado Installation.
  await expect(page.getByRole('heading', { name: 'Installation' })).toBeVisible();
});
