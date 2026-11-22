// @ts-check
import { test, expect } from '@playwright/test';

const productName = 'Muda de Ipê-amarelo (tubete)';
const orderQuantity = 2;

async function openNewOrder(page) {
  const sellerEmail = process.env.SELLER_EMAIL;
  const sellerPassword = process.env.SELLER_PASSWORD;
  expect(sellerEmail, 'Configure SELLER_EMAIL no ambiente ou no arquivo .env.').toBeTruthy();
  expect(sellerPassword, 'Configure SELLER_PASSWORD no ambiente ou no arquivo .env.').toBeTruthy();

  await page.goto('/');
  await page.getByLabel('Código de acesso').fill(sellerEmail);
  await page.getByLabel('Senha').fill(sellerPassword);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/produtos\.html$/);

  await page.goto('/novo-pedido.html');
  await page.getByRole('combobox', { name: 'Cliente' }).selectOption({ label: 'Agropecuária Boa Vista Ltda (Açailândia/MA)' });
  await page.locator('#produto').selectOption('1');

  const stockMessage = await page.getByText(/^Estoque disponível:/).innerText();
  const stock = Number(stockMessage.match(/\d+/)?.[0]);
  expect(Number.isInteger(stock)).toBe(true);
  return stock;
}

test('pedido reduz o estoque e o cancelamento o restaura', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Executa o fluxo mutável uma vez por execução.');
  test.fail(true, 'Defeito observado no ambiente: cancelar o pedido não restaura o estoque.');

  const sellerEmail = process.env.SELLER_EMAIL;
  const sellerPassword = process.env.SELLER_PASSWORD;
  expect(sellerEmail, 'Configure SELLER_EMAIL no ambiente ou no arquivo .env.').toBeTruthy();
  expect(sellerPassword, 'Configure SELLER_PASSWORD no ambiente ou no arquivo .env.').toBeTruthy();

  await page.goto('/');
  await page.getByLabel('Código de acesso').fill(sellerEmail);
  await page.getByLabel('Senha').fill(sellerPassword);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/produtos\.html$/);

  const productRow = page.getByRole('row').filter({ hasText: productName });
  const readStock = async () => Number((await productRow.getByRole('cell').nth(3).innerText()).replace(/\./g, ''));
  const stockBefore = await readStock();
  expect(stockBefore).toBeGreaterThanOrEqual(orderQuantity);

  await page.getByRole('link', { name: 'Novo pedido' }).click();
  await page.getByRole('combobox', { name: 'Cliente' }).selectOption({ label: 'Agropecuária Boa Vista Ltda (Açailândia/MA)' });

  const productId = await page.locator('#produto option').filter({ hasText: productName }).getAttribute('value');
  expect(productId).toBeTruthy();
  await page.locator('#produto').selectOption(productId);
  await page.getByLabel('Quantidade').fill(String(orderQuantity));
  await page.getByRole('button', { name: 'Adicionar' }).click();
  await page.getByRole('button', { name: 'Confirmar pedido' }).click();

  await expect(page.getByText(/Pedido Nº \d+ criado com sucesso\./)).toBeVisible();
  await expect(page.getByText('Aberto', { exact: true })).toBeVisible();
  const orderId = new URL(page.url()).searchParams.get('id');
  expect(orderId).toBeTruthy();

  await page.getByRole('link', { name: 'Produtos' }).click();
  await expect.poll(readStock).toBe(stockBefore - orderQuantity);

  await page.goto(`/pedido.html?id=${orderId}`);
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Cancelar pedido' }).click();
  await expect(page.getByText(`Pedido Nº ${orderId} cancelado.`)).toBeVisible();
  await expect(page.getByText('Cancelado', { exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'Produtos' }).click();
  await expect.poll(readStock).toBe(stockBefore);
});

test('novo pedido bloqueia quantidade acima do estoque', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Executa os fluxos de pedido uma vez por execução.');
  const stock = await openNewOrder(page);

  await page.getByRole('spinbutton', { name: 'Quantidade' }).fill(String(stock + 1));
  await page.getByRole('button', { name: 'Adicionar' }).click();

  await expect(page.getByText(`Quantidade acima do estoque (${stock} disponíveis)`)).toBeVisible();
  await expect(page.getByText('Nenhum item adicionado.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirmar pedido' })).toBeDisabled();
});

test('novo pedido rejeita quantidades zero e negativas', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Executa os fluxos de pedido uma vez por execução.');
  await openNewOrder(page);

  for (const quantity of ['0', '-1']) {
    await page.getByRole('spinbutton', { name: 'Quantidade' }).fill(quantity);
    await page.getByRole('button', { name: 'Adicionar' }).click();

    await expect(page.getByText('Informe uma quantidade inteira a partir de 1')).toBeVisible();
    await expect(page.getByText('Nenhum item adicionado.')).toBeVisible();
  }
});
