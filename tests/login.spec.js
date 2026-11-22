// @ts-check
import { test, expect } from '@playwright/test';

test('login válido abre o catálogo de produtos', async ({ page }) => {
  const sellerEmail = process.env.SELLER_EMAIL;
  const sellerPassword = process.env.SELLER_PASSWORD;
  expect(sellerEmail, 'Configure SELLER_EMAIL no ambiente ou no arquivo .env.').toBeTruthy();
  expect(sellerPassword, 'Configure SELLER_PASSWORD no ambiente ou no arquivo .env.').toBeTruthy();

  await page.goto('/');
  await page.getByLabel('Código de acesso').fill(sellerEmail);
  await page.getByLabel('Senha').fill(sellerPassword);
  await page.getByRole('button', { name: 'Entrar' }).click();

  await expect(page).toHaveURL(/\/produtos\.html$/);
  await expect(page.getByRole('heading', { name: 'Produtos' })).toBeVisible();
});

test('login inválido exibe mensagem de erro', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Código de acesso').fill('invalid-qa-code');
  await page.getByLabel('Senha').fill('invalid-qa-password');
  await page.getByRole('button', { name: 'Entrar' }).click();

  await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible();
  await expect(page.getByText('Código ou senha inválidos', { exact: true })).toBeVisible();
});
