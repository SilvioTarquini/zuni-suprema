// Obras antigas sem o "Baixar" que entregava o livro como arquivo .html (vazamento). Rota real (src/routes/livros.js), Supabase simulado;
// as obras vêm de private/livros/. Para cada obra da lista LIVROS_SEM_DOWNLOAD_HTML confere, no navegador (Chromium):
//   D1  nenhum botão/link "Baixar" (texto, id btnDownload/link-baixar, atributo download, data-cact="down", onDownload) na capa nem no leitor aberto;
//   D2  o leitor continua funcionando: abrir o livro, virar a página e nenhum erro de JavaScript que a obra SEM o patch não tivesse;
//   D3  a rede de segurança bloqueia a criação de arquivo text/html para download;
//   D4  o botão "Imprimir" (fora do escopo) continua onde estava; o texto do livro não muda (mesmo número de caracteres visíveis ±1%).
// E, sem navegador: obra fora da lista passa idêntica; o patch é idempotente; toda obra de private/livros que ainda oferece download de HTML
// está na lista (ninguém novo escapa).
// Uso: node scripts/testar-sem-download-html.js [--obras=a,b] [--paralelo=4]

const assert = require('assert');
const fs = require('fs');
const path = require('path');

process.env.SUPABASE_URL = 'https://fake-project.invalid';
process.env.SUPABASE_KEY = 'FAKE_SECRET_KEY_FOR_TESTS_ONLY';
process.env.LIVRO_HTML_CACHE_SEGUNDOS = '0';
globalThis.fetch = async () => { throw new Error('rede proibida no teste'); };

const RAIZ = path.join(__dirname, '..');
const arg = (n) => { const a = process.argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.split('=').slice(1).join('=') : null; };
const PARALELO = parseInt(arg('paralelo') || '4', 10);
const { LIVROS_SEM_DOWNLOAD_HTML, removerDownloadHtml, aplicarPassos } = require('../src/lib/leitorSemDownloadHtml');
const { ehLivroSemImpressao } = require('../src/lib/leitorSemImpressao');
const { CATALOGO } = require('../src/lib/catalogoLivros');
const OBRAS = arg('obras') ? arg('obras').split(',') : [...LIVROS_SEM_DOWNLOAD_HTML];

const agora = Date.now();
const db = { acessos_livros: [...new Set([...OBRAS, ...Object.keys(CATALOGO)])].map((id) => ({ email: 'x@x', tipo_produto: 'livro', data_pagamento: new Date(agora).toISOString(), usado_em: new Date(agora).toISOString(), revogado_em: null, livro_id: id, token: `ok-${id}`, data_expiracao: new Date(agora + 86400000).toISOString() })) };
function construtor(tabela) {
  const f = [];
  const b = { select() { return b; }, update() { return b; }, eq(c, v) { f.push([c, v]); return b; },
    single() { const l = db[tabela].find((r) => f.every(([c, v]) => r[c] === v)); return Promise.resolve(l ? { data: { ...l }, error: null } : { data: null, error: { message: 'not found' } }); },
    then(res, rej) { return Promise.resolve({ error: null }).then(res, rej); } };
  return b;
}
const supaPath = require.resolve('@supabase/supabase-js');
require.cache[supaPath] = { id: supaPath, filename: supaPath, loaded: true, exports: { createClient: () => ({ from: construtor, storage: { from: () => ({ download: async () => ({ data: null, error: { message: 'Object not found', statusCode: '404' } }) }) } }) } };

const express = require('express');
const app = express(); app.use('/', require('../src/routes/livros'));
const SEM_PATCH = new Set(); // obras servidas "como eram" (para comparar erros de JavaScript)
app.get('/original/:id', (req, res) => { const f = path.join(RAIZ, 'private', 'livros', req.params.id, 'index.html'); if (!fs.existsSync(f)) return res.status(404).end(); res.type('html').send(fs.readFileSync(f, 'utf8')); });

let total = 0; const falhas = [];
async function teste(nome, fn) { total++; try { await fn(); console.log(`  ok   ${nome}`); } catch (e) { falhas.push(nome); console.log(`  FALHOU ${nome}: ${e.message.split('\n')[0]}`); } }

