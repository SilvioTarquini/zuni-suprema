// Rodada 3A — capa do Toda Mesa Tem Dois Lados na leitura no site. Mocks, sem rede externa.
//
// Antes: o componente do livro pedia <img src="capa.png"> (caminho relativo, arquivo que nunca existiu no pacote); em produção
// o navegador ia a /livros/capa.png e recebia 400 — capa quebrada. Agora a capa pública da loja vai dentro do próprio arquivo.
// Confere, sem navegador: a referência relativa sumiu, a capa é um JPEG embutido, SÓ o componente da capa muda (todo o resto
// do pacote, inclusive o texto do livro, fica byte a byte igual) e outros livros não são tocados.
// Confere, com navegador (pela rota real /livros/:id, desktop e celular): a imagem carrega e ninguém pede /livros/capa.png.
// Uso: node scripts/testar-capa-mesa.js

const assert = require('assert');
const fs = require('fs');
const http = require('http');
const path = require('path');
const zlib = require('zlib');

process.env.SUPABASE_URL = 'https://fake-project.invalid';
process.env.SUPABASE_KEY = 'FAKE_SECRET_KEY_FOR_TESTS_ONLY';
globalThis.fetch = async () => { throw new Error('rede proibida no teste'); };

const ID = 'toda-mesa-tem-dois-lados';
const ARQUIVO = path.join(__dirname, '..', 'private', 'livros', ID, 'index.html');
const agora = Date.now();
const linha = { livro_id: ID, email: 'x@x', tipo_produto: 'livro', token: 'tok-mesa', data_pagamento: new Date(agora).toISOString(), usado_em: new Date(agora).toISOString(), revogado_em: null, data_expiracao: new Date(agora + 86400000).toISOString() };
function construtor() {
  const filtros = [];
  const b = {
    select() { return b; }, update() { return b; },
    eq(c, v) { filtros.push([c, v]); return b; },
    single() { return Promise.resolve(filtros.every(([c, v]) => linha[c] === v) ? { data: { ...linha }, error: null } : { data: null, error: { message: 'not found' } }); },
    then(res, rej) { return Promise.resolve({ error: null }).then(res, rej); }
  };
  return b;
}
const supaPath = require.resolve('@supabase/supabase-js');
require.cache[supaPath] = { id: supaPath, filename: supaPath, loaded: true, exports: { createClient: () => ({ from: construtor }) } };

const express = require('express');
const { lerLivroComPatch, aplicarPatchLeitor } = require('../src/lib/leitorMobile');
const { corrigirCapaMesa } = require('../src/lib/leitorCapaMesa');

function manifesto(html) {
  const M = '<script type="__bundler/manifest">';
  const i = html.indexOf(M) + M.length;
  return JSON.parse(html.slice(i, html.indexOf('</script>', i)));
}
const bytes = (a) => { const b = Buffer.from(a.data, 'base64'); return a.compressed ? zlib.gunzipSync(b) : b; };

let passaram = 0;
const falhas = [];
async function teste(nome, fn) {
  try { await fn(); passaram++; console.log('  ok   ' + nome); } catch (e) { falhas.push(nome + ' — ' + e.message.split('\n')[0]); console.log('  FAIL ' + nome + ' — ' + e.message.split('\n')[0]); }
}

