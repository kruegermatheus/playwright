// @ts-check
// Importa os recursos necessários para testes de interface e asserções.
import { test, expect } from '@playwright/test';

// Dados fixos usados para localizar o produto e definir a quantidade do pedido.
const productName = 'Muda de Ipê-amarelo (tubete)';
const orderQuantity = 2;

// Função auxiliar que autentica e abre o formulário de novo pedido.
async function openNewOrder(page) {
  const sellerEmail = process.env.SELLER_EMAIL;
  const sellerPassword = process.env.SELLER_PASSWORD;
  expect(sellerEmail, 'Configure SELLER_EMAIL no ambiente ou no arquivo .env.').toBeTruthy();
  expect(sellerPassword, 'Configure SELLER_PASSWORD no ambiente ou no arquivo .env.').toBeTruthy();

  // Executa o login pela interface.
  await page.goto('/');
  await page.getByLabel('Código de acesso').fill(sellerEmail);
  await page.getByLabel('Senha').fill(sellerPassword);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/produtos\.html$/);

  // Acessa o formulário e seleciona um cliente e um produto.
  await page.goto('/novo-pedido.html');
  await page.getByRole('combobox', { name: 'Cliente' }).selectOption({ label: 'Agropecuária Boa Vista Ltda (Açailândia/MA)' });
  await page.locator('#produto').selectOption('1');

  // Lê a mensagem de estoque e extrai apenas os números dela.
  const stockMessage = await page.getByText(/^Estoque disponível:/).innerText();
  const stock = Number(stockMessage.match(/\d+/)?.[0]);
  expect(Number.isInteger(stock)).toBe(true);
  return stock;
}

// Primeiro cenário: cria um pedido, verifica a redução do estoque e tenta cancelar.
test('pedido reduz o estoque e o cancelamento o restaura', async ({ page, browserName }) => {
  // Este fluxo modifica dados; portanto, roda uma única vez no Chromium.
  test.skip(browserName !== 'chromium', 'Executa o fluxo mutável uma vez por execução.');

  // O defeito conhecido é registrado como uma falha esperada.
  test.fail(true, 'Defeito observado no ambiente: cancelar o pedido não restaura o estoque.');

  const sellerEmail = process.env.SELLER_EMAIL;
  const sellerPassword = process.env.SELLER_PASSWORD;
  expect(sellerEmail, 'Configure SELLER_EMAIL no ambiente ou no arquivo .env.').toBeTruthy();
  expect(sellerPassword, 'Configure SELLER_PASSWORD no ambiente ou no arquivo .env.').toBeTruthy();

  // Faz login na interface.
  await page.goto('/');
  await page.getByLabel('Código de acesso').fill(sellerEmail);
  await page.getByLabel('Senha').fill(sellerPassword);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/produtos\.html$/);

  // Filtra a linha da tabela pelo nome do produto.
  const productRow = page.getByRole('row').filter({ hasText: productName });

  // Lê a quarta célula da linha e remove pontos usados como separador.
  const readStock = async () => Number((await productRow.getByRole('cell').nth(3).innerText()).replace(/\./g, ''));

  // Guarda o estoque inicial e confirma que ele comporta o pedido.
  const stockBefore = await readStock();
  expect(stockBefore).toBeGreaterThanOrEqual(orderQuantity);

  // Abre o formulário de novo pedido e seleciona o cliente.
  await page.getByRole('link', { name: 'Novo pedido' }).click();
  await page.getByRole('combobox', { name: 'Cliente' }).selectOption({ label: 'Agropecuária Boa Vista Ltda (Açailândia/MA)' });

  // Obtém o value da opção pelo texto do produto e seleciona essa opção.
  const productId = await page.locator('#produto option').filter({ hasText: productName }).getAttribute('value');
  expect(productId).toBeTruthy();
  await page.locator('#produto').selectOption(productId);

  // Informa a quantidade, adiciona o item e confirma o pedido.
  await page.getByLabel('Quantidade').fill(String(orderQuantity));
  await page.getByRole('button', { name: 'Adicionar' }).click();
  await page.getByRole('button', { name: 'Confirmar pedido' }).click();

  // Verifica a mensagem de sucesso e o estado inicial Aberto.
  await expect(page.getByText(/Pedido Nº \d+ criado com sucesso\./)).toBeVisible();
  await expect(page.getByText('Aberto', { exact: true })).toBeVisible();

  // O identificador do pedido vem da consulta id presente na URL.
  const orderId = new URL(page.url()).searchParams.get('id');
  expect(orderId).toBeTruthy();

  // poll espera até o estoque aparecer com a quantidade já descontada.
  await page.getByRole('link', { name: 'Produtos' }).click();
  await expect.poll(readStock).toBe(stockBefore - orderQuantity);

  // Abre o pedido criado e aceita o diálogo de confirmação do navegador.
  await page.goto(`/pedido.html?id=${orderId}`);
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Cancelar pedido' }).click();

  // Confirma a mensagem e o estado Cancelado.
  await expect(page.getByText(`Pedido Nº ${orderId} cancelado.`)).toBeVisible();
  await expect(page.getByText('Cancelado', { exact: true })).toBeVisible();

  // Retorna aos produtos e espera que o estoque tenha sido restaurado.
  await page.getByRole('link', { name: 'Produtos' }).click();
  await expect.poll(readStock).toBe(stockBefore);
});

// Segundo cenário: impede a criação de item cuja quantidade supera o estoque.
test('novo pedido bloqueia quantidade acima do estoque', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Executa os fluxos de pedido uma vez por execução.');
  const stock = await openNewOrder(page);

  // Informa uma unidade a mais que a quantidade disponível.
  await page.getByRole('spinbutton', { name: 'Quantidade' }).fill(String(stock + 1));
  await page.getByRole('button', { name: 'Adicionar' }).click();

  // A interface mostra o limite, não adiciona item e desabilita a confirmação.
  await expect(page.getByText(`Quantidade acima do estoque (${stock} disponíveis)`)).toBeVisible();
  await expect(page.getByText('Nenhum item adicionado.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirmar pedido' })).toBeDisabled();
});

// Terceiro cenário: valida que apenas quantidades inteiras positivas são aceitas.
test('novo pedido rejeita quantidades zero e negativas', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Executa os fluxos de pedido uma vez por execução.');
  await openNewOrder(page);

  // Percorre cada quantidade inválida usando o mesmo fluxo de interação.
  for (const quantity of ['0', '-1']) {
    await page.getByRole('spinbutton', { name: 'Quantidade' }).fill(quantity);
    await page.getByRole('button', { name: 'Adicionar' }).click();

    // A mesma validação deve aparecer para ambos os valores.
    await expect(page.getByText('Informe uma quantidade inteira a partir de 1')).toBeVisible();
    await expect(page.getByText('Nenhum item adicionado.')).toBeVisible();
  }
});