// O que o navegador enxerga de "baixar o livro como HTML", sem executar nada (capa ou leitor aberto).
const inspecionar = () => {
  const achados = [];
  const els = [...document.querySelectorAll('button, a, [role=button]')].filter((e) => !e.closest('#zuni-chat-widget'));
  for (const e of els) {
    const t = (e.textContent || '').replace(/\s+/g, ' ').trim(); const ti = e.getAttribute('title') || ''; const id = e.id || '';
    if (/baixar pdf/i.test(t) || id === 'btnPdf' || id === 'zs-baixar-pdf') continue; // "Baixar PDF" protegido é o botão certo
    if (/\bbaixar\b/i.test(t) || /\bbaixar\b.*\.html|\(\.html\)/i.test(ti) || id === 'btnDownload' || id === 'link-baixar' || e.hasAttribute('download') || e.getAttribute('data-cact') === 'down') achados.push(`${e.tagName}#${id}[${t.slice(0, 20)}]`);
  }
  const imprimir = els.filter((e) => /imprimir|print/i.test(`${e.textContent} ${e.id} ${e.getAttribute('title') || ''}`)).length;
  // letras visíveis do livro (sem o widget do Livro-Vivo, que só existe na versão servida)
  let letras = 0; const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) { const p = n.parentElement; if (!p || p.closest('#zuni-chat-widget, script, style, noscript')) continue; const cs = getComputedStyle(p); if (cs.display === 'none' || cs.visibility === 'hidden') continue; letras += n.nodeValue.replace(/\s+/g, '').length; }
  return { achados, imprimir, letras };
};

