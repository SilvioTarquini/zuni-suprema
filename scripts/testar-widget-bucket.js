// Widget do chat (Livro-Vivo) nas obras servidas do bucket. Stub do Storage e da tabela de acessos; sem rede.
// Confere: obra do bucket COM chatDisponivel e token válido → exatamente 1 widget, com a frase do Livro-Vivo e sem contador;
// obra do bucket SEM chatDisponivel → sem widget; sem token → 403 sem widget; obra de private/livros/ (já tem o widget gravado)
// → continua com exatamente 1 (sem duplicar); injeção idempotente; falta de </body> não derruba a entrega e deixa log.
// Uso: node scripts/testar-widget-bucket.js

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const http = require('http');

process.env.SUPABASE_URL = 'https://fake-project.invalid';
process.env.SUPABASE_KEY = 'FAKE_SECRET_KEY_FOR_TESTS_ONLY';
process.env.LIVRO_HTML_CACHE_SEGUNDOS = '0';
globalThis.fetch = async () => { throw new Error('rede proibida no teste'); };

const STAGING = path.join(__dirname, '..', '..', '..', 'Prontas para subir à loja', '_staging');
const SEM_CHAT = 'obra-nova-sem-chat';           // não está no catálogo → sem chat
const COM_CHAT = 'fazenda-lucrativa';            // ficha com chatDisponivel: true
const DISCO = 'ela-tem-classe';                  // obra de private/livros/, widget gravado no arquivo
const agora = Date.now();
const db = { acessos_livros: [] };
for (const id of [SEM_CHAT, COM_CHAT, DISCO]) db.acessos_livros.push({ email: 'x@x', tipo_produto: 'livro', data_pagamento: new Date(agora).toISOString(), usado_em: new Date(agora).toISOString(), revogado_em: null, livro_id: id, token: `ok-${id}`, data_expiracao: new Date(agora + 86400000).toISOString() });
const consultasAoBucket = [];
function construtor(tabela) {
  const f = [];
  const b = { select() { return b; }, update() { return b; }, eq(c, v) { f.push([c, v]); return b; },
    single() { const l = db[tabela].find((r) => f.every(([c, v]) => r[c] === v)); return Promise.resolve(l ? { data: { ...l }, error: null } : { data: null, error: { message: 'not found' } }); },
    then(res, rej) { return Promise.resolve({ error: null }).then(res, rej); } };
  return b;
}
const supaPath = require.resolve('@supabase/supabase-js');
require.cache[supaPath] = { id: supaPath, filename: supaPath, loaded: true, exports: { createClient: () => ({ from: construtor, storage: { from: () => ({
  download: async (caminho) => {
    consultasAoBucket.push(caminho);
    if (caminho === `html/${SEM_CHAT}.html`) return { data: new Blob(['<!doctype html><html><head><title>x</title></head><body><p>livro sem chat</p></body></html>']), error: null };
    if (caminho === `html/${COM_CHAT}.html`) return { data: new Blob([fs.readFileSync(path.join(STAGING, `${COM_CHAT}.html`))]), error: null };
    return { data: null, error: { message: 'Object not found', statusCode: '404' } };
  } }) } }) } };

const express = require('express');
const { injetarWidgetNoServico, MARCA_WIDGET } = require('../src/lib/widgetLivroVivo');
const app = express();
app.use('/', require('../src/routes/livros'));
const get = (url) => new Promise((resolve, reject) => http.get(url, (res) => { const b = []; res.on('data', (d) => b.push(d)); res.on('end', () => resolve({ status: res.statusCode, corpo: Buffer.concat(b).toString('utf8') })); }).on('error', reject));
const conta = (t, s) => t.split(s).length - 1;
let total = 0; const falhas = [];
async function teste(nome, fn) { total++; try { await fn(); console.log(`  ok   ${nome}`); } catch (e) { falhas.push(nome); console.log(`  FALHOU ${nome}: ${e.message.split('\n')[0]}`); } }

