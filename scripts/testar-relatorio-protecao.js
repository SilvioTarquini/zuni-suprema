// Teste LOCAL (sem rede externa, sem banco, sem IA, sem e-mail, sem Stripe) da proteção das rotas /api/relatorio*:
//   - autorização por token HMAC de sessão (o sessionId sozinho NÃO autoriza);
//   - limites por sessão/operação e disjuntor global;
//   - o e-mail do comprador não é alterado;
//   - fiação real: sobe src/server.js numa porta local SEM variáveis de banco e confere 401/404 nas rotas reais.
// Uso: node scripts/testar-relatorio-protecao.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

process.env.SESSION_TOKEN_SECRET = 'segredo-de-teste-local-nao-real-0123456789';
delete process.env.SUPABASE_URL; delete process.env.SUPABASE_KEY;
const raiz = path.join(__dirname, '..');
const P = require(path.join(raiz, 'src/lib/protecaoRelatorio'));
const T = require(path.join(raiz, 'src/lib/sessionToken'));
const express = require(path.join(raiz, 'node_modules/express'));

let total = 0, ok = 0; const falhas = [];
async function teste(nome, fn) { total++; try { await fn(); ok++; console.log(`  ok   ${nome}`); } catch (e) { falhas.push(nome); console.log(`  FAIL ${nome}\n       ${String(e.message).split('\n')[0]}`); } }

function req(porta, metodo, caminho, { headers = {}, corpo } = {}) {
  return new Promise((resolve, reject) => {
    const dados = corpo === undefined ? null : JSON.stringify(corpo);
    const r = http.request({ host: '127.0.0.1', port: porta, method: metodo, path: caminho, headers: { ...(dados ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(dados) } : {}), ...headers } }, (res) => {
      let b = ''; res.on('data', (d) => { b += d; }); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, corpo: b }));
    });
    r.on('error', reject); if (dados) r.write(dados); r.end();
  });
}

const SID = '11111111-2222-4333-8444-555555555555';
const OUTRO = '99999999-2222-4333-8444-555555555555';

