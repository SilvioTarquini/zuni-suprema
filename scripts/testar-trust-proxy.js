// trust proxy (Railway, 1 salto) — cada cliente tem o seu próprio balde nos limitadores por IP, e o IP não é forjável.
//
// Sobe os limitadores REAIS (routes/livroChat.js e routes/experimenteLivroChat.js: 30 pedidos / 15 min por IP) num app configurado por
// lib/trustProxy.js e imita a borda da Railway enviando X-Forwarded-For com o IP do cliente. Confere:
//   - dois IPs separados: o cliente A esgota os 30 pedidos e leva 429; o cliente B, logo depois, ainda passa (não é 429);
//   - o cliente não escapa forjando entradas à esquerda de X-Forwarded-For;
//   - SEM trust proxy (o comportamento antigo) os dois clientes dividem um balde: B leva 429 — é o defeito que a correção resolve;
//   - nenhum ERR_ERL_UNEXPECTED_X_FORWARDED_FOR com a configuração nova; com a antiga o aviso aparece;
//   - TRUST_PROXY_HOPS (padrão 1; valor inválido volta ao padrão; 0 desliga) e a linha única de diagnóstico [TRUST_PROXY] (sem IP).
// Uso: node scripts/testar-trust-proxy.js

const assert = require('assert');
const http = require('http');
const express = require('express');

process.env.SUPABASE_URL = 'https://fake-project.invalid';
process.env.SUPABASE_KEY = 'FAKE_SECRET_KEY_FOR_TESTS_ONLY';
process.env.ANTHROPIC_API_KEY = 'fake';
globalThis.fetch = async () => { throw new Error('rede proibida no teste'); };
const supaPath = require.resolve('@supabase/supabase-js');
require.cache[supaPath] = { id: supaPath, filename: supaPath, loaded: true, exports: { createClient: () => ({ from: () => ({ select() { return this; }, eq() { return this; }, single: async () => ({ data: null, error: null }), then(r) { return Promise.resolve({ error: null }).then(r); } }), rpc: async () => ({ data: [], error: null }) }) } };

const { configurarTrustProxy, diagnosticoUmaVez, saltosDeProxy } = require('../src/lib/trustProxy');