(async () => {
  const srv = await new Promise((r) => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
  const base = `http://127.0.0.1:${srv.address().port}`;
  const logs = []; const logOrig = console.log; console.log = (...a) => { logs.push(a.join(' ')); logOrig(...a); };

  await teste(`${COM_CHAT} (bucket, chatDisponivel, token válido): exatamente 1 widget, com a frase do Livro-Vivo, apontando para o próprio livro`, async () => {
    const r = await get(`${base}/livros/${COM_CHAT}?token=ok-${COM_CHAT}`);
    assert.strictEqual(r.status, 200);
    assert.strictEqual(conta(r.corpo, MARCA_WIDGET), 1);
    assert.ok(r.corpo.includes('Converse com o Livro-Vivo durante a sua leitura'));
    assert.ok(r.corpo.includes(`data-livro-id="${COM_CHAT}"`) && r.corpo.includes(`LIVRO_ID_INJETADO = '${COM_CHAT}'`));
    assert.ok(!r.corpo.includes('__ZUNI_LIVRO_ID__'), 'placeholder sobrando');
    assert.ok(!/restantes|perguntas restantes/i.test(r.corpo.slice(r.corpo.indexOf(MARCA_WIDGET))), 'contador visível');
  });
  await teste('linha de log de inicialização da injeção ([LIVRO_VIVO_WIDGET])', async () => {
    assert.ok(logs.some((l) => l.includes(`[LIVRO_VIVO_WIDGET] livroId=${COM_CHAT} origem=bucket injetado=sim`)), logs.join(' | '));
  });
  await teste(`${SEM_CHAT} (bucket, ficha sem chat): sem widget`, async () => {
    const r = await get(`${base}/livros/${SEM_CHAT}?token=ok-${SEM_CHAT}`);
    assert.strictEqual(r.status, 200); assert.strictEqual(conta(r.corpo, MARCA_WIDGET), 0);
  });
  await teste('sem token: 403, sem widget e sem consultar o bucket', async () => {
    const antes = consultasAoBucket.length;
    const r = await get(`${base}/livros/${COM_CHAT}`);
    assert.strictEqual(r.status, 403); assert.strictEqual(conta(r.corpo, MARCA_WIDGET), 0); assert.strictEqual(consultasAoBucket.length, antes);
  });
  await teste(`${DISCO} (private/livros/, widget gravado no arquivo): continua com exatamente 1 widget`, async () => {
    const antes = consultasAoBucket.length;
    const r = await get(`${base}/livros/${DISCO}?token=ok-${DISCO}`);
    assert.strictEqual(r.status, 200); assert.strictEqual(conta(r.corpo, MARCA_WIDGET), 1);
    assert.strictEqual(consultasAoBucket.length, antes, 'obra de disco não deve tocar no bucket');
  });
  await teste('o arquivo da obra em private/livros/ não foi alterado por este teste (1 widget no próprio arquivo)', async () => {
    assert.strictEqual(conta(fs.readFileSync(path.join(__dirname, '..', 'private', 'livros', DISCO, 'index.html'), 'utf8'), MARCA_WIDGET), 1);
  });
  await teste('injeção é idempotente (2ª chamada não duplica)', async () => {
    const ficha = { chatDisponivel: true };
    const a = injetarWidgetNoServico('<html><body>x</body></html>', 'abc', ficha);
    const b = injetarWidgetNoServico(a.html, 'abc', ficha);
    assert.ok(a.injetado && !b.injetado && conta(b.html, MARCA_WIDGET) === 1);
  });
  await teste('ficha sem chatDisponivel (false/ausente/null) não injeta', async () => {
    for (const f of [{ chatDisponivel: false }, {}, null]) assert.strictEqual(injetarWidgetNoServico('<body></body>', 'abc', f).injetado, false);
  });
  await teste('HTML sem </body>: não lança, entrega o livro e registra [LIVRO_VIVO_WIDGET_FALHOU]', async () => {
    const erros = []; const eo = console.error; console.error = (...a) => erros.push(a.join(' '));
    const r = injetarWidgetNoServico('<html>sem fechamento', 'abc', { chatDisponivel: true });
    console.error = eo;
    assert.strictEqual(r.injetado, false); assert.strictEqual(r.html, '<html>sem fechamento');
    assert.ok(erros.some((e) => e.includes('[LIVRO_VIVO_WIDGET_FALHOU]')));
  });
  console.log = logOrig;
  srv.close();
  console.log(`\n${total - falhas.length}/${total} ok${falhas.length ? '\nFALHARAM:\n - ' + falhas.join('\n - ') : ''}`);
  process.exit(falhas.length ? 1 : 0);
})();
