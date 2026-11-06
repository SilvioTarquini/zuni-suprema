// Lote-piloto — o download do PDF abre direto (sem tela de impressão) nas 5 obras. Stub do Storage, sem rede externa.
//
// Sobe a rota REAL (src/routes/livros.js) numa porta local, com:
//   - HTML do livro vindo do "bucket" (stub): as cópias de _staging, como serão enviadas;
//   - o arquivo antigo de Da Terra em private/livros/ tratado como REMOVIDO (é o estado depois da substituição);
//   - Storage com createSignedUrl() apontando para um servidor local que entrega o PDF REAL gerado
//     (lote-piloto/pdf/*.pdf) com Content-Disposition: attachment (como o Supabase faz com ?download=).
// No Chromium (computador 1280×800 e celular 390×844) abre cada livro com um token válido, clica em "Baixar PDF" e confere:
//   - o navegador dispara um DOWNLOAD (evento "download") com o nome amigável, conteúdo "%PDF" e o tamanho do arquivo gerado;
//   - window.print() nunca é chamado; não existe botão de imprimir nem de baixar .html;
//   - o HTML servido não contém window.print( nem PDF embutido em base64;
//   - sem token → 403 e o objeto do bucket nem é consultado.
// Capturas: relatorios/capturas_lote/. Uso: node scripts/testar-lote-piloto-download.js

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const http = require('http');

process.env.SUPABASE_URL = 'https://fake-project.invalid';
process.env.SUPABASE_KEY = 'FAKE_SECRET_KEY_FOR_TESTS_ONLY';
process.env.LIVRO_HTML_CACHE_SEGUNDOS = '0';
globalThis.fetch = async () => { throw new Error('rede proibida no teste'); };

const RAIZ = path.join(__dirname, '..');
const STAGING = path.join(RAIZ, '..', '..', 'Prontas para subir à loja', '_staging');
const PDFS = path.join(RAIZ, '..', 'lote-piloto', 'pdf');
const CAPTURAS = path.join(RAIZ, 'relatorios', 'capturas_lote');
const { NOMES_ARQUIVO } = require('../src/lib/pdfLivro');
const OBRAS = ['da-terra-ao-resultado', 'fazenda-lucrativa', 'a-bussola-do-adolescente', 'situacoes-da-vida-real', 'heranca-de-papel'];

// Estado "depois da substituição": o arquivo antigo de Da Terra no disco deixa de existir (ver plano da Parte 2).
const fsPromises = require('fs').promises;
const acessoOriginal = fsPromises.access.bind(fsPromises);
fsPromises.access = (p, ...r) => (String(p).replace(/\\/g, '/').includes('private/livros/da-terra-ao-resultado/') ? Promise.reject(Object.assign(new Error('ENOENT (simulado)'), { code: 'ENOENT' })) : acessoOriginal(p, ...r));

const agora = Date.now();
const db = { acessos_livros: [] };
for (const id of OBRAS) {
  db.acessos_livros.push({ email: 'x@x', tipo_produto: 'livro', data_pagamento: new Date(agora).toISOString(), usado_em: new Date(agora).toISOString(), revogado_em: null, livro_id: id, token: `ok-${id}`, data_expiracao: new Date(agora + 86400000).toISOString() });
}
const downloadsHtml = [];
let servidorPdf; let portaPdf;
function construtor(tabela) {
  const filtros = [];
  const b = {
    select() { return b; }, update() { return b; },
    eq(c, v) { filtros.push([c, v]); return b; },
    single() { const l = db[tabela].find((r) => filtros.every(([c, v]) => r[c] === v)); return Promise.resolve(l ? { data: { ...l }, error: null } : { data: null, error: { message: 'not found' } }); },
    then(res, rej) { return Promise.resolve({ error: null }).then(res, rej); }
  };
  return b;
}
const supaPath = require.resolve('@supabase/supabase-js');
require.cache[supaPath] = {
  id: supaPath, filename: supaPath, loaded: true,
  exports: { createClient: () => ({ from: construtor, storage: { from: (bucket) => ({
    download: async (caminho) => {
      downloadsHtml.push({ bucket, caminho });
      const m = /^html\/(.+)\.html$/.exec(caminho);
      const arq = m && path.join(STAGING, `${m[1]}.html`);
      if (!arq || !fs.existsSync(arq)) return { data: null, error: { message: 'Object not found', statusCode: '404' } };
      return { data: new Blob([fs.readFileSync(arq)], { type: 'text/html' }), error: null };
    },
    createSignedUrl: async (caminho, ttl, op) => ({ data: { signedUrl: `http://127.0.0.1:${portaPdf}/${bucket}/${caminho}?download=${encodeURIComponent((op && op.download) || '')}` }, error: null })
  }) } }) }
};

const express = require('express');
const app = express();
app.use('/', require('../src/routes/livros'));

let total = 0; const falhas = [];
async function teste(nome, fn) { total++; try { await fn(); console.log(`  ok   ${nome}`); } catch (e) { falhas.push(nome); console.log(`  FALHOU ${nome}: ${e.message.split('\n')[0]}`); } }

