// As 5 obras do Universo Feminino (PDF protegido no bucket): sem "Imprimir", com "Baixar PDF" funcionando. Rota real, Supabase simulado.
// Confere, no Chromium (1366 e 390 px), capa e leitor aberto: nenhum botão/link de imprimir, nenhum "Baixar" de HTML, um "Baixar PDF"
// (barra do leitor ou botão flutuante) que navega para /livros/<id>/pdf?token=…; window.print() nunca é chamado; nenhum erro novo de
// JavaScript; e a rota /livros/<id>/pdf redireciona à URL assinada com o mesmo token (e dá 403 sem token).
// Uso: node scripts/testar-sem-impressao-feminino.js [--obras=a,b]
const assert = require('assert');

process.env.SUPABASE_URL = 'https://fake-project.invalid'; process.env.SUPABASE_KEY = 'FAKE_SECRET_KEY_FOR_TESTS_ONLY'; process.env.LIVRO_HTML_CACHE_SEGUNDOS = '0';
const arg = (n) => { const a = process.argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.split('=')[1] : null; };
const OBRAS = arg('obras') ? arg('obras').split(',') : ['ela-tem-classe', 'codigo-feminino', 'a-inteligencia-do-corpo-feminino', 'inesquecivel-charme-feminino', 'a-mulher-que-permanece-inteira'];
const agora = Date.now();
const db = { acessos_livros: OBRAS.map((id) => ({ email: 'x@x', tipo_produto: 'livro', data_pagamento: new Date(agora).toISOString(), usado_em: new Date(agora).toISOString(), revogado_em: null, livro_id: id, token: `ok-${id}`, data_expiracao: new Date(agora + 86400000).toISOString() })) };
function construtor(t) {
  const f = [];
  const b = { select() { return b; }, update() { return b; }, eq(c, v) { f.push([c, v]); return b; },
    single() { const l = db[t].find((r) => f.every(([c, v]) => r[c] === v)); return Promise.resolve(l ? { data: { ...l }, error: null } : { data: null, error: { message: 'nf' } }); },
    then(res, rej) { return Promise.resolve({ error: null }).then(res, rej); } };
  return b;
}
const sp = require.resolve('@supabase/supabase-js');
require.cache[sp] = { id: sp, filename: sp, loaded: true, exports: { createClient: () => ({ from: construtor, storage: { from: () => ({ download: async () => ({ data: null, error: { message: 'nf' } }) }) } }) } };
const audio = require.resolve('../src/lib/audiolivroStorage'); const real = require(audio);
require.cache[audio].exports = { ...real, gerarUrlAssinada: async ({ path: p }) => 'https://assinada.invalid/' + p };
const express = require('express'); const app = express(); app.use('/', require('../src/routes/livros'));

let total = 0; const falhas = [];
async function teste(n, fn) { total++; try { await fn(); console.log(`  ok   ${n}`); } catch (e) { falhas.push(n); console.log(`  FALHOU ${n}: ${e.message.split('\n')[0]}`); } }

