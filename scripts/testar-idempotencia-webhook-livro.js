// Teste b) da Fase 2: reenviar o MESMO evento do webhook Stripe (mesmo
// corpo, mesma assinatura) duas vezes seguidas contra o servidor local, e
// confirmar que o fulfillment do produto 'livro' não roda duas vezes.
//
// Cria um pedido pendente real via /api/checkout/livro/stripe-session,
// depois constrói um evento checkout.session.completed sintético (mesmo
// formato que o Stripe manda), assinado com o STRIPE_WEBHOOK_SECRET local,
// e o envia duas vezes ao /api/webhooks/stripe.
//
// Uso: node testar-idempotencia-webhook-livro.js <livroId>

require('dotenv').config();
const Stripe = require('stripe');
const http = require('http');

const BASE_URL = 'http://localhost:8091';
const livroId = process.argv[2];
if (!livroId) {
  console.error('Uso: node testar-idempotencia-webhook-livro.js <livroId>');
  process.exit(1);
}

const WEBHOOK_SECRET = process.argv.find(a => a.startsWith('--secret='))?.split('=')[1] || process.env.STRIPE_WEBHOOK_SECRET;

function postJson(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    }, (res) => {
      let chunks = '';
      res.on('data', (c) => chunks += c);
      res.on('end', () => resolve({ status: res.statusCode, body: chunks }));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function postRaw(path, rawBody, headers) {
  return new Promise((resolve, reject) => {
    const req = http.request(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: { ...headers, 'Content-Length': Buffer.byteLength(rawBody) }
    }, (res) => {
      let chunks = '';
      res.on('data', (c) => chunks += c);
      res.on('end', () => resolve({ status: res.statusCode, body: chunks }));
    });
    req.on('error', reject);
    req.write(rawBody);
    req.end();
  });
}

(async () => {
  const email = `teste.zuni.idempotencia.${Date.now()}@example.com`;

  console.log(`[IDEMPOTENCIA] Criando pedido pendente real (livro=${livroId}, email=${email})...`);
  const criacao = await postJson('/api/checkout/livro/stripe-session', {
    livroId, name: 'Teste Idempotencia', email, audiolivroIncluido: false
  });
  const { pedidoId } = JSON.parse(criacao.body);
  if (!pedidoId) throw new Error('Não recebi pedidoId: ' + criacao.body);
  console.log(`[IDEMPOTENCIA] pedidoId criado: ${pedidoId}`);

  const fakeSessionId = `cs_test_synthetic_${pedidoId.slice(0, 12)}`;

  const eventPayload = {
    id: `evt_synthetic_${Date.now()}`,
    object: 'event',
    type: 'checkout.session.completed',
    data: {
      object: {
        id: fakeSessionId,
        object: 'checkout.session',
        client_reference_id: pedidoId,
        payment_status: 'paid',
        metadata: { pedidoId, fulfillment_type: 'livro' }
      }
    }
  };

  const rawBody = JSON.stringify(eventPayload);
  const header = Stripe.webhooks.generateTestHeaderString({
    payload: rawBody,
    secret: WEBHOOK_SECRET
  });

  console.log(`[IDEMPOTENCIA] Enviando o evento sintético (1ª vez), stripe_session_id=${fakeSessionId}...`);
  const r1 = await postRaw('/api/webhooks/stripe', rawBody, {
    'Content-Type': 'application/json',
    'Stripe-Signature': header
  });
  console.log(`[IDEMPOTENCIA] 1ª entrega -> status ${r1.status}, body ${r1.body}`);

  await new Promise(r => setTimeout(r, 1500));

  console.log('[IDEMPOTENCIA] Reenviando o MESMO evento (corpo e assinatura idênticos), 2ª vez...');
  const r2 = await postRaw('/api/webhooks/stripe', rawBody, {
    'Content-Type': 'application/json',
    'Stripe-Signature': header
  });
  console.log(`[IDEMPOTENCIA] 2ª entrega -> status ${r2.status}, body ${r2.body}`);

  console.log(`[IDEMPOTENCIA] pedidoId para conferência no Supabase: ${pedidoId}`);
})().catch((e) => {
  console.error('[IDEMPOTENCIA] ERRO:', e);
  process.exit(1);
});