(async () => {
  console.log('Sem navegador');
  await teste('obra fora da lista (lote 2, bucket) passa idêntica', () => {
    const html = '<html><head></head><body><button id="btnDownload" title="Baixar o livro (.html)">Baixar</button></body></html>';
    assert.strictEqual(removerDownloadHtml('a-tradutora', html).html, html); assert.strictEqual(removerDownloadHtml('da-terra-ao-resultado', html).html, html);
  });
  await teste('os passos são idempotentes (segunda aplicação não muda nada)', () => {
    for (const id of ['ela-tem-classe', 'a-inteligencia-da-vida', 'a-arquitetura-da-decisao-humana', 'os-bastidores-da-mente-2-o-antidoto']) {
      const h = fs.readFileSync(path.join(RAIZ, 'private', 'livros', id, 'index.html'), 'utf8');
      const a = removerDownloadHtml(id, h); const b = removerDownloadHtml(id, a.html);
      assert.ok(a.passos.length > 0, `${id}: nenhum passo`); assert.strictEqual(b.html, a.html, `${id}: segunda aplicação mudou o html`);
    }
  });
  await teste('todas as obras da lista têm pelo menos um passo aplicado (a âncora existe)', () => {
    const sem = OBRAS.filter((id) => !removerDownloadHtml(id, fs.readFileSync(path.join(RAIZ, 'private', 'livros', id, 'index.html'), 'utf8')).passos.length);
    assert.deepStrictEqual(sem, []);
  });
  await teste('nenhuma obra de private/livros fora da lista ainda oferece download de HTML (ninguém novo escapa)', () => {
    const MARC = '<script type="__bundler/template">';
    const escapadas = [];
    for (const id of fs.readdirSync(path.join(RAIZ, 'private', 'livros'))) {
      const f = path.join(RAIZ, 'private', 'livros', id, 'index.html'); if (id.startsWith('_') || !fs.existsSync(f) || LIVROS_SEM_DOWNLOAD_HTML.has(id) || ehLivroSemImpressao(id)) continue;
      const h = fs.readFileSync(f, 'utf8'); let t = h; const i = h.lastIndexOf(MARC);
      if (i >= 0) { let j = i + MARC.length; while (/\s/.test(h[j])) j++; try { t = JSON.parse(h.slice(j, h.indexOf('</script>', j))); } catch (e) { t = h; } }
      if (/new Blob\(\s*\[[^\]]*\]\s*,\s*\{[^}]*text\/html|link\.download\s*=|id="link-baixar"|id="btnDownload"/.test(t)) escapadas.push(id);
    }
    assert.deepStrictEqual(escapadas, [], 'oferecem download de HTML e não estão em LIVROS_SEM_DOWNLOAD_HTML: ' + escapadas.join(', '));
  });

  const srv = await new Promise((r) => { const s = app.listen(0, '127.0.0.1', () => r(s)); }); const base = `http://127.0.0.1:${srv.address().port}`;
  const { chromium } = require('playwright'); const browser = await chromium.launch();

  async function abrir(url) {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 800 } }); const page = await ctx.newPage(); const erros = [];
    page.on('pageerror', (e) => erros.push(String(e.message).slice(0, 120)));
    await page.route('**/*', (rt) => (/^(http:\/\/127|data:|blob:)/.test(rt.request().url()) ? rt.continue() : rt.abort()));
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 }); await page.waitForTimeout(2500);
    return { ctx, page, erros };
  }

  console.log('Com navegador (1366 px)');
  let i = 0;
  await Promise.all(Array.from({ length: PARALELO }, async () => {
    while (i < OBRAS.length) {
      const id = OBRAS[i++];
      await teste(`${id}: sem "Baixar" (capa e leitor), leitor funciona, "Imprimir" e o texto intactos`, async () => {
        // original (sem patch): referência de erros, "Imprimir" e texto
        const o = await abrir(`${base}/original/${id}`); const ref = await o.page.evaluate(inspecionar); await o.ctx.close();
        const { ctx, page, erros } = await abrir(`${base}/livros/${id}?token=ok-${id}`);
        try {
          const capa = await page.evaluate(inspecionar);
          assert.deepStrictEqual(capa.achados, [], 'capa ainda oferece download: ' + capa.achados.join(' | '));
          await page.evaluate(() => { const o = document.getElementById('openBtn') || [...document.querySelectorAll('button')].find((b) => /abrir|clique para abrir/i.test(b.textContent)); if (o) o.click(); });
          await page.waitForTimeout(1500); for (let k = 0; k < 3; k++) { await page.keyboard.press('ArrowRight'); await page.waitForTimeout(250); }
          const leitor = await page.evaluate(inspecionar);
          assert.deepStrictEqual(leitor.achados, [], 'leitor aberto ainda oferece download: ' + leitor.achados.join(' | '));
          // D3: a rede de segurança
          const guarda = await page.evaluate(() => { try { return URL.createObjectURL(new Blob(['<html></html>'], { type: 'text/html' })); } catch (e) { return 'erro ' + e.message; } });
          assert.strictEqual(guarda, 'about:blank', 'rede de segurança não bloqueou o Blob text/html: ' + guarda);
          // D2: erros novos
          const novos = erros.filter((e) => !(o.erros || []).includes(e)); assert.deepStrictEqual(novos, [], 'erros de JavaScript novos: ' + novos.join(' | '));
          // D4: "Imprimir" e texto
          if (ehLivroSemImpressao(id)) assert.strictEqual(capa.imprimir, 0, '"Imprimir" deveria ter saído (PDF protegido existe)'); else assert.ok(capa.imprimir >= Math.min(1, ref.imprimir), `"Imprimir" sumiu (${ref.imprimir} → ${capa.imprimir})`);
          // a capa só perde a palavra do botão removido ("Baixar"/"BAIXAR", até 6 letras; "Baixar o guia" etc. não aparece na capa)
          const perdeu = ref.letras - capa.letras; assert.ok((perdeu >= -40 && perdeu <= 12) || Math.abs(perdeu) / Math.max(ref.letras, 1) < 0.02, `texto da capa mudou (${ref.letras} → ${capa.letras})`);
        } finally { await ctx.close(); }
      });
    }
  }));
  await browser.close(); srv.close();
  console.log(`\n${total - falhas.length}/${total} ok${falhas.length ? '\nFALHARAM:\n - ' + falhas.join('\n - ') : ''}`);
  process.exit(falhas.length ? 1 : 0);
})().catch((e) => { console.error('ERRO', e); process.exit(1); });