(async () => {
  const original = fs.readFileSync(ARQUIVO, 'utf8');
  const msgs = [];
  const orig = console.error;
  console.error = (...a) => { msgs.push(a.join(' ')); };
  const servido = await lerLivroComPatch(ID, ARQUIVO);
  console.error = orig;

  console.log('Pacote servido (sem navegador)');
  await teste('patch aplicado sem [LEITOR_PATCH_FALHOU] e sem referência relativa a capa.png', async () => {
    assert.ok(!msgs.some((m) => m.includes('[LEITOR_PATCH_FALHOU]')), msgs.join(' '));
    assert.ok(original.includes('capa.png') === false, 'o arquivo original guarda capa.png só dentro do asset comprimido');
    const ms = manifesto(servido);
    for (const a of Object.values(ms)) if (/^text\/html/.test(a.mime)) assert.ok(!bytes(a).toString('utf8').includes('src="capa.png"'));
  });
  await teste('a capa é o JPEG da loja, embutido (data URI) no componente', async () => {
    const ms = manifesto(servido);
    const ach = Object.values(ms).filter((a) => /^text\/html/.test(a.mime) && bytes(a).toString('utf8').includes('data:image/jpeg;base64,'));
    assert.strictEqual(ach.length, 1);
    const m = /<img src="data:image\/jpeg;base64,([A-Za-z0-9+/=]+)" alt="Capa do livro Toda Mesa Tem Dois Lados"/.exec(bytes(ach[0]).toString('utf8'));
    assert.ok(m, 'img da capa com alt original não encontrada');
    const jpg = Buffer.from(m[1], 'base64');
    assert.deepStrictEqual([...jpg.slice(0, 3)], [0xff, 0xd8, 0xff], 'não é JPEG');
    assert.ok(jpg.equals(fs.readFileSync(path.join(__dirname, '..', 'public', 'loja', 'capas', ID + '.jpg'))), 'não é a capa da loja');
  });
  await teste('SÓ o componente da capa mudou: os outros assets do pacote (texto do livro, fontes) ficam byte a byte iguais', async () => {
    const a = manifesto(original), b = manifesto(servido);
    assert.deepStrictEqual(Object.keys(a), Object.keys(b));
    const mudaram = Object.keys(a).filter((k) => !bytes(a[k]).equals(bytes(b[k])));
    assert.strictEqual(mudaram.length, 1, 'assets alterados: ' + mudaram.join(','));
    const antes = bytes(a[mudaram[0]]).toString('utf8'), depois = bytes(b[mudaram[0]]).toString('utf8');
    assert.strictEqual(depois.replace(/src="data:image\/jpeg;base64,[^"]+"/, 'src="capa.png"'), antes);
  });
  await teste('variante da auditoria ({ semImpressao:false }) também leva a capa corrigida', async () => {
    const v = await lerLivroComPatch(ID, ARQUIVO, { semImpressao: false });
    assert.ok(!bytesDeTodos(v).includes('src="capa.png"'));
  });
  function bytesDeTodos(html) { return Object.values(manifesto(html)).filter((a) => /^text\/html/.test(a.mime)).map((a) => bytes(a).toString('utf8')).join('\n'); }
  await teste('a correção exige a âncora: em outro livro, corrigirCapaMesa lança (e o patch cai no livro original)', async () => {
    const outro = fs.readFileSync(path.join(__dirname, '..', 'private', 'livros', 'vender-bem-vender-sempre', 'index.html'), 'utf8');
    assert.throws(() => corrigirCapaMesa(outro), /capa-mesa/);
  });
  await teste('outros livros não são tocados pela correção da capa', async () => {
    const id = 'toda-reuniao-tem-duas-pautas';
    const f = path.join(__dirname, '..', 'private', 'livros', id, 'index.html');
    const r = aplicarPatchLeitor(fs.readFileSync(f, 'utf8'), { livroId: id, semImpressao: false });
    assert.ok(r.ok);
    assert.ok(!r.html.includes('data:image/jpeg;base64,/9j/') || r.html.split('data:image/jpeg;base64,/9j/').length === fs.readFileSync(f, 'utf8').split('data:image/jpeg;base64,/9j/').length);
  });

  console.log('Leitura no site (navegador, pela rota /livros/:id)');
  const app = express();
  app.use('/', require('../src/routes/livros'));
  const servidor = await new Promise((r) => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
  const porta = servidor.address().port;
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  for (const vp of [{ width: 1366, height: 768 }, { width: 390, height: 844 }]) {
    await teste(`${vp.width}px: a capa carrega (naturalWidth > 0) e ninguém pede /livros/capa.png nem recebe 400`, async () => {
      const ctx = await browser.newContext({ viewport: vp });
      const page = await ctx.newPage();
      const pedidos = [];
      const status400 = [];
      page.on('request', (r) => pedidos.push(r.url()));
      page.on('response', (r) => { if (r.status() === 400) status400.push(r.url()); });
      await page.route('**/*', (rt) => (/^(http:\/\/127\.0\.0\.1|data:|blob:|file:)/.test(rt.request().url()) ? rt.continue() : rt.abort()));
      await page.goto(`http://127.0.0.1:${porta}/livros/${ID}?token=tok-mesa`, { waitUntil: 'domcontentloaded', timeout: 90000 });
      await page.waitForTimeout(7000);
      const img = await page.evaluate(() => { const i = [...document.images].find((x) => /Capa do livro/.test(x.alt)); return i ? { w: i.naturalWidth, h: i.naturalHeight, completo: i.complete } : null; });
      await ctx.close();
      assert.ok(img, 'imagem da capa não está na página');
      assert.ok(img.completo && img.w > 0 && img.h > 0, 'capa não carregou: ' + JSON.stringify(img));
      assert.deepStrictEqual(pedidos.filter((u) => /capa\.png/.test(u)), []);
      assert.deepStrictEqual(status400, []);
    });
  }
  await browser.close();
  servidor.close();

  console.log('\nTotal: ' + (passaram + falhas.length) + ' | Passaram: ' + passaram + ' | Falharam: ' + falhas.length);
  if (falhas.length) { console.log('Falhas: ' + falhas.join(' | ')); process.exitCode = 1; return; }
  console.log('OK — capa do Toda Mesa na leitura no site.');
})().catch((e) => { console.error(e); process.exitCode = 2; });