(async () => {
  console.log('== Validadores ==');
  await teste('idValido/emailValido', async () => {
    assert.ok(P.idValido(SID)); assert.ok(!P.idValido('')); assert.ok(!P.idValido('a'.repeat(101))); assert.ok(!P.idValido('../x')); assert.ok(!P.idValido({})); assert.ok(!P.idValido(null));
    assert.ok(P.emailValido('a@b.co')); for (const e of ['', 'a@b', 'a b@c.com', 'a@b.com,c@d.com', 'a@b.com;c@d.com', '<a@b.com>', 'x'.repeat(250) + '@b.com', null]) assert.ok(!P.emailValido(e), String(e));
  });

  console.log('== Limitador ==');
  let t = 1000000; const agora = () => t;
  const novo = (o = {}) => P.criarLimitadorRelatorio({ agora, ...o });
  await teste('cooldown entre pedidos e teto por janela', async () => {
    const L = novo(); let a = L.adquirir('download', SID); assert.ok(a.ok); a.liberar();
    const b = L.adquirir('download', SID); assert.ok(!b.ok && b.motivo === 'aguarde');
    for (let i = 0; i < 5; i++) { t += 16000; const x = L.adquirir('download', SID); assert.ok(x.ok, 'pedido ' + i); x.liberar(); }
    t += 16000; const c = L.adquirir('download', SID); assert.ok(!c.ok && c.motivo === 'limite_da_sessao'); assert.ok(c.retryAfterSeg > 0);
    t += 3600000; const d = L.adquirir('download', SID); assert.ok(d.ok); d.liberar();
  });
  await teste('uma geração por vez por sessão; outra sessão não é afetada', async () => {
    const L = novo(); const a = L.adquirir('relatorio', SID); assert.ok(a.ok);
    const b = L.adquirir('relatorio', SID); assert.ok(!b.ok && b.motivo === 'em_andamento');
    const c = L.adquirir('relatorio', OUTRO); assert.ok(c.ok); a.liberar(); c.liberar();
  });
  await teste('falha da geração devolve a tentativa (liberar devolver) e liberar é idempotente', async () => {
    const L = novo(); t += 4000000; const a = L.adquirir('enviar-email', SID); a.liberar({ devolver: true }); a.liberar();
    t += 61000; const b = L.adquirir('enviar-email', SID); assert.ok(b.ok); assert.strictEqual(L._estado().simultaneas, 1); b.liberar(); assert.strictEqual(L._estado().simultaneas, 0);
  });
  await teste('enviar-email: máx. 3 por dia por sessão', async () => {
    const L = novo(); t += 9000000;
    for (let i = 0; i < 3; i++) { t += 61000; const x = L.adquirir('enviar-email', SID); assert.ok(x.ok, 'envio ' + i); x.liberar(); }
    t += 61000; assert.strictEqual(L.adquirir('enviar-email', SID).motivo, 'limite_da_sessao');
  });
  await teste('disjuntor global: simultâneas e teto diário', async () => {
    const L = novo({ global: { simultaneas: 2, maxPorDia: 4 } }); t += 99000000;
    const a = L.adquirir('relatorio', 'a1'), b = L.adquirir('relatorio', 'a2'); assert.ok(a.ok && b.ok);
    assert.strictEqual(L.adquirir('relatorio', 'a3').motivo, 'servico_ocupado'); a.liberar(); b.liberar();
    const c = L.adquirir('relatorio', 'a3'), d = L.adquirir('relatorio', 'a4'); assert.ok(c.ok && d.ok); c.liberar(); d.liberar();
    assert.strictEqual(L.adquirir('relatorio', 'a5').motivo, 'limite_global_diario');
    t += 86400001; const e = L.adquirir('relatorio', 'a5'); assert.ok(e.ok); e.liberar();
  });
  await teste('operação desconhecida é recusada', async () => { assert.strictEqual(novo().adquirir('xyz', SID).motivo, 'operacao_desconhecida'); });

  console.log('== Autorização (middleware com o token HMAC real) ==');
  const dbChamado = { n: 0 }; const negados = [];
  const app = express(); app.use(express.json());
  const aut = (rota) => P.exigirAutorizacaoRelatorio({ validarToken: T.validarTokenSessao, rota, aoNegar: (r) => negados.push(r) });
  app.get('/dl/:sessionId', aut('dl'), (req, res) => { dbChamado.n++; res.json({ ok: true, id: req.sessionIdAutorizado }); });
  app.post('/envio', aut('envio'), (req, res) => { dbChamado.n++; res.json({ ok: true, id: req.sessionIdAutorizado }); });
  const srv = await new Promise((r) => { const s = app.listen(0, '127.0.0.1', () => r(s)); }); const porta = srv.address().port;
  const tok = T.gerarTokenSessao(SID, 'chat', T.VALIDADE_CHAT_MS);
  await teste('POSITIVO: token válido do próprio sessionId autoriza (GET e POST)', async () => {
    const a = await req(porta, 'GET', '/dl/' + SID, { headers: { 'X-Zuni-Sessao': tok } }); assert.strictEqual(a.status, 200);
    const b = await req(porta, 'POST', '/envio', { headers: { 'X-Zuni-Sessao': tok }, corpo: { sessionId: SID, email: 'a@b.co' } }); assert.strictEqual(b.status, 200);
    assert.strictEqual(JSON.parse(b.corpo).id, SID);
  });
  const antes = () => dbChamado.n;
  await teste('NEGATIVO: apenas o sessionId (UUID) NÃO autoriza', async () => {
    const n0 = antes();
    assert.strictEqual((await req(porta, 'GET', '/dl/' + SID)).status, 401);
    assert.strictEqual((await req(porta, 'POST', '/envio', { corpo: { sessionId: SID, email: 'a@b.co' } })).status, 401);
    assert.strictEqual(antes(), n0);
  });
  await teste('NEGATIVO: token de OUTRA sessão, escopo errado, expirado, adulterado ou lixo', async () => {
    const tokOutro = T.gerarTokenSessao(OUTRO, 'chat', T.VALIDADE_CHAT_MS);
    const tokDl = T.gerarTokenSessao(SID, 'dl', T.VALIDADE_DOWNLOAD_MS);
    const tokExp = T.gerarTokenSessao(SID, 'chat', 1); await new Promise((r2) => setTimeout(r2, 20));
    const tokAdulterado = tok.slice(0, -2) + (tok.endsWith('aa') ? 'bb' : 'aa');
    const n0 = antes();
    for (const x of [tokOutro, tokDl, tokExp, tokAdulterado, 'lixo', '123.abc', tok + 'x', '']) {
      const r = await req(porta, 'GET', '/dl/' + SID, { headers: { 'X-Zuni-Sessao': x } }); assert.strictEqual(r.status, 401, 'token ' + String(x).slice(0, 8));
    }
    assert.strictEqual(antes(), n0);
  });
  await teste('NEGATIVO: token só vale no header (query string e body são ignorados)', async () => {
    assert.strictEqual((await req(porta, 'GET', '/dl/' + SID + '?t=' + encodeURIComponent(tok))).status, 401);
    assert.strictEqual((await req(porta, 'POST', '/envio', { corpo: { sessionId: SID, token: tok, t: tok } })).status, 401);
  });
  await teste('NEGATIVO: sessionId inválido => 400; contador de negados não recebe sessionId nem token', async () => {
    assert.strictEqual((await req(porta, 'POST', '/envio', { headers: { 'X-Zuni-Sessao': tok }, corpo: { sessionId: '../etc' } })).status, 400);
    assert.strictEqual((await req(porta, 'POST', '/envio', { headers: { 'X-Zuni-Sessao': tok }, corpo: {} })).status, 400);
    assert.ok(negados.length > 0); assert.ok(negados.every((r) => r === 'dl' || r === 'envio'));
  });
  await teste('token com validador que lança exceção => negado (fail-closed)', async () => {
    const m = P.exigirAutorizacaoRelatorio({ validarToken: () => { throw new Error('x'); }, rota: 'r' });
    let status = 0; m({ params: { sessionId: SID }, headers: { 'x-zuni-sessao': 'a' } }, { status: (s) => { status = s; return { json: () => {} }; } }, () => { status = 200; }); assert.strictEqual(status, 401);
  });
  await teste('resposta 429 traz Retry-After', async () => {
    const h = {}; const res = { set: (k, v) => { h[k] = v; }, status: (s) => ({ json: (b) => ({ s, b }) }) };
    const r = P.responderLimite(res, { motivo: 'aguarde', retryAfterSeg: 12 }); assert.strictEqual(r.s, 429); assert.strictEqual(h['Retry-After'], '12');
  });
  srv.close();

  console.log('== Fiação no servidor real (src/server.js, sem banco) ==');
  const srcServer = fs.readFileSync(path.join(raiz, 'src/server.js'), 'utf8');
  await teste('estático: as 4 rotas usam autorizarRelatorio ANTES do handler; sem alterar session.email nem upsertSession nelas', async () => {
    for (const rota of ["app.post('/api/relatorio', autorizarRelatorio(", "app.get('/api/relatorio/download/:sessionId', autorizarRelatorio(", "app.post('/api/relatorio/enviar-email', autorizarRelatorio("]) assert.ok(srcServer.includes(rota), rota);
    assert.ok(/app\.get\('\/api\/relatorio\/teste\/:sessionId', \(req, res, next\) => \{\s+if \(process\.env\.ROTA_TESTE_RELATORIO !== '1'\)[\s\S]*?\}, autorizarRelatorio\(/.test(srcServer));
    const ini = srcServer.indexOf("app.post('/api/relatorio', autorizarRelatorio("); const fim = srcServer.indexOf("const multer = require('multer');");
    const bloco = srcServer.slice(ini, fim);
    assert.ok(!/session\.email\s*=[^=]/.test(bloco) && !/upsertSession/.test(bloco), 'bloco não deve alterar o e-mail');
    assert.ok(!/reportText/.test(bloco), 'variável indefinida reportText');
    assert.ok(!/NODE_ENV/.test(bloco));
    assert.ok(/gerarEEnviarRelatorio\(sessionId, \{ destinatario: emailNormalizado \}\)/.test(bloco));
    assert.ok(!/req\.query/.test(bloco));
  });
  await teste('estático: chat.html envia o header X-Zuni-Sessao nas 3 chamadas', async () => {
    const html = fs.readFileSync(path.join(raiz, 'public/chat.html'), 'utf8');
    for (const trecho of ["fetch('/api/relatorio/download/' + sessionId, { headers: { 'X-Zuni-Sessao': getZuniToken() } })"]) assert.ok(html.includes(trecho));
    const m = html.match(/fetch\('\/api\/relatorio(?:\/enviar-email)?', \{[^}]*'X-Zuni-Sessao': getZuniToken\(\)/g) || []; assert.strictEqual(m.length, 2);
  });
  await teste('dinâmico: servidor real responde 401 sem token, 404 na rota de teste e NÃO chega ao banco', async () => {
    const PORTA = 18000 + Math.floor(Math.random() * 1000);
    const env = { ...process.env, PORT: String(PORTA), SESSION_TOKEN_SECRET: process.env.SESSION_TOKEN_SECRET, AUTH_CORTE_TS: '0' }; for (const k of ['SUPABASE_URL', 'SUPABASE_KEY', 'ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'RESEND_API_KEY', 'ROTA_TESTE_RELATORIO']) delete env[k];
    const filho = spawn(process.execPath, [path.join(raiz, 'src/server.js')], { cwd: raiz, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let log = ''; filho.stdout.on('data', (d) => { log += d; }); filho.stderr.on('data', (d) => { log += d; });
    try {
      let subiu = false; for (let i = 0; i < 120 && !subiu; i++) { await new Promise((r) => setTimeout(r, 250)); try { await req(PORTA, 'GET', '/api/livros'); subiu = true; } catch (_) { /* aguardando */ } }
      assert.ok(subiu, 'servidor não subiu: ' + log.slice(-200));
      const tk = T.gerarTokenSessao(SID, 'chat', T.VALIDADE_CHAT_MS);
      assert.strictEqual((await req(PORTA, 'GET', '/api/relatorio/download/' + SID)).status, 401);
      assert.strictEqual((await req(PORTA, 'POST', '/api/relatorio', { corpo: { sessionId: SID } })).status, 401);
      assert.strictEqual((await req(PORTA, 'POST', '/api/relatorio/enviar-email', { corpo: { sessionId: SID, email: 'a@b.co' } })).status, 401);
      assert.strictEqual((await req(PORTA, 'GET', '/api/relatorio/teste/' + SID, { headers: { 'X-Zuni-Sessao': tk } })).status, 404);
      assert.strictEqual((await req(PORTA, 'GET', '/api/relatorio/download/' + SID, { headers: { 'X-Zuni-Sessao': T.gerarTokenSessao(OUTRO, 'chat', T.VALIDADE_CHAT_MS) } })).status, 401);
      // com token válido a autorização passa; sem banco configurado, o handler falha DEPOIS (500) — prova de que 401 não foi por acaso
      const comTk = await req(PORTA, 'GET', '/api/relatorio/download/' + SID, { headers: { 'X-Zuni-Sessao': tk } });
      assert.ok(comTk.status === 500, 'esperado 500 sem banco, veio ' + comTk.status);
      assert.ok(!/segredo-de-teste/.test(log), 'log não deve conter o segredo');
    } finally { filho.kill(); }
  });

  console.log(`\nTotal: ${total} | Passaram: ${ok} | Falharam: ${falhas.length}`);
  if (falhas.length) { console.log('Falhas:', falhas.join('; ')); process.exit(1); }
})().catch((e) => { console.error('ERRO FATAL', e.message); process.exit(1); });