const inspecionar = () => {
  const els = [...document.querySelectorAll('button, a, [role=button]')].filter((e) => !e.closest('#zuni-chat-widget'));
  const rot = (e) => `${e.textContent || ''} ${e.id} ${e.getAttribute('title') || ''} ${e.getAttribute('aria-label') || ''}`;
  const ehPdf = (e) => /baixar pdf/i.test(rot(e)) || e.id === 'btnPdf' || e.id === 'zs-baixar-pdf';
  const visivel = (e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
  return {
    imprimir: els.filter((e) => /imprimir|print/i.test(rot(e))).map((e) => `${e.tagName}#${e.id}[${(e.textContent || '').trim().slice(0, 14)}]`),
    baixarHtml: els.filter((e) => e.hasAttribute('download') || e.id === 'btnDownload' || /\.html/i.test(e.getAttribute('title') || '')).length,
    baixarPdf: els.filter(ehPdf).length, pdfVisivel: els.filter((e) => ehPdf(e) && visivel(e)).length
  };
};
const clicarPdf = () => {
  const ehPdf = (e) => /baixar pdf/i.test(`${e.textContent} ${e.id} ${e.getAttribute('title') || ''}`) || e.id === 'btnPdf' || e.id === 'zs-baixar-pdf';
  const e = [...document.querySelectorAll('button, a, [role=button]')].filter((x) => !x.closest('#zuni-chat-widget')).find((x) => { const r = x.getBoundingClientRect(); return ehPdf(x) && r.width > 0 && r.height > 0; });
  if (e) e.click();
};

(async () => {
  const srv = await new Promise((r) => { const s = app.listen(0, '127.0.0.1', () => r(s)); }); const base = `http://127.0.0.1:${srv.address().port}`;
  const { chromium } = require('playwright'); const b = await chromium.launch();
  for (const id of OBRAS) {
    for (const [nome, vp, mob] of [['1366', { width: 1366, height: 800 }, false], ['390', { width: 390, height: 844 }, true]]) {
      await teste(`${id} @${nome}: sem Imprimir, sem Baixar HTML, "Baixar PDF" leva à rota protegida`, async () => {
        const ctx = await b.newContext({ viewport: vp, isMobile: mob, hasTouch: mob }); const p = await ctx.newPage(); const erros = [];
        p.on('pageerror', (e) => erros.push(e.message.slice(0, 100)));
        await p.addInitScript(() => { window.__imp = 0; window.print = () => { window.__imp++; }; });
        await p.route('**/*', (rt) => (/^(http:\/\/127|data:|blob:)/.test(rt.request().url()) ? rt.continue() : rt.abort()));
        try {
          await p.goto(`${base}/livros/${id}?token=ok-${id}`, { waitUntil: 'domcontentloaded', timeout: 90000 }); await p.waitForTimeout(3000);
          const capa = await p.evaluate(inspecionar);
          await p.evaluate(() => { const o = document.getElementById('openBtn') || [...document.querySelectorAll('button')].find((x) => /abrir|clique para abrir/i.test(x.textContent)); if (o) o.click(); });
          await p.waitForTimeout(1500);
          const leitor = await p.evaluate(inspecionar);
          assert.deepStrictEqual(capa.imprimir, [], 'capa com Imprimir: ' + capa.imprimir.join(' | '));
          assert.deepStrictEqual(leitor.imprimir, [], 'leitor com Imprimir: ' + leitor.imprimir.join(' | '));
          assert.strictEqual(capa.baixarHtml + leitor.baixarHtml, 0, 'Baixar HTML presente');
          assert.ok(leitor.pdfVisivel >= 1 || capa.pdfVisivel >= 1, 'sem "Baixar PDF" visível');
          // o "Baixar PDF" mora na capa (ou é o botão flutuante): volta à capa, se preciso, e clica onde ele está visível
          if (!(await p.evaluate(inspecionar)).pdfVisivel) await p.goto(`${base}/livros/${id}?token=ok-${id}`, { waitUntil: 'domcontentloaded' });
          await p.waitForTimeout(1500);
          const [req] = await Promise.all([p.waitForRequest((r) => /\/livros\/[^/]+\/pdf\?token=/.test(r.url()), { timeout: 8000 }), p.evaluate(clicarPdf)]);
          assert.ok(req.url().includes(`/livros/${id}/pdf?token=ok-${id}`), req.url());
          assert.strictEqual(await p.evaluate(() => window.__imp).catch(() => 0), 0, 'chamou window.print');
          assert.deepStrictEqual(erros.filter((e) => !/Failed to fetch|net::/.test(e)), [], 'erros de JS: ' + erros.join(' | '));
        } finally { await ctx.close(); }
      });
    }
  }
  await teste('rota /livros/<id>/pdf: 302 para a URL assinada com o token da compra; sem token, 403', async () => {
    const r = await fetch(`${base}/livros/ela-tem-classe/pdf?token=ok-ela-tem-classe`, { redirect: 'manual' });
    assert.strictEqual(r.status, 302); assert.ok(String(r.headers.get('location')).includes('pdf/ela-tem-classe.pdf'), r.headers.get('location'));
    const sem = await fetch(`${base}/livros/ela-tem-classe/pdf`, { redirect: 'manual' }); assert.strictEqual(sem.status, 403);
  });
  await b.close(); srv.close();
  console.log(`\n${total - falhas.length}/${total} ok${falhas.length ? '\nFALHARAM:\n - ' + falhas.join('\n - ') : ''}`);
  process.exit(falhas.length ? 1 : 0);
})().catch((e) => { console.error('ERRO', e); process.exit(1); });
