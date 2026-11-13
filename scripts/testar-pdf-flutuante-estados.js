// "Baixar PDF" flutuante: aparece só na capa e na última página; nas demais fica escondido e o leitor ganha um ícone discreto de download
// (⇩) na própria barra de controles, quando ela existe. Rota real (src/routes/livros.js) com Supabase/Storage simulados (HTML do bucket =
// cópias de _staging). Para cada obra com o botão flutuante confere, em 1366 px e 390 px:
//   P1  na capa o flutuante está visível;
//   P2  no meio do livro o flutuante está ESCONDIDO e, se o leitor tem barra (botão "A+"), o ícone ⇩ está na barra, visível, e leva a
//       /livros/<id>/pdf?token=…;
//   P3  na última página o flutuante volta a aparecer;
//   P4  o flutuante e o botão do Livro-Vivo não se sobrepõem em nenhum dos três momentos.
// Uso: node scripts/testar-pdf-flutuante-estados.js [--obras=a,b]
const assert = require('assert'); const fs = require('fs'); const path = require('path');
process.env.SUPABASE_URL = 'https://fake-project.invalid'; process.env.SUPABASE_KEY = 'FAKE_SECRET_KEY_FOR_TESTS_ONLY'; process.env.LIVRO_HTML_CACHE_SEGUNDOS = '0';
globalThis.fetch = async () => { throw new Error('rede proibida no teste'); };
const RAIZ = path.join(__dirname, '..'); const STAGING = path.join(RAIZ, '..', '..', 'Prontas para subir à loja', '_staging');
const arg = (n) => { const a = process.argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.split('=')[1] : null; };
const OBRAS = arg('obras') ? arg('obras').split(',') : ['a-tradutora', 'falsa-moralidade', 'o-baile-dos-herdeiros-posticos', 'entre-o-encanto-e-a-escolha', 'senti-percebi-escolhi', 'toda-familia-tem-duas-historias', 'toda-briga-tem-dois-comecos', 'a-bussola-do-adolescente'];
const { CATALOGO } = require('../src/lib/catalogoLivros'); for (const id of OBRAS) CATALOGO[id].chatDisponivel = true;
const agora = Date.now();
const db = { acessos_livros: OBRAS.map((id) => ({ email: 'x@x', tipo_produto: 'livro', data_pagamento: new Date(agora).toISOString(), usado_em: new Date(agora).toISOString(), revogado_em: null, livro_id: id, token: `ok-${id}`, data_expiracao: new Date(agora + 864e5).toISOString() })) };
function construtor(t) { const f = []; const b = { select() { return b; }, update() { return b; }, eq(c, v) { f.push([c, v]); return b; }, single() { const l = db[t].find((r) => f.every(([c, v]) => r[c] === v)); return Promise.resolve(l ? { data: { ...l }, error: null } : { data: null, error: { message: 'nf' } }); }, then(res, rej) { return Promise.resolve({ error: null }).then(res, rej); } }; return b; }
const sp = require.resolve('@supabase/supabase-js');
require.cache[sp] = { id: sp, filename: sp, loaded: true, exports: { createClient: () => ({ from: construtor, storage: { from: () => ({ download: async (c) => { const m = /^html\/(.+)\.html$/.exec(c); const a = m && path.join(STAGING, `${m[1]}.html`); return a && fs.existsSync(a) ? { data: new Blob([fs.readFileSync(a)]), error: null } : { data: null, error: { message: 'nf', statusCode: '404' } }; } }) } }) } };
const express = require('express'); const { injetarWidgetNoServico } = require('../src/lib/widgetLivroVivo');
const app = express();
app.use('/livros/:id', (req, res, next) => { if (req.path.endsWith('/pdf')) return next(); const enviar = res.send.bind(res); const id = req.params.id; res.send = (c) => enviar(typeof c === 'string' && /<\/body>/i.test(c) ? injetarWidgetNoServico(c, id, { chatDisponivel: true }).html : c); next(); });
app.use('/', require('../src/routes/livros'));
let total = 0; const falhas = [];
async function teste(n, fn) { total++; try { await fn(); console.log(`  ok   ${n}`); } catch (e) { falhas.push(n); console.log(`  FALHOU ${n}: ${e.message.split('\n')[0]}`); } }
const ler = () => {
  const r = (e) => { if (!e) return null; const q = e.getBoundingClientRect(); const cs = getComputedStyle(e); return q.width > 0 && q.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden' ? { left: q.left, top: q.top, right: q.right, bottom: q.bottom } : null; };
  const mais = [...document.querySelectorAll('button, [role=button], div, span, a')].find((e) => e.children.length === 0 && /^A\+$/.test((e.textContent || '').trim()) && !e.closest('#zuni-chat-widget'));
  return { pdf: r(document.getElementById('zs-baixar-pdf')), barra: r(document.getElementById('zs-pdf-barra')), temMais: !!mais, toggle: r(document.getElementById('zuni-chat-toggle')) };
};
const colide = (a, b) => a && b && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
(async () => {
  const srv = await new Promise((r) => { const s = app.listen(0, '127.0.0.1', () => r(s)); }); const base = `http://127.0.0.1:${srv.address().port}`;
  const { chromium } = require('playwright'); const b = await chromium.launch();
  for (const id of OBRAS) for (const [nome, vp, mob] of [['1366', { width: 1366, height: 800 }, false], ['390', { width: 390, height: 844 }, true]]) {
    await teste(`${id} @${nome}: flutuante na capa e no fim; escondido no meio, com ícone na barra`, async () => {
      const ctx = await b.newContext({ viewport: vp, isMobile: mob, hasTouch: mob, deviceScaleFactor: mob ? 3 : 1 }); const p = await ctx.newPage();
      await p.route('**/*', (rt) => (/^(http:\/\/127|data:|blob:)/.test(rt.request().url()) ? rt.continue() : rt.abort()));
      try {
        await p.goto(`${base}/livros/${id}?token=ok-${id}`, { waitUntil: 'domcontentloaded', timeout: 90000 }); await p.waitForTimeout(3500);
        const capa = await p.evaluate(ler);
        assert.ok(capa.pdf, 'P1 sem o flutuante na capa'); assert.ok(!colide(capa.pdf, capa.toggle), 'P4 flutuante e Livro-Vivo se sobrepõem na capa');
        await p.evaluate(() => { const o = document.getElementById('openBtn') || [...document.querySelectorAll('button')].find((x) => /abrir|clique para abrir/i.test(x.textContent)); if (o) o.click(); }); await p.waitForTimeout(1800);
        for (let i = 0; i < 6; i++) { await p.keyboard.press('ArrowRight'); await p.waitForTimeout(250); } await p.waitForTimeout(1500);
        const meio = await p.evaluate(ler);
        assert.strictEqual(meio.pdf, null, 'P2 o flutuante continua visível no meio do livro');
        if (meio.temMais) {
          assert.ok(meio.barra, 'P2 sem o ícone de download na barra'); assert.ok(!colide(meio.barra, meio.toggle), 'P4 ícone da barra e Livro-Vivo se sobrepõem');
          const [req] = await Promise.all([p.waitForRequest((r) => /\/livros\/[^/]+\/pdf\?token=/.test(r.url()), { timeout: 8000 }), p.evaluate(() => document.getElementById('zs-pdf-barra').click())]);
          assert.ok(req.url().includes(`/livros/${id}/pdf?token=ok-${id}`), req.url());
          await p.goto(`${base}/livros/${id}?token=ok-${id}`, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(3000);
          await p.evaluate(() => { const o = document.getElementById('openBtn') || [...document.querySelectorAll('button')].find((x) => /abrir|clique para abrir/i.test(x.textContent)); if (o) o.click(); }); await p.waitForTimeout(1500);
        }
        // última página
        // vai à última página: setas até o contador/campo de página chegar ao fim (leitores sem tecla End)
        for (let k = 0; k < 140; k++) {
          const fimLido = await p.evaluate(() => { const rg = document.querySelector('input[type=range]'); if (rg && rg.max !== '') return +rg.value >= +rg.max - 1; const st = document.querySelector('.status'); const m = st && /(\d+)\s*(?:de|\/)\s*(\d+)/.exec(st.textContent || ''); return !!m && +m[1] >= +m[2] - 1; });
          if (fimLido) break; await p.keyboard.press('ArrowRight'); await p.waitForTimeout(90);
        }
        await p.keyboard.press('End'); await p.waitForTimeout(700);
        await p.evaluate(() => { const r = document.querySelector('input[type=range]'); if (r && r.value !== r.max) { r.value = r.max; r.dispatchEvent(new Event('input', { bubbles: true })); r.dispatchEvent(new Event('change', { bubbles: true })); } });
        await p.waitForTimeout(2200);
        const fim = await p.evaluate(ler);
        assert.ok(fim.pdf, 'P3 o flutuante não voltou na última página'); assert.ok(!colide(fim.pdf, fim.toggle), 'P4 flutuante e Livro-Vivo se sobrepõem no fim');
      } finally { await ctx.close(); }
    });
  }
  await b.close(); srv.close();
  console.log(`\n${total - falhas.length}/${total} ok${falhas.length ? '\nFALHARAM:\n - ' + falhas.join('\n - ') : ''}`); process.exit(falhas.length ? 1 : 0);
})().catch((e) => { console.error('ERRO', e); process.exit(1); });
