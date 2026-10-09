// REGRESSÃO COMERCIAL local: servidor REAL (src/server.js) com Supabase/Claude/Resend FALSOS e webhooks do Stripe ASSINADOS
// localmente (nenhuma chamada ao Stripe, nenhuma cobrança). Cobre: fulfillment de livro e de sessão (ZUNI Direciona),
// idempotência do webhook, acesso às obras por token, e a entrega da Síntese (PDF/e-mail) depois da compra.
// Reembolso/disputa: coberto por scripts/testar-estorno-stripe.js (a rota exige consultar a API do Stripe).
// Uso: node scripts/testar-regressao-comercial-fake.js
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

const SEGREDO = 'segredo-de-teste-local-nao-real-0123456789';
const WHSEC = 'whsec_teste_local_nao_real_0123456789';
process.env.SESSION_TOKEN_SECRET = SEGREDO;
const raiz = path.join(__dirname, '..');
const T = require(path.join(raiz, 'src/lib/sessionToken'));
const Stripe = require(path.join(raiz, 'node_modules/stripe'));
const stripeLocal = new Stripe('sk_test_falsa_local');

let total = 0, ok = 0; const falhas = [];
async function teste(nome, fn) { total++; try { await fn(); ok++; console.log(`  ok   ${nome}`); } catch (e) { falhas.push(nome); console.log(`  FAIL ${nome}\n       ${String(e.message).split('\n')[0]}`); } }

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'zuni-reg-'));
  const seed = path.join(tmp, 'seed.json'), dump = path.join(tmp, 'dump.json'), emailLog = path.join(tmp, 'emails.log');
  const hist = []; for (let i = 0; i < 6; i++) { hist.push({ role: 'user', message: 'pergunta ' + i }); hist.push({ role: 'assistant', message: 'resposta ' + i }); }
  const SESS = 'ffffffff-1111-4222-8333-444444444446';
  fs.writeFileSync(seed, JSON.stringify({
    checkout_pedidos_pendentes: [
      { id: 'ped-livro-1', fulfillment_type: 'livro', payload: { livroId: 'ela-tem-classe', email: 'leitora@example.test', audiolivroIncluido: false, origem: 'universo-feminino' }, valor_pago: 34.9, processado_em: null },
      { id: 'ped-combo-1', fulfillment_type: 'livro', payload: { livroId: 'ela-tem-classe', email: 'combo@example.test', audiolivroIncluido: true }, valor_pago: 54.8, processado_em: null },
      { id: 'ped-naopago-1', fulfillment_type: 'livro', payload: { livroId: 'ela-tem-classe', email: 'naopago@example.test', audiolivroIncluido: false }, valor_pago: 34.9, processado_em: null },
      { id: 'ped-falhou-1', fulfillment_type: 'livro', payload: { livroId: 'ela-tem-classe', email: 'falhou@example.test', audiolivroIncluido: false }, valor_pago: 34.9, processado_em: null }
    ],
    sessions: [{ session_id: SESS, name: 'Cliente Direciona', email: 'direciona@example.test', paid: false, message_count: 12, history: hist, product_type: 'chat-mentor', relatorio_gerado: false }]
  }));
  const PORTA = 19900 + Math.floor(Math.random() * 90);
  const env = { ...process.env, PORT: String(PORTA), SESSION_TOKEN_SECRET: SEGREDO, AUTH_CORTE_TS: '0', SUPABASE_URL: 'https://falso.example.test', SUPABASE_KEY: 'chave-falsa', ANTHROPIC_API_KEY: 'chave-falsa', RESEND_API_KEY: 're_falsa', RESEND_FROM_EMAIL: 'ZUNI <nao-responda@example.test>', STRIPE_SECRET_KEY: 'sk_test_falsa_local', STRIPE_WEBHOOK_SECRET: WHSEC, STRIPE_PUBLISHABLE_KEY: 'pk_test_falsa', FRONTEND_URL: 'http://localhost:' + PORTA, FAKE_DB_SEED: seed, FAKE_DB_DUMP: dump, FAKE_EMAIL_LOG: emailLog };
  for (const k of ['OPENAI_API_KEY', 'ROTA_TESTE_RELATORIO', 'DEMO_LIMITES_PERSISTENTES', 'MERCADOPAGO_TOKEN']) delete env[k];
  const filho = spawn(process.execPath, ['-r', path.join(raiz, 'scripts/suporte/preload-ambiente-falso.js'), path.join(raiz, 'src/server.js')], { cwd: raiz, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = ''; filho.stdout.on('data', (d) => { log += d; }); filho.stderr.on('data', (d) => { log += d; });
  const req = (metodo, caminho, { headers = {}, corpo, bruto } = {}) => new Promise((resolve, reject) => {
    const dados = bruto !== undefined ? bruto : (corpo === undefined ? null : JSON.stringify(corpo));
    const r = http.request({ host: '127.0.0.1', port: PORTA, method: metodo, path: caminho, headers: { ...(dados ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(dados) } : {}), ...headers } }, (res) => {
      const p = []; res.on('data', (d) => p.push(d)); res.on('end', () => { const buf = Buffer.concat(p); resolve({ status: res.statusCode, headers: res.headers, buf, corpo: buf.toString('utf8') }); });
    }); r.on('error', reject); if (dados) r.write(dados); r.end();
  });
  const db = () => JSON.parse(fs.readFileSync(dump, 'utf8'));
  const emails = () => (fs.existsSync(emailLog) ? fs.readFileSync(emailLog, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);
  let seq = 1;
  const evento = (tipo, sessaoStripe) => JSON.stringify({ id: 'evt_teste_' + (seq++), object: 'event', api_version: '2026-08-26.dahlia', type: tipo, data: { object: { object: 'checkout.session', ...sessaoStripe } } });
  const enviarWebhook = (corpo, assinaturaValida = true) => {
    const header = stripeLocal.webhooks.generateTestHeaderString({ payload: corpo, secret: assinaturaValida ? WHSEC : 'whsec_outro_segredo_0123456789' });
    return req('POST', '/api/webhooks/stripe', { headers: { 'stripe-signature': header, 'Content-Type': 'application/json' }, bruto: corpo });
  };

  try {
    let subiu = false; for (let i = 0; i < 160 && !subiu; i++) { await new Promise((r) => setTimeout(r, 250)); try { await req('GET', '/api/livros'); subiu = true; } catch (_) { /* aguardando */ } }
    assert.ok(subiu, 'servidor de teste não subiu: ' + log.slice(-300));

    console.log('== Livros: webhook, fulfillment, e-mail, idempotência, acesso ==');
    let tokenLivro = '';
    const completoLivro = evento('checkout.session.completed', { id: 'cs_teste_livro_1', payment_status: 'paid', client_reference_id: 'ped-livro-1', metadata: { fulfillment_type: 'livro', pedidoId: 'ped-livro-1' } });
    await teste('livro: webhook assinado => 1 acesso, 1 e-mail ao comprador, pedido marcado como processado', async () => {
      const r = await enviarWebhook(completoLivro); assert.strictEqual(r.status, 200, r.corpo);
      const acessos = db().acessos_livros || []; assert.strictEqual(acessos.length, 1); assert.strictEqual(acessos[0].email, 'leitora@example.test'); assert.strictEqual(acessos[0].livro_id, 'ela-tem-classe'); tokenLivro = acessos[0].token;
      const mails = emails().filter((m) => m.to === 'leitora@example.test'); assert.strictEqual(mails.length, 1); assert.ok(mails[0].html.includes(tokenLivro) || /livros\/ela-tem-classe/.test(mails[0].html), 'e-mail sem o link de acesso');
      assert.ok(db().checkout_pedidos_pendentes.find((p) => p.id === 'ped-livro-1').processado_em);
    });
    await teste('livro: REENTREGA do mesmo evento (e outro tipo de evento do mesmo pagamento) NÃO duplica acesso nem e-mail', async () => {
      assert.strictEqual((await enviarWebhook(completoLivro)).status, 200);
      assert.strictEqual((await enviarWebhook(evento('checkout.session.async_payment_succeeded', { id: 'cs_teste_livro_1', payment_status: 'paid', client_reference_id: 'ped-livro-1', metadata: { fulfillment_type: 'livro', pedidoId: 'ped-livro-1' } }))).status, 200);
      assert.strictEqual((db().acessos_livros || []).filter((a) => a.email === 'leitora@example.test').length, 1); assert.strictEqual(emails().filter((m) => m.to === 'leitora@example.test').length, 1);
    });
    await teste('livro + audiolivro: 2 acessos (livro e audiolivro) e 1 e-mail', async () => {
      assert.strictEqual((await enviarWebhook(evento('checkout.session.completed', { id: 'cs_teste_combo_1', payment_status: 'paid', metadata: { fulfillment_type: 'livro', pedidoId: 'ped-combo-1' } }))).status, 200);
      const a = (db().acessos_livros || []).filter((x) => x.email === 'combo@example.test'); assert.strictEqual(a.length, 2); assert.deepStrictEqual(a.map((x) => x.tipo_produto).sort(), ['audiolivro', 'livro']);
      assert.strictEqual(emails().filter((m) => m.to === 'combo@example.test').length, 1);
    });
    await teste('livro: não pago (payment_status=unpaid) e pagamento assíncrono falho NÃO liberam acesso', async () => {
      assert.strictEqual((await enviarWebhook(evento('checkout.session.completed', { id: 'cs_np', payment_status: 'unpaid', metadata: { fulfillment_type: 'livro', pedidoId: 'ped-naopago-1' } }))).status, 200);
      assert.strictEqual((await enviarWebhook(evento('checkout.session.async_payment_failed', { id: 'cs_f', payment_status: 'unpaid', metadata: { fulfillment_type: 'livro', pedidoId: 'ped-falhou-1' } }))).status, 200);
      assert.strictEqual((db().acessos_livros || []).filter((a) => /naopago|falhou/.test(a.email)).length, 0);
    });
    await teste('assinatura inválida => 400 e nada é processado; tipo de fulfillment desconhecido => 200 sem efeito', async () => {
      const antes = (db().acessos_livros || []).length;
      assert.strictEqual((await enviarWebhook(evento('checkout.session.completed', { id: 'cs_x', payment_status: 'paid', metadata: { fulfillment_type: 'livro', pedidoId: 'ped-falhou-1' } }), false)).status, 400);
      assert.strictEqual((await req('POST', '/api/webhooks/stripe', { headers: { 'Content-Type': 'application/json' }, bruto: '{}' })).status, 400);
      assert.strictEqual((await enviarWebhook(evento('checkout.session.completed', { id: 'cs_y', payment_status: 'paid', metadata: { fulfillment_type: 'inexistente' } }))).status, 200);
      assert.strictEqual((db().acessos_livros || []).length, antes);
    });
    await teste('acesso às obras: token válido abre o livro (200); token errado, de outro livro ou ausente => 403', async () => {
      const ok1 = await req('GET', `/livros/ela-tem-classe?token=${tokenLivro}`); assert.strictEqual(ok1.status, 200, 'status ' + ok1.status); assert.ok(ok1.buf.length > 1000);
      const t1 = await req('GET', '/livros/ela-tem-classe?token=nao-existe'); assert.strictEqual(t1.status, 403, 'token errado => ' + t1.status);
      const t2 = await req('GET', '/livros/ela-tem-classe'); assert.strictEqual(t2.status, 403, 'sem token => ' + t2.status);
      const t3 = await req('GET', `/livros/codigo-feminino?token=${tokenLivro}`); assert.strictEqual(t3.status, 403, 'outro livro => ' + t3.status);
      // Entrega privada do audiolivro (URL assinada no Storage) não é simulável aqui: coberta por testar-audiolivro-privado-stage0.js (mocks).
    });

    console.log('== ZUNI Direciona: pagamento => sessão paga => Síntese ==');
    await teste('direciona: webhook marca a sessão como paga UMA vez (reentrega ignorada)', async () => {
      const ev = evento('checkout.session.completed', { id: 'cs_teste_dir_1', payment_status: 'paid', client_reference_id: SESS, metadata: { fulfillment_type: 'chat-mentor', sessionId: SESS } });
      assert.strictEqual((await enviarWebhook(ev)).status, 200); assert.strictEqual((await enviarWebhook(ev)).status, 200);
      const s = db().sessions.find((x) => x.session_id === SESS); assert.strictEqual(s.paid, true); assert.strictEqual(s.stripe_session_id, 'cs_teste_dir_1');
    });
    await teste('direciona: depois de paga, a Síntese sai em PDF (com token) e por e-mail; sem token => 401', async () => {
      const token = T.gerarTokenSessao(SESS, 'chat', T.VALIDADE_CHAT_MS);
      assert.strictEqual((await req('GET', '/api/relatorio/download/' + SESS)).status, 401);
      const pdf = await req('GET', '/api/relatorio/download/' + SESS, { headers: { 'X-Zuni-Sessao': token } }); assert.strictEqual(pdf.status, 200); assert.strictEqual(pdf.buf.slice(0, 4).toString(), '%PDF');
      const antes = emails().length;
      const env1 = await req('POST', '/api/relatorio/enviar-email', { headers: { 'X-Zuni-Sessao': token }, corpo: { sessionId: SESS, email: 'direciona@example.test' } }); assert.strictEqual(env1.status, 200, env1.corpo);
      const novo = emails().slice(antes).find((m) => m.to === 'direciona@example.test'); assert.ok(novo && novo.anexos.length === 1 && /pdf/i.test(novo.anexos[0]), JSON.stringify(emails().slice(antes).map((m) => [m.to, m.anexos])));
      assert.strictEqual(db().sessions.find((x) => x.session_id === SESS).email, 'direciona@example.test');
    });
    await teste('ZUNI Direciona (/api/chat REAL): conversa normal intacta; risco alto recebe o rodapé aprovado ao final; sessão encerrada por limite também', async () => {
      const token = T.gerarTokenSessao(SESS, 'chat', T.VALIDADE_CHAT_MS); const h = { 'X-Zuni-Sessao': token };
      const normal = await req('POST', '/api/chat', { headers: h, corpo: { sessionId: SESS, message: 'Como organizar minha rotina de estudos?' } }); assert.strictEqual(normal.status, 200, normal.corpo.slice(0, 160));
      const textoNormal = JSON.parse(normal.corpo).texto; assert.ok(textoNormal.length > 10 && !/CVV|SAMU|Disque-Intoxica/.test(textoNormal), 'rodapé indevido em conversa normal');
      const risco = await req('POST', '/api/chat', { headers: h, corpo: { sessionId: SESS, message: 'estou pensando em me matar' } }); assert.strictEqual(risco.status, 200);
      const tr = JSON.parse(risco.corpo).texto; assert.ok(tr.startsWith(textoNormal.slice(0, 20)) || tr.length > textoNormal.length); assert.ok(tr.endsWith('Se houver perigo imediato, ligue para o SAMU, 192, ou procure atendimento de emergência.'), tr.slice(-200));
      assert.ok(tr.includes('CVV, 188 (24 horas)'));
      await req('POST', '/api/chat', { headers: h, corpo: { sessionId: SESS, message: 'Obrigada, isso ajuda.' } }); // 15ª troca; a próxima passa do limite
      const limite = await req('POST', '/api/chat', { headers: h, corpo: { sessionId: SESS, message: 'quero me matar mesmo' } }); const lj = JSON.parse(limite.corpo); assert.strictEqual(lj.sessaoEncerrada, true); assert.ok(lj.texto.endsWith('procure atendimento de emergência.'), 'encerramento por limite sem rodapé');
    });
    await teste('logs do servidor: sem segredo de sessão, sem chave de webhook, sem token de livro', async () => {
      assert.ok(!log.includes(SEGREDO) && !log.includes(WHSEC)); assert.ok(!log.includes(tokenLivro), 'token de livro no log');
    });
  } finally { filho.kill(); }

  console.log(`\nTotal: ${total} | Passaram: ${ok} | Falharam: ${falhas.length}`);
  if (falhas.length) { console.log('Falhas:', falhas.join('; ')); process.exit(1); }
})().catch((e) => { console.error('ERRO FATAL', e.message); process.exit(1); });
