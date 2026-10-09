// Teste LOCAL (sem rede externa, sem banco, sem IA, sem e-mail real) da RECUPERAÇÃO de acesso à Síntese e da entrega do relatório.
//   Parte A — unidade (relógio injetado): código de uso único por e-mail, expiração, tentativas, limites, resposta uniforme.
//   Parte B — ponta a ponta: sobe o src/server.js REAL com Supabase/Claude/Resend FALSOS (scripts/suporte/preload-ambiente-falso.js)
//             e percorre: 401 sem token → recuperação por código → token novo → PDF real → envio por e-mail → logs sem segredos.
// Uso: node scripts/testar-recuperacao-acesso.js
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

const SEGREDO = 'segredo-de-teste-local-nao-real-0123456789';
process.env.SESSION_TOKEN_SECRET = SEGREDO;
const raiz = path.join(__dirname, '..');
const R = require(path.join(raiz, 'src/lib/recuperacaoSessao'));
const { emailValido } = require(path.join(raiz, 'src/lib/protecaoRelatorio'));
const T = require(path.join(raiz, 'src/lib/sessionToken'));

let total = 0, ok = 0; const falhas = [];
async function teste(nome, fn) { total++; try { await fn(); ok++; console.log(`  ok   ${nome}`); } catch (e) { falhas.push(nome); console.log(`  FAIL ${nome}\n       ${String(e.message).split('\n')[0]}`); } }

// ───────────────────────── Parte A — unidade ─────────────────────────
function montar(opcoes = {}) {
  const relogio = { t: 5000000 }; const enviados = []; const sessoes = { 'maria@x.test': { sessionId: 'sess-maria-1', email: 'Maria@X.test', productType: 'chat-mentor' } };
  Object.assign(sessoes, opcoes.sessoes || {});
  let sequencia = 0; const codigos = opcoes.codigos || ['111111', '222222', '333333', '444444', '555555'];
  const rec = R.criarRecuperacaoSessao({
    buscarSessaoPagaPorEmail: async (e) => sessoes[e] || null,
    enviarCodigo: async ({ para, codigo }) => { enviados.push({ para, codigo }); return { sucesso: opcoes.envioFalha ? false : true }; },
    gerarToken: (id) => 'TOKEN-' + id, emailValido, segredo: SEGREDO, agora: () => relogio.t, gerarCodigo: () => codigos[sequencia++ % codigos.length]
  });
  return { rec, relogio, enviados, sessoes };
}