const CLIENTE_A = '203.0.113.10'; const CLIENTE_B = '198.51.100.20';
function post(porta, caminho, xff) {
  return new Promise((resolve, reject) => {
    const corpo = JSON.stringify({});
    const req = http.request({ host: '127.0.0.1', port: porta, path: caminho, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(corpo), ...(xff ? { 'X-Forwarded-For': xff } : {}) } }, (res) => { res.resume(); res.on('end', () => resolve(res.statusCode)); });
    req.on('error', reject); req.end(corpo);
  });
}
async function montar(comTrustProxy) {
  // roteadores novos a cada app: o contador de cada limitador começa do zero
  for (const m of ['../src/routes/livroChat', '../src/routes/experimenteLivroChat']) delete require.cache[require.resolve(m)];
  const app = express();
  const erros = []; const eo = console.error; const wo = console.warn;
  const capturar = (...a) => { erros.push(a.map(String).join(' ')); };
  console.error = capturar; console.warn = capturar;
  if (comTrustProxy) configurarTrustProxy(app, {});
  app.use('/', require('../src/routes/livroChat'));
  app.use('/', require('../src/routes/experimenteLivroChat'));
  const srv = await new Promise((r) => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
  return { porta: srv.address().port, erros, fechar: () => { console.error = eo; console.warn = wo; srv.close(); } };
}

let total = 0; const falhas = [];
async function teste(nome, fn) { total++; try { await fn(); console.log(`  ok   ${nome}`); } catch (e) { falhas.push(nome); console.log(`  FALHOU ${nome}: ${e.message.split('\n')[0]}`); } }

(async () => {
  const ROTA = '/api/livro-chat';
  console.log('Configuração');
  await teste('padrão 1 salto; TRUST_PROXY_HOPS válido é usado; inválido volta ao padrão; 0 desliga', () => {
    assert.strictEqual(saltosDeProxy({}), 1); assert.strictEqual(saltosDeProxy({ TRUST_PROXY_HOPS: '2' }), 2);
    assert.strictEqual(saltosDeProxy({ TRUST_PROXY_HOPS: 'abc' }), 1); assert.strictEqual(saltosDeProxy({ TRUST_PROXY_HOPS: '' }), 1);
    const a = express(); assert.strictEqual(configurarTrustProxy(a, {}), 1); assert.strictEqual(a.get('trust proxy'), 1);
    const b = express(); assert.strictEqual(configurarTrustProxy(b, { TRUST_PROXY_HOPS: '0' }), 0); assert.strictEqual(b.get('trust proxy'), false);
  });

  console.log('Dois IPs separados (limitador real: 30 pedidos por 15 min)');
  await teste('cliente A esgota o limite (429 no 31º) e o cliente B, em seguida, NÃO é bloqueado', async () => {
    const s = await montar(true);
    try {
      const statusA = []; for (let i = 0; i < 31; i++) statusA.push(await post(s.porta, ROTA, CLIENTE_A));
      assert.ok(statusA.slice(0, 30).every((c) => c !== 429), 'A foi limitado cedo demais: ' + statusA.join(','));
      assert.strictEqual(statusA[30], 429, 'A não foi limitado no 31º');
      const b = await post(s.porta, ROTA, CLIENTE_B); assert.notStrictEqual(b, 429, 'B foi bloqueado pelo balde de A');
    } finally { s.fechar(); }
  });
  await teste('o limite vale por rota-limitador: a rota da degustação também separa os IPs', async () => {
    const s = await montar(true);
    try {
      for (let i = 0; i < 31; i++) await post(s.porta, '/api/experimente-livro-chat', CLIENTE_A);
      assert.strictEqual(await post(s.porta, '/api/experimente-livro-chat', CLIENTE_A), 429);
      assert.notStrictEqual(await post(s.porta, '/api/experimente-livro-chat', CLIENTE_B), 429);
    } finally { s.fechar(); }
  });
  await teste('forjar entradas à esquerda de X-Forwarded-For não escapa do limite (a borda anexa o IP real à direita)', async () => {
    const s = await montar(true);
    try {
      for (let i = 0; i < 30; i++) await post(s.porta, ROTA, CLIENTE_A);
      const forjado = await post(s.porta, ROTA, `192.0.2.250, ${CLIENTE_A}`);
      assert.strictEqual(forjado, 429, 'o cliente trocou de identidade forjando o cabeçalho');
      const outroForjado = await post(s.porta, ROTA, `${CLIENTE_B}, ${CLIENTE_A}`); // finge ser B, mas a borda anexou A
      assert.strictEqual(outroForjado, 429);
    } finally { s.fechar(); }
  });
  await teste('configuração nova: nenhum ERR_ERL_UNEXPECTED_X_FORWARDED_FOR', async () => {
    const s = await montar(true);
    try { await post(s.porta, ROTA, CLIENTE_A); await post(s.porta, ROTA, CLIENTE_B); assert.ok(!s.erros.some((e) => /ERR_ERL/.test(e)), s.erros.join(' | ').slice(0, 200)); } finally { s.fechar(); }
  });

  console.log('Comportamento ANTIGO (sem trust proxy) — o defeito');
  await teste('sem trust proxy os dois IPs dividem UM balde: B leva 429 por culpa de A (e o aviso ERR_ERL aparece)', async () => {
    const s = await montar(false);
    try {
      for (let i = 0; i < 31; i++) await post(s.porta, ROTA, CLIENTE_A);
      const b = await post(s.porta, ROTA, CLIENTE_B);
      assert.strictEqual(b, 429, 'esperava reproduzir o defeito (balde único)');
      assert.ok(s.erros.some((e) => /ERR_ERL_UNEXPECTED_X_FORWARDED_FOR/.test(e)), 'o aviso ERR_ERL não apareceu');
    } finally { s.fechar(); }
  });

  console.log('Diagnóstico');
  await teste('[TRUST_PROXY]: uma linha só por processo, só contagens (sem IP), na primeira requisição com X-Forwarded-For', async () => {
    const linhas = []; const app = express(); const n = configurarTrustProxy(app, {});
    app.use(diagnosticoUmaVez(n, (l) => linhas.push(l))); app.get('/', (q, r) => r.send('ok'));
    const srv = await new Promise((r) => { const s = app.listen(0, '127.0.0.1', () => r(s)); }); const porta = srv.address().port;
    const get = (xff) => new Promise((res) => http.get({ host: '127.0.0.1', port: porta, path: '/', headers: xff ? { 'X-Forwarded-For': xff } : {} }, (r) => { r.resume(); r.on('end', res); }));
    await get(null); await get(CLIENTE_A); await get(`1.2.3.4, ${CLIENTE_B}`); srv.close();
    assert.strictEqual(linhas.length, 1, linhas.join('|'));
    assert.strictEqual(linhas[0], '[TRUST_PROXY] saltos=1 entradas_xff=1 req_ip_e_a_ultima_entrada=true');
    assert.ok(!/\d+\.\d+\.\d+\.\d+/.test(linhas[0]), 'a linha contém IP');
  });

  console.log(`\n${total - falhas.length}/${total} ok${falhas.length ? '\nFALHARAM:\n - ' + falhas.join('\n - ') : ''}`);
  process.exit(falhas.length ? 1 : 0);
})().catch((e) => { console.error('ERRO', e); process.exit(1); });
