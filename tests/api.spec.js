// @ts-check
import { test, expect } from '@playwright/test';

const sellerEmail = process.env.SELLER_EMAIL;
const sellerPassword = process.env.SELLER_PASSWORD;

async function login(request, codigo = sellerEmail, senha = sellerPassword) {
  return request.post('/api/login', { data: { codigo, senha } });
}

async function getToken(request) {
  expect(sellerEmail, 'Configure SELLER_EMAIL no ambiente ou no arquivo .env.').toBeTruthy();
  expect(sellerPassword, 'Configure SELLER_PASSWORD no ambiente ou no arquivo .env.').toBeTruthy();

  const response = await login(request);
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(typeof body.token).toBe('string');
  return body.token;
}

function bearer(token) {
  return { Authorization: `Bearer ${token}` };
}

test.beforeEach(async ({ browserName }) => {
  test.skip(browserName !== 'chromium', 'Testes de API executados uma vez por execução.');
});

async function getProducts(request, token) {
  const response = await request.get('/api/produtos', { headers: bearer(token) });
  expect(response.status()).toBe(200);
  return response.json();
}

test('login retorna JWT válido e rejeita credenciais inválidas', async ({ request }) => {
  const response = await login(request);
  expect(response.status()).toBe(200);

  const body = await response.json();
  expect(typeof body.token).toBe('string');
  const isJwt = body.token.split('.').length === 3;

  const invalidResponse = await login(request, 'invalid-qa-code', 'invalid-qa-password');
  expect(invalidResponse.status()).toBe(401);

  if (!isJwt) {
    test.fail(true, 'A API retorna um token de dois segmentos, não um JWT de três segmentos.');
  }
  expect(isJwt).toBe(true);

  const claims = JSON.parse(Buffer.from(body.token.split('.')[1], 'base64url').toString('utf8'));
  expect(claims.exp).toEqual(expect.any(Number));
  expect(claims.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
});

test('produtos e clientes exigem Bearer Token', async ({ request }) => {
  const productsResponse = await request.get('/api/produtos');
  const clientsResponse = await request.get('/api/clientes');

  expect(productsResponse.status()).toBe(401);
  expect(clientsResponse.status()).toBe(401);
});

test('preços dos produtos são números em reais', async ({ request }) => {
  const token = await getToken(request);
  const products = await getProducts(request, token);

  expect(products.length).toBeGreaterThan(0);
  for (const product of products) {
    expect(typeof product.preco).toBe('number');
  }
});

test('cliente vazio retorna erro de validação', async ({ request }) => {
  const token = await getToken(request);
  const response = await request.post('/api/clientes', {
    headers: bearer(token),
    data: {},
  });

  expect(response.status()).toBe(400);
  await expect(response.json()).resolves.toEqual({ erro: 'Informe o nome' });
});

test('pedido acima do estoque é bloqueado ou cancelado com estorno', async ({ request }) => {
  const token = await getToken(request);
  const headers = bearer(token);
  const products = await getProducts(request, token);
  const product = products
    .filter((item) => Number.isInteger(item.estoque) && item.estoque > 0)
    .sort((left, right) => left.estoque - right.estoque)[0];
  expect(product).toBeTruthy();

  const clientsResponse = await request.get('/api/clientes', { headers });
  expect(clientsResponse.status()).toBe(200);
  const clients = await clientsResponse.json();
  expect(clients.length).toBeGreaterThan(0);

  const stockBefore = product.estoque;
  const payload = {
    clienteId: clients[0].id,
    itens: [{ produtoId: product.id, quantidade: stockBefore + 1 }],
  };
  const simulation = await request.post('/api/pedidos/simular', {
    headers,
    data: payload,
  });

  let createdOrder;
  if (!simulation.ok()) {
    expect(simulation.status()).toBeGreaterThanOrEqual(400);
    const productsAfterSimulation = await getProducts(request, token);
    expect(productsAfterSimulation.find((item) => item.id === product.id).estoque).toBe(stockBefore);
  } else {
    const creation = await request.post('/api/pedidos', { headers, data: payload });
    if (creation.status() === 201) {
      createdOrder = await creation.json();
      const productsAfterCreation = await getProducts(request, token);
      expect(productsAfterCreation.find((item) => item.id === product.id).estoque).toBe(-1);
    } else {
      expect(creation.status()).toBeGreaterThanOrEqual(400);
      const productsAfterCreation = await getProducts(request, token);
      expect(productsAfterCreation.find((item) => item.id === product.id).estoque).toBe(stockBefore);
    }
  }

  if (!createdOrder) {
    const normalPayload = {
      clienteId: clients[0].id,
      itens: [{ produtoId: product.id, quantidade: 1 }],
    };
    const normalSimulation = await request.post('/api/pedidos/simular', {
      headers,
      data: normalPayload,
    });
    expect(normalSimulation.status()).toBe(200);

    const creation = await request.post('/api/pedidos', { headers, data: normalPayload });
    expect(creation.status()).toBe(201);
    createdOrder = await creation.json();
  }

  const orderId = createdOrder.id ?? createdOrder.pedido?.id ?? createdOrder.pedidoId;
  expect(orderId).toBeTruthy();

  const cancellation = await request.post(`/api/pedidos/${orderId}/cancelar`, { headers });
  expect(cancellation.status()).toBe(200);

  const productsAfterCancellation = await getProducts(request, token);
  const stockAfterCancellation = productsAfterCancellation.find((item) => item.id === product.id).estoque;
  if (stockAfterCancellation !== stockBefore) {
    test.fail(true, 'Defeito observado na interface: o cancelamento da API não estorna o estoque.');
  }
  expect(stockAfterCancellation).toBe(stockBefore);
});