(async () => {
  console.log('== A. Recuperação (unidade) ==');
  await teste('fluxo feliz: código enviado SÓ ao e-mail gravado; confirmar devolve token novo e o código é de uso único', async () => {
    const { rec, enviados } = montar();
    const s = await rec.solicitar({ email: '  MARIA@x.test ', ipKey: 'ip1' }); assert.strictEqual(s.status, 'ok');
    assert.deepStrictEqual(enviados, [{ para: 'Maria@X.test', codigo: '111111' }]);
    const c = await rec.confirmar({ email: 'maria@x.test', codigo: '111111', ipKey: 'ip1' });
    assert.deepStrictEqual({ status: c.status, sessionId: c.sessionId, token: c.token }, { status: 'ok', sessionId: 'sess-maria-1', token: 'TOKEN-sess-maria-1' });
    assert.strictEqual((await rec.confirmar({ email: 'maria@x.test', codigo: '111111', ipKey: 'ip1' })).status, 'invalido', 'reuso');
  });
  await teste('resposta UNIFORME: e-mail sem compra => status ok, nada enviado, nenhum estado guardado', async () => {
    const { rec, enviados } = montar(); const s = await rec.solicitar({ email: 'ninguem@x.test', ipKey: 'ip2' });
    assert.strictEqual(s.status, 'ok'); assert.strictEqual(enviados.length, 0); assert.strictEqual(rec._estado().codigos, 0);
    assert.strictEqual((await rec.confirmar({ email: 'ninguem@x.test', codigo: '111111', ipKey: 'ip2' })).status, 'invalido');
  });
  await teste('e-mail inválido => invalido; código fora do formato => invalido; sessionId nunca é aceito como credencial', async () => {
    const { rec } = montar(); assert.strictEqual((await rec.solicitar({ email: 'sem-arroba', ipKey: 'i' })).status, 'invalido');
    await rec.solicitar({ email: 'maria@x.test', ipKey: 'i' });
    for (const c of ['12345', '1234567', 'abcdef', '', null, undefined, '11111 ']) assert.strictEqual((await rec.confirmar({ email: 'maria@x.test', codigo: c, ipKey: 'i' })).status, 'invalido', String(c));
    assert.strictEqual((await rec.confirmar({ email: 'maria@x.test', codigo: 'sess-maria-1', ipKey: 'i' })).status, 'invalido');
  });
  await teste('expira em 10 min', async () => {
    const { rec, relogio } = montar(); await rec.solicitar({ email: 'maria@x.test', ipKey: 'i' });
    relogio.t += R.TTL_CODIGO_MS + 1; assert.strictEqual((await rec.confirmar({ email: 'maria@x.test', codigo: '111111', ipKey: 'i' })).status, 'invalido');
    const { rec: r2, relogio: t2 } = montar(); await r2.solicitar({ email: 'maria@x.test', ipKey: 'i' }); t2.t += R.TTL_CODIGO_MS - 1000;
    assert.strictEqual((await r2.confirmar({ email: 'maria@x.test', codigo: '111111', ipKey: 'i' })).status, 'ok');
  });
  await teste('5 tentativas erradas queimam o código (mesmo o certo depois falha)', async () => {
    const { rec } = montar(); await rec.solicitar({ email: 'maria@x.test', ipKey: 'i' });
    for (let i = 0; i < R.MAX_TENTATIVAS; i++) assert.strictEqual((await rec.confirmar({ email: 'maria@x.test', codigo: '000000', ipKey: 'i' })).status, 'invalido');
    assert.strictEqual((await rec.confirmar({ email: 'maria@x.test', codigo: '111111', ipKey: 'i' })).status, 'invalido');
  });
  await teste('novo pedido substitui o código anterior; cooldown de 60 s e teto de 3/hora por e-mail (mesmo se o e-mail não existir)', async () => {
    const { rec, relogio, enviados } = montar();
    await rec.solicitar({ email: 'maria@x.test', ipKey: 'i1' });
    assert.strictEqual((await rec.solicitar({ email: 'maria@x.test', ipKey: 'i2' })).status, 'limite');
    relogio.t += 61000; await rec.solicitar({ email: 'maria@x.test', ipKey: 'i3' }); assert.strictEqual(enviados.length, 2);
    assert.strictEqual((await rec.confirmar({ email: 'maria@x.test', codigo: '111111', ipKey: 'i' })).status, 'invalido', 'código antigo substituído');
    relogio.t += 61000; await rec.solicitar({ email: 'maria@x.test', ipKey: 'i4' });
    relogio.t += 61000; const quarta = await rec.solicitar({ email: 'maria@x.test', ipKey: 'i5' }); assert.strictEqual(quarta.status, 'limite'); assert.ok(quarta.retryAfterSeg > 0);
    const { rec: r2, relogio: t2 } = montar(); await r2.solicitar({ email: 'nao@x.test', ipKey: 'a' }); assert.strictEqual((await r2.solicitar({ email: 'nao@x.test', ipKey: 'b' })).status, 'limite', 'limita mesmo sem compra (não vira oráculo)');
  });
  await teste('teto por IP: 10 pedidos/h e 30 confirmações/h', async () => {
    const { rec, relogio } = montar(); let ultimo;
    for (let i = 0; i < 10; i++) { ultimo = await rec.solicitar({ email: `u${i}@x.test`, ipKey: 'mesmo-ip' }); assert.strictEqual(ultimo.status, 'ok'); }
    assert.strictEqual((await rec.solicitar({ email: 'u11@x.test', ipKey: 'mesmo-ip' })).status, 'limite');
    relogio.t += 3600001; assert.strictEqual((await rec.solicitar({ email: 'u12@x.test', ipKey: 'mesmo-ip' })).status, 'ok');
    for (let i = 0; i < 30; i++) await rec.confirmar({ email: 'maria@x.test', codigo: '000000', ipKey: 'brute' });
    assert.strictEqual((await rec.confirmar({ email: 'maria@x.test', codigo: '000000', ipKey: 'brute' })).status, 'limite');
  });
  await teste('estorno entre o pedido e a confirmação cancela a recuperação', async () => {
    const { rec, sessoes } = montar(); await rec.solicitar({ email: 'maria@x.test', ipKey: 'i' }); delete sessoes['maria@x.test'];
    assert.strictEqual((await rec.confirmar({ email: 'maria@x.test', codigo: '111111', ipKey: 'i' })).status, 'invalido');
  });
  await teste('falha no envio do e-mail não deixa código pendente; erro do banco não vaza', async () => {
    const { rec } = montar({ envioFalha: true }); assert.strictEqual((await rec.solicitar({ email: 'maria@x.test', ipKey: 'i' })).status, 'ok'); assert.strictEqual(rec._estado().codigos, 0);
    const r2 = R.criarRecuperacaoSessao({ buscarSessaoPagaPorEmail: async () => { throw new Error('banco-caiu'); }, enviarCodigo: async () => ({ sucesso: true }), gerarToken: () => 't', emailValido, segredo: SEGREDO });
    assert.strictEqual((await r2.solicitar({ email: 'maria@x.test', ipKey: 'i' })).status, 'ok');
  });
  await teste('o código não fica em texto claro no estado interno; segredo curto é recusado', async () => {
    const { rec } = montar(); await rec.solicitar({ email: 'maria@x.test', ipKey: 'i' });
    assert.ok(!/111111/.test(JSON.stringify([...Object.entries(rec._estado())])));
    assert.throws(() => R.criarRecuperacaoSessao({ buscarSessaoPagaPorEmail() {}, enviarCodigo() {}, gerarToken() {}, emailValido, segredo: 'curto' }));
  });

  // ───────────────────────── Parte B — ponta a ponta ─────────────────────────
  console.log('== B. Ponta a ponta (servidor real + Supabase/Claude/Resend falsos) ==');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'zuni-e2e-'));
  const seed = path.join(tmp, 'seed.json'); const dump = path.join(tmp, 'dump.json'); const emailLog = path.join(tmp, 'emails.log');
  const hist = []; for (let i = 0; i < 6; i++) { hist.push({ role: 'user', message: 'pergunta de teste ' + i }); hist.push({ role: 'assistant', message: 'resposta de teste ' + i }); }
  const base = (id, email, extra = {}) => ({ session_id: id, name: 'Pessoa Teste', email, paid: true, message_count: 12, history: hist, product_type: 'chat-mentor', relatorio_gerado: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...extra });
  const IDS = { A: 'aaaaaaaa-1111-4222-8333-444444444441', B: 'bbbbbbbb-1111-4222-8333-444444444442', C: 'cccccccc-1111-4222-8333-444444444443', D: 'dddddddd-1111-4222-8333-444444444444', E: 'eeeeeeee-1111-4222-8333-444444444445' };
  fs.writeFileSync(seed, JSON.stringify({ sessions: [
    base(IDS.A, 'Comprador.Teste@Example.test'), base(IDS.B, 'outro.comprador@example.test'), base(IDS.C, 'nao.pagou@example.test', { paid: false }),
    base(IDS.D, 'estornada@example.test', { paid: false, estornado_em: new Date().toISOString() }), base(IDS.E, 'queimar@example.test')
  ] }));
  const PORTA = 19000 + Math.floor(Math.random() * 900);
  const env = { ...process.env, PORT: String(PORTA), SESSION_TOKEN_SECRET: SEGREDO, AUTH_CORTE_TS: '0', SUPABASE_URL: 'https://falso.example.test', SUPABASE_KEY: 'chave-falsa', ANTHROPIC_API_KEY: 'chave-falsa', RESEND_API_KEY: 're_falsa', RESEND_FROM_EMAIL: 'ZUNI <nao-responda@example.test>', FAKE_DB_SEED: seed, FAKE_DB_DUMP: dump, FAKE_EMAIL_LOG: emailLog };
  for (const k of ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'OPENAI_API_KEY', 'ROTA_TESTE_RELATORIO', 'DEMO_LIMITES_PERSISTENTES']) delete env[k];
  const filho = spawn(process.execPath, ['-r', path.join(raiz, 'scripts/suporte/preload-ambiente-falso.js'), path.join(raiz, 'src/server.js')], { cwd: raiz, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let logServidor = ''; filho.stdout.on('data', (d) => { logServidor += d; }); filho.stderr.on('data', (d) => { logServidor += d; });
  const req = (metodo, caminho, { headers = {}, corpo, bin = false } = {}) => new Promise((resolve, reject) => {
    const dados = corpo === undefined ? null : JSON.stringify(corpo);
    const r = http.request({ host: '127.0.0.1', port: PORTA, method: metodo, path: caminho, headers: { ...(dados ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(dados) } : {}), ...headers } }, (res) => {
      const partes = []; res.on('data', (d) => partes.push(d)); res.on('end', () => { const buf = Buffer.concat(partes); resolve({ status: res.statusCode, headers: res.headers, buf, corpo: bin ? null : buf.toString('utf8') }); });
    }); r.on('error', reject); if (dados) r.write(dados); r.end();
  });
  const json = (r) => { try { return JSON.parse(r.corpo); } catch (_) { return {}; } };
  const emails = () => (fs.existsSync(emailLog) ? fs.readFileSync(emailLog, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);
  const bancoSessao = (id) => JSON.parse(fs.readFileSync(dump, 'utf8')).sessions.find((s) => s.session_id === id);
  const tokenDe = (id) => T.gerarTokenSessao(id, 'chat', T.VALIDADE_CHAT_MS);

  try {
    let subiu = false; for (let i = 0; i < 160 && !subiu; i++) { await new Promise((r) => setTimeout(r, 250)); try { await req('GET', '/api/livros'); subiu = true; } catch (_) { /* aguardando */ } }
    assert.ok(subiu, 'servidor de teste não subiu: ' + logServidor.slice(-300));

    await teste('B1. sem token: 401 com instrução de recuperação (download, e-mail, relatório) e SEM tocar em banco/e-mail', async () => {
      const a = await req('GET', '/api/relatorio/download/' + IDS.A); assert.strictEqual(a.status, 401); assert.ok(/recuperar-sintese/.test(json(a).error));
      assert.strictEqual((await req('POST', '/api/relatorio/enviar-email', { corpo: { sessionId: IDS.A, email: 'x@example.test' } })).status, 401);
      assert.strictEqual((await req('POST', '/api/relatorio', { corpo: { sessionId: IDS.A } })).status, 401);
      assert.strictEqual(emails().length, 0);
    });
    await teste('B2. páginas do fluxo revalidam o cache (chat.html e recuperar-sintese.html), inclusive pela rota /chat', async () => {
      for (const p of ['/chat.html', '/recuperar-sintese.html', '/chat']) { const r = await req('GET', p); assert.strictEqual(r.status, 200, p); assert.ok(/no-cache/.test(r.headers['cache-control'] || ''), p + ' cache-control=' + r.headers['cache-control']); }
      const html = (await req('GET', '/recuperar-sintese.html')).corpo; assert.ok(/recuperar\/solicitar/.test(html) && /recuperar\/confirmar/.test(html) && !/innerHTML/.test(html));
    });
    await teste('B2b. compatibilidade: página antiga (sem header) recebe 401 com instrução; a nova envia o header e oferece o link de recuperação; chat (/api/chat) segue com o fluxo anterior', async () => {
      const html = (await req('GET', '/chat.html')).corpo;
      assert.strictEqual((html.match(/'X-Zuni-Sessao': getZuniToken\(\)/g) || []).length >= 4, true, 'header nas chamadas de relatório');
      assert.ok(/adicionarLinkRecuperacao/.test(html) && /\/recuperar-sintese\.html/.test(html));
      const antigo = await req('GET', '/api/relatorio/download/' + IDS.A); // exatamente o que uma página em cache faz
      assert.strictEqual(antigo.status, 401); assert.ok(/Ctrl\+F5/.test(json(antigo).error) && /recuperar-sintese/.test(json(antigo).error));
      const chat = await req('POST', '/api/chat', { corpo: { sessionId: IDS.A, message: 'oi' } }); // sem token e janela legada fechada => 401 como antes
      assert.strictEqual(chat.status, 401);
    });
    await teste('B3. e-mail inexistente / não pago / estornado: resposta idêntica 200 e NENHUM e-mail', async () => {
      const respostas = [];
      for (const em of ['ninguem@example.test', 'nao.pagou@example.test', 'estornada@example.test']) { const r = await req('POST', '/api/sessao/recuperar/solicitar', { corpo: { email: em } }); assert.strictEqual(r.status, 200); respostas.push(r.corpo); }
      assert.strictEqual(new Set(respostas).size, 1); assert.strictEqual(emails().length, 0);
      assert.strictEqual((await req('POST', '/api/sessao/recuperar/solicitar', { corpo: { email: 'invalido' } })).status, 400);
    });
    let tokenRecuperado = '', codigoUsado = '';
    await teste('B4. comprador legítimo: código chega SÓ ao e-mail da compra (sem links nem token); confirmar entrega token novo', async () => {
      const s = await req('POST', '/api/sessao/recuperar/solicitar', { corpo: { email: 'comprador.TESTE@example.test' } }); assert.strictEqual(s.status, 200); assert.ok(/no-store/.test(s.headers['cache-control']));
      const mails = emails(); assert.strictEqual(mails.length, 1); assert.strictEqual(mails[0].to, 'Comprador.Teste@Example.test');
      const cod = (mails[0].html.match(/\b(\d{6})\b/) || [])[1]; assert.ok(cod, 'sem código no e-mail'); codigoUsado = cod;
      assert.ok(!/https?:|href=|sessionId|session_id|X-Zuni|token/i.test(mails[0].html.replace(/Ninguém terá acesso sem ele/g, '')), 'e-mail não deve ter link/token/id');
      assert.ok(!mails[0].html.includes(IDS.A));
      const errado = await req('POST', '/api/sessao/recuperar/confirmar', { corpo: { email: 'Comprador.Teste@Example.test', codigo: cod === '000000' ? '000001' : '000000' } }); assert.strictEqual(errado.status, 400);
      const c = await req('POST', '/api/sessao/recuperar/confirmar', { corpo: { email: 'Comprador.Teste@Example.test', codigo: cod } });
      assert.strictEqual(c.status, 200); assert.ok(/no-store/.test(c.headers['cache-control'])); const d = json(c); assert.strictEqual(d.sessionId, IDS.A); assert.ok(typeof d.token === 'string' && d.token.length > 20); tokenRecuperado = d.token;
    });
    await teste('B5. o código é de uso único (reutilizar => 400)', async () => {
      assert.strictEqual((await req('POST', '/api/sessao/recuperar/confirmar', { corpo: { email: 'Comprador.Teste@Example.test', codigo: codigoUsado } })).status, 400);
    });
    await teste('B6. token recuperado baixa o PDF REAL; o mesmo sessionId com token de OUTRA sessão ou sem token é negado', async () => {
      const ok1 = await req('GET', '/api/relatorio/download/' + IDS.A, { headers: { 'X-Zuni-Sessao': tokenRecuperado }, bin: true });
      assert.strictEqual(ok1.status, 200, 'status ' + ok1.status + ' ' + ok1.buf.toString('utf8').slice(0, 120)); assert.ok(/application\/pdf/.test(ok1.headers['content-type'])); assert.strictEqual(ok1.buf.slice(0, 4).toString(), '%PDF'); assert.ok(/no-store/.test(ok1.headers['cache-control']));
      assert.strictEqual((await req('GET', '/api/relatorio/download/' + IDS.A, { headers: { 'X-Zuni-Sessao': tokenDe(IDS.B) } })).status, 401);
      assert.strictEqual((await req('GET', '/api/relatorio/download/' + IDS.B, { headers: { 'X-Zuni-Sessao': tokenRecuperado } })).status, 401);
    });
    await teste('B7. segundo download imediato => 429 com Retry-After (não gera PDF repetido)', async () => {
      const r = await req('GET', '/api/relatorio/download/' + IDS.A, { headers: { 'X-Zuni-Sessao': tokenRecuperado } }); assert.strictEqual(r.status, 429); assert.ok(Number(r.headers['retry-after']) > 0);
    });
    await teste('B8. enviar-email para OUTRO endereço entrega o PDF lá e NÃO altera o e-mail do comprador no banco', async () => {
      const antes = emails().length;
      const r = await req('POST', '/api/relatorio/enviar-email', { headers: { 'X-Zuni-Sessao': tokenRecuperado }, corpo: { sessionId: IDS.A, email: 'familiar@example.test' } }); assert.strictEqual(r.status, 200, r.corpo);
      const novos = emails().slice(antes); assert.ok(novos.some((m) => m.to === 'familiar@example.test' && m.anexos.length > 0), JSON.stringify(novos.map((m) => m.to)));
      assert.strictEqual(bancoSessao(IDS.A).email, 'Comprador.Teste@Example.test');
      assert.strictEqual((await req('POST', '/api/relatorio/enviar-email', { headers: { 'X-Zuni-Sessao': tokenRecuperado }, corpo: { sessionId: IDS.A, email: 'a@b.com,c@d.com' } })).status, 400);
    });
    await teste('B9. código queimado por tentativas: 5 erros e o certo deixa de valer', async () => {
      const antes = emails().length; await req('POST', '/api/sessao/recuperar/solicitar', { corpo: { email: 'queimar@example.test' } });
      const cod = (emails().slice(antes)[0].html.match(/\b(\d{6})\b/) || [])[1];
      for (let i = 0; i < 5; i++) await req('POST', '/api/sessao/recuperar/confirmar', { corpo: { email: 'queimar@example.test', codigo: cod === '123456' ? '654321' : '123456' } });
      assert.strictEqual((await req('POST', '/api/sessao/recuperar/confirmar', { corpo: { email: 'queimar@example.test', codigo: cod } })).status, 400);
    });
    await teste('B10. nenhum token, código ou segredo aparece nos logs do servidor', async () => {
      assert.ok(!logServidor.includes(tokenRecuperado), 'token no log'); assert.ok(!logServidor.includes(SEGREDO), 'segredo no log'); assert.ok(!logServidor.includes(codigoUsado) || !/codigo/i.test(logServidor.split('\n').filter((l) => l.includes(codigoUsado)).join(' ')), 'código no log');
      assert.ok(!/X-Zuni-Sessao|x-zuni-sessao/.test(logServidor));
    });
    await teste('B11. rota de teste do relatório continua inexistente (404) e o PDF/e-mail do comprador estorna-se: sessão paid=false => 403', async () => {
      assert.strictEqual((await req('GET', '/api/relatorio/teste/' + IDS.A, { headers: { 'X-Zuni-Sessao': tokenRecuperado } })).status, 404);
      assert.strictEqual((await req('GET', '/api/relatorio/download/' + IDS.C, { headers: { 'X-Zuni-Sessao': tokenDe(IDS.C) } })).status, 403);
      assert.strictEqual((await req('GET', '/api/relatorio/download/' + IDS.D, { headers: { 'X-Zuni-Sessao': tokenDe(IDS.D) } })).status, 403);
    });
  } finally { filho.kill(); }

  console.log(`\nTotal: ${total} | Passaram: ${ok} | Falharam: ${falhas.length}`);
  if (falhas.length) { console.log('Falhas:', falhas.join('; ')); process.exit(1); }
})().catch((e) => { console.error('ERRO FATAL', e.message); process.exit(1); });