(async () => {
  fs.mkdirSync(CAPTURAS, { recursive: true });
  servidorPdf = http.createServer((req, res) => {
    const m = /\/pdf\/([^/]+)\.pdf$/.exec(new URL(req.url, 'http://x').pathname);
    const arq = m && path.join(PDFS, NOMES_ARQUIVO[m[1]] || '');
    if (!m || !NOMES_ARQUIVO[m[1]] || !fs.existsSync(arq)) { res.statusCode = 404; return res.end('sem pdf'); }
    const nome = decodeURIComponent((/download=([^&]*)/.exec(req.url) || [])[1] || '');
    res.writeHead(200, { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${nome}"` });
    res.end(fs.readFileSync(arq));
  });
  await new Promise((r) => servidorPdf.listen(0, '127.0.0.1', r));
  portaPdf = servidorPdf.address().port;
  const servidor = await new Promise((r) => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
  const porta = servidor.address().port;
  const base = `http://127.0.0.1:${porta}`;

  console.log('Rota e HTML servido');
  // fetch global está bloqueado (rede proibida); as chamadas HTTP locais usam o módulo http
  const get = (url) => new Promise((resolve, reject) => http.get(url, (res) => { const b = []; res.on('data', (d) => b.push(d)); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, corpo: Buffer.concat(b).toString('utf8') })); }).on('error', reject));

  for (const id of OBRAS) {
    await teste(`${id}: sem token → 403 e o bucket não é consultado`, async () => {
      const antes = downloadsHtml.length;
      const r = await get(`${base}/livros/${id}`);
      assert.strictEqual(r.status, 403);
      assert.strictEqual(downloadsHtml.length, antes);
    });
    await teste(`${id}: com token → 200, HTML do bucket sem impressão e com "Baixar PDF"`, async () => {
      const r = await get(`${base}/livros/${id}?token=ok-${id}`);
      assert.strictEqual(r.status, 200);
      assert.ok(!/window\.print\s*\(/.test(r.corpo), 'tem window.print(');
      assert.ok(!/data:application\/pdf/.test(r.corpo), 'tem PDF embutido');
      assert.ok(!/title="Baixar o livro \(\.html\)"/.test(r.corpo), 'tem "Baixar o livro (.html)"');
      assert.ok(/Baixar PDF/.test(r.corpo), 'sem botão "Baixar PDF"');
    });
    await teste(`${id}: /pdf com token → 302 para URL assinada com download=<nome amigável>`, async () => {
      const r = await get(`${base}/livros/${id}/pdf?token=ok-${id}`);
      assert.strictEqual(r.status, 302);
      assert.ok(r.headers.location.includes(`/pdf/${id}.pdf`));
      assert.ok(r.headers.location.includes('download=' + encodeURIComponent(NOMES_ARQUIVO[id])));
      assert.strictEqual(r.headers['cache-control'], 'no-store');
    });
  }

  console.log('Navegador: clique em "Baixar PDF" → download direto');
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  const perfis = [['desktop', { width: 1280, height: 800 }], ['390px', { width: 390, height: 844 }]];
  for (const id of OBRAS) {
    for (const [nomePerfil, vp] of perfis) {
      await teste(`${id} (${nomePerfil}): o clique baixa o PDF real, sem print()`, async () => {
        const ctx = await browser.newContext({ viewport: vp, acceptDownloads: true });
        const page = await ctx.newPage();
        await page.addInitScript(() => { window.__printCalls = 0; window.print = () => { window.__printCalls++; }; window.addEventListener('beforeprint', () => { window.__printCalls++; }); });
        await page.route('**/*', (rt) => { const u = rt.request().url(); return /^(http:\/\/127\.0\.0\.1|file:|data:|blob:)/.test(u) ? rt.continue() : rt.abort(); });
        const erros = []; page.on('pageerror', (e) => erros.push(e.message));
        await page.goto(`${base}/livros/${id}?token=ok-${id}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
        await page.waitForTimeout(4000);
        await page.screenshot({ path: path.join(CAPTURAS, `${id}-${nomePerfil}-capa.png`) });
        const alvo = page.locator('button, a').filter({ hasText: /^\s*(⇩\s*)?Baixar PDF\s*$/ }).first();
        await alvo.waitFor({ state: 'visible', timeout: 5000 });
        const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), alvo.click()]);
        const caminho = path.join(CAPTURAS, `_baixado-${id}-${nomePerfil}.pdf`);
        await dl.saveAs(caminho);
        const bytes = fs.readFileSync(caminho);
        assert.strictEqual(dl.suggestedFilename(), NOMES_ARQUIVO[id], 'nome do arquivo');
        assert.strictEqual(bytes.slice(0, 5).toString(), '%PDF-', 'não é PDF');
        assert.strictEqual(bytes.length, fs.statSync(path.join(PDFS, NOMES_ARQUIVO[id])).size, 'tamanho ≠ do PDF gerado');
        const prints = await page.evaluate(() => window.__printCalls).catch(() => 0);
        assert.strictEqual(prints, 0, 'window.print() foi chamado');
        assert.deepStrictEqual(erros, [], 'erro de JavaScript: ' + erros[0]);
        fs.unlinkSync(caminho);
        await ctx.close();
      });
    }
  }
  await browser.close();
  servidor.close(); servidorPdf.close();
  console.log(`\n${total - falhas.length}/${total} ok${falhas.length ? '\nFALHARAM:\n - ' + falhas.join('\n - ') : ''}\nCapturas em relatorios\\capturas_lote`);
  process.exit(falhas.length ? 1 : 0);
})();
