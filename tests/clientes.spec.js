// @ts-check
import { test, expect } from '@playwright/test';

async function loginSeller(page) {
  const sellerEmail = process.env.SELLER_EMAIL;
  const sellerPassword = process.env.SELLER_PASSWORD;
  expect(sellerEmail, 'Configure SELLER_EMAIL no ambiente ou no arquivo .env.').toBeTruthy();
  expect(sellerPassword, 'Configure SELLER_PASSWORD no ambiente ou no arquivo .env.').toBeTruthy();

  await page.goto('/');
  await page.getByLabel('Código de acesso').fill(sellerEmail);
  await page.getByLabel('Senha').fill(sellerPassword);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/produtos\.html$/);
}

test('filtro de clientes retorna correspondências pelo nome', async ({ page }) => {
  await loginSeller(page);
  await page.goto('/clientes.html');

  await page.getByRole('searchbox', { name: 'Buscar por nome' }).fill('Ébano');
  await page.getByRole('button', { name: 'Buscar' }).click();

  const matchingRow = page.getByRole('row').filter({ hasText: 'Viveiro Ébano Ltda' });
  await expect(matchingRow).toBeVisible();
  await expect(
    page.getByRole('row').filter({ hasText: 'Agropecuária Boa Vista Ltda' }),
  ).toHaveCount(0);
});

test('formulário vazio de cliente mostra validação obrigatória', async ({ page }) => {
  await loginSeller(page);
  await page.goto('/clientes.html');
  await page.getByRole('button', { name: 'Salvar cliente' }).click();

  await expect(page.getByText('Não foi possível salvar: Informe o nome')).toBeVisible();
});
