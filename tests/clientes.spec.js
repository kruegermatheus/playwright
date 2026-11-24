
// Importa as ferramentas usadas neste arquivo de testes de interface.
import { test, expect } from '@playwright/test';

// Função auxiliar que faz login pela interface antes de cada fluxo de clientes.
async function loginSeller(page) {
  // Credenciais obtidas das variáveis de ambiente para não deixar senhas no código.
  const sellerEmail = process.env.SELLER_EMAIL;
  const sellerPassword = process.env.SELLER_PASSWORD;

  // Interrompe o teste com uma mensagem clara caso alguma credencial esteja ausente.
  expect(sellerEmail, 'Configure SELLER_EMAIL no ambiente ou no arquivo .env.').toBeTruthy();
  expect(sellerPassword, 'Configure SELLER_PASSWORD no ambiente ou no arquivo .env.').toBeTruthy();

  // Acessa a página inicial e preenche os campos encontrados pelos rótulos visíveis.
  await page.goto('/');
  await page.getByLabel('Código de acesso').fill(sellerEmail);
  await page.getByLabel('Senha').fill(sellerPassword);

  // Clica no botão Entrar e espera a navegação para o catálogo de produtos.
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/produtos\.html$/);
}

// Primeiro cenário: autentica, navega até clientes e verifica o filtro pelo nome.
test('filtro de clientes retorna correspondências pelo nome', async ({ page }) => {
  await loginSeller(page);

  // Navega diretamente para a página de clientes.
  await page.goto('/clientes.html');

  // Preenche o campo de busca pelo papel searchbox e pelo nome acessível.
  await page.getByRole('searchbox', { name: 'Buscar por nome' }).fill('Ébano');

  // Executa a busca por meio do botão com o nome Buscar.
  await page.getByRole('button', { name: 'Buscar' }).click();

  // Localiza uma linha da tabela que contém o cliente esperado.
  const matchingRow = page.getByRole('row').filter({ hasText: 'Viveiro Ébano Ltda' });
  await expect(matchingRow).toBeVisible();

  // Confirma que um cliente não correspondente deixou de aparecer na tabela.
  await expect(
    page.getByRole('row').filter({ hasText: 'Agropecuária Boa Vista Ltda' }),
  ).toHaveCount(0);
});

// Segundo cenário: tenta salvar um cliente sem preencher os campos obrigatórios.
test('formulário vazio de cliente mostra validação obrigatória', async ({ page }) => {
  await loginSeller(page);
  await page.goto('/clientes.html');

  // Envia o formulário vazio.
  await page.getByRole('button', { name: 'Salvar cliente' }).click();

  // Verifica a mensagem de validação exibida pela interface.
  await expect(page.getByText('Não foi possível salvar: Informe o nome')).toBeVisible();
});
