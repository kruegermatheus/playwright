// @ts-check
// Importa os recursos do Playwright usados para localizar elementos e verificar resultados.
import { test, expect } from '@playwright/test';

// Primeiro cenário: valida o fluxo completo de login com credenciais válidas.
test('login válido abre o catálogo de produtos', async ({ page }) => {
  // Recupera as credenciais das variáveis de ambiente.
  const sellerEmail = process.env.SELLER_EMAIL;
  const sellerPassword = process.env.SELLER_PASSWORD;

  // Verifica previamente que os dados necessários estão configurados.
  expect(sellerEmail, 'Configure SELLER_EMAIL no ambiente ou no arquivo .env.').toBeTruthy();
  expect(sellerPassword, 'Configure SELLER_PASSWORD no ambiente ou no arquivo .env.').toBeTruthy();

  // Abre a página inicial definida pela baseURL da configuração do Playwright.
  await page.goto('/');

  // Preenche os campos pelo texto associado ao elemento na interface.
  await page.getByLabel('Código de acesso').fill(sellerEmail);
  await page.getByLabel('Senha').fill(sellerPassword);

  // Envia o formulário ao clicar no botão Entrar.
  await page.getByRole('button', { name: 'Entrar' }).click();

  // Confirma a navegação por URL e a presença do título da página seguinte.
  await expect(page).toHaveURL(/\/produtos\.html$/);
  await expect(page.getByRole('heading', { name: 'Produtos' })).toBeVisible();
});

// Segundo cenário: valida o erro mostrado quando as credenciais são inválidas.
test('login inválido exibe mensagem de erro', async ({ page }) => {
  await page.goto('/');

  // Usa valores deliberadamente incorretos para testar o caminho de rejeição.
  await page.getByLabel('Código de acesso').fill('invalid-qa-code');
  await page.getByLabel('Senha').fill('invalid-qa-password');
  await page.getByRole('button', { name: 'Entrar' }).click();

  // Permanece na página de login e apresenta a mensagem de credenciais inválidas.
  await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible();
  await expect(page.getByText('Código ou senha inválidos', { exact: true })).toBeVisible();
});
