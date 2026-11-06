// Leitor — nenhum trecho do livro pode ficar dentro de um link (texto sublinhado) nem haver <a> sem fechar no HTML servido.
//
// Motivo: o leitor da Herança de Papel embrulhava TODO o texto em <a href="página-atual"> quando servido por https (safeHref com href
// vazio resolvia para a própria página). Só aparece com o livro servido pela rota; como arquivo local (file://) nada acontecia.
//
// Sobe a rota REAL (src/routes/livros.js) com Storage e tabela de acessos simulados (HTML do bucket = cópias de _staging), abre cada
// obra no Chromium a 1366 e a 390 px, folheia até o texto e confere:
//   - HTML servido, fora de <script>/<style>/comentários: <a> e </a> em mesmo número (nenhum <a> sem fechar; vale também para o botão
//     "Baixar PDF" e o widget do chat injetados);
//   - DOM: nenhum trecho de texto do corpo (≥ 60 caracteres) dentro de um <a>, nenhum <a> com texto longo e nenhum texto do corpo sublinhado;
//   - o teste alcançou texto de verdade (senão falha: não vale passar sem ter olhado o texto).
// Obras: as 5 do lote (bucket) e 3 obras antigas (private/livros/). Capturas: relatorios/capturas_lote/links-<obra>-<largura>.png.
// Uso: node scripts/testar-links-leitor.js [--obras=a,b] [--so-estatico]

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
const CAPTURAS = path.join(RAIZ, 'relatorios', 'capturas_lote');
const LOTE = ['da-terra-ao-resultado', 'fazenda-lucrativa', 'a-bussola-do-adolescente', 'situacoes-da-vida-real', 'heranca-de-papel'];
const ANTIGAS = ['ela-tem-classe', 'vender-bem-vender-sempre', 'toda-mesa-tem-dois-lados'];
const arg = (n) => { const a = process.argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.split('=')[1].split(',') : null; };
const OBRAS = arg('obras') || [...LOTE, ...ANTIGAS];

// Da Terra: o arquivo antigo em disco (se ainda existir) não deve vencer o bucket neste teste.
const fsPromises = fs.promises; const acessoOriginal = fsPromises.access.bind(fsPromises);
fsPromises.access = (p, ...r) => (String(p).replace(/\\/g, '/').includes('private/livros/da-terra-ao-resultado/') ? Promise.reject(Object.assign(new Error('ENOENT'), { code: 'ENOENT' })) : acessoOriginal(p, ...r));

const agora = Date.now();
const db = { acessos_livros: OBRAS.map((id) => ({ email: 'x@x', tipo_produto: 'livro', data_pagamento: new Date(agora).toISOString(), usado_em: new Date(agora).toISOString(), revogado_em: null, livro_id: id, token: `ok-${id}`, data_expiracao: new Date(agora + 86400000).toISOString() })) };
function construtor(tabela) {
  const f = [];
  const b = { select() { return b; }, update() { return b; }, eq(c, v) { f.push([c, v]); return b; },
    single() { const l = db[tabela].find((r) => f.every(([c, v]) => r[c] === v)); return Promise.resolve(l ? { data: { ...l }, error: null } : { data: null, error: { message: 'not found' } }); },
    then(res, rej) { return Promise.resolve({ error: null }).then(res, rej); } };
  return b;
}
const supaPath = require.resolve('@supabase/supabase-js');
require.cache[supaPath] = { id: supaPath, filename: supaPath, loaded: true, exports: { createClient: () => ({ from: construtor, storage: { from: () => ({
  download: async (caminho) => { const m = /^html\/(.+)\.html$/.exec(caminho); const arq = m && path.join(STAGING, `${m[1]}.html`); return arq && fs.existsSync(arq) ? { data: new Blob([fs.readFileSync(arq)]), error: null } : { data: null, error: { message: 'Object not found', statusCode: '404' } }; } }) } }) } };

const express = require('express');
const { corrigirLinkVazio } = require('../src/lib/corrigirLeitor');
const app = express(); app.use('/', require('../src/routes/livros'));
const get = (url) => new Promise((resolve, reject) => http.get(url, (res) => { const b = []; res.on('data', (d) => b.push(d)); res.on('end', () => resolve({ status: res.statusCode, corpo: Buffer.concat(b).toString('utf8') })); }).on('error', reject));

const semScripts = (h) => h.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<!--[\s\S]*?-->/g, '');
const conta = (h, re) => (h.match(re) || []).length;

let total = 0; const falhas = [];
async function teste(nome, fn) { total++; try { await fn(); console.log(`  ok   ${nome}`); } catch (e) { falhas.push(nome); console.log(`  FALHOU ${nome}: ${e.message.split('\n')[0]}`); } }

(async () => {
  fs.mkdirSync(CAPTURAS, { recursive: true });
  console.log('Unidade: corrigirLinkVazio');
  await teste('href vazio não vira link: a função recebe um guard e o resultado só devolve "" para vazio', () => {
    const src = "class R{safeHref(s){try{const u=new URL(String(s||''),location.href);return ['http:','https:'].includes(u.protocol)?u.href:''}catch(e){return ''}}}";
    const r = corrigirLinkVazio(src); assert.ok(r.aplicado);
    const Classe = new Function('location', `${r.html}; return R;`)({ href: 'https://site.test/livros/x?token=abc' });
    const o = new Classe();
    assert.strictEqual(o.safeHref(''), ''); assert.strictEqual(o.safeHref('   '), ''); assert.strictEqual(o.safeHref(undefined), ''); assert.strictEqual(o.safeHref(null), '');
    assert.strictEqual(o.safeHref('https://exemplo.com/a'), 'https://exemplo.com/a');
    const original = new (new Function('location', `${src}; return R;`)({ href: 'https://site.test/livros/x?token=abc' }))();
    assert.strictEqual(original.safeHref(''), 'https://site.test/livros/x?token=abc', 'o defeito original deixou de existir: o teste perdeu o sentido');
  });
  await teste('HTML sem o padrão não é alterado', () => { const h = '<html><body>x</body></html>'; const r = corrigirLinkVazio(h); assert.ok(!r.aplicado && r.html === h); });

  const srv = await new Promise((r) => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
  const base = `http://127.0.0.1:${srv.address().port}`;
  console.log('HTML servido (estático)');
  for (const id of OBRAS) {
    await teste(`${id}: <a> e </a> em mesmo número fora de <script>/<style> (sem <a> sem fechar)`, async () => {
      const r = await get(`${base}/livros/${id}?token=ok-${id}`); assert.strictEqual(r.status, 200);
      const h = semScripts(r.corpo);
      assert.strictEqual(conta(h, /<a[\s>]/gi), conta(h, /<\/a>/gi), `<a>=${conta(h, /<a[\s>]/gi)} </a>=${conta(h, /<\/a>/gi)}`);
    });
  }
  if (process.argv.includes('--so-estatico')) { srv.close(); console.log(`\n${total - falhas.length}/${total} ok`); process.exit(falhas.length ? 1 : 0); }

  console.log('Navegador: texto do corpo fora de links e sem sublinhado');
  const { chromium } = require('playwright'); const browser = await chromium.launch();
  for (const id of OBRAS) {
    for (const [larg, vp, mobile] of [[1366, { width: 1366, height: 800 }, false], [390, { width: 390, height: 844 }, true]]) {
      await teste(`${id} (${larg}px): nenhum trecho do corpo dentro de <a>, nenhum <a> com texto longo, nada sublinhado`, async () => {
        const ctx = await browser.newContext({ viewport: vp, isMobile: mobile, hasTouch: mobile }); const page = await ctx.newPage();
        await page.route('**/*', (rt) => (/^(http:\/\/127|data:|blob:)/.test(rt.request().url()) ? rt.continue() : rt.abort()));
        const erros = []; page.on('pageerror', (e) => erros.push(e.message));
        await page.goto(`${base}/livros/${id}?token=ok-${id}`, { waitUntil: 'domcontentloaded', timeout: 90000 }); await page.waitForTimeout(3500);
        await page.evaluate(() => { const o = document.getElementById('openBtn') || [...document.querySelectorAll('button')].find((b) => /abrir|clique para abrir/i.test(b.textContent)); if (o) o.click(); });
        await page.waitForTimeout(2000);
        const ler = () => page.evaluate(() => {
          const visivel = (e) => e.offsetParent !== null || getComputedStyle(e).position === 'fixed';
          const folhas = [...document.querySelectorAll('body *')].filter((e) => e.children.length === 0 && (e.textContent || '').trim().length >= 60 && visivel(e) && !e.closest('#zuni-chat-widget, #zs-baixar-pdf, script, style, noscript, template'));
          return {
            folhas: folhas.length,
            emLink: folhas.filter((e) => e.closest('a')).length,
            sublinhadas: folhas.filter((e) => getComputedStyle(e).textDecorationLine.includes('underline')).length,
            linksLongos: [...document.querySelectorAll('a')].filter((a) => (a.textContent || '').trim().length >= 80 && !a.closest('#zuni-chat-widget')).length,
            exemplo: folhas[0] ? folhas[0].textContent.trim().slice(0, 40) : null
          };
        });
        let r = await ler();
        for (let i = 0; i < 24 && r.folhas === 0; i++) { await page.keyboard.press('ArrowRight'); await page.waitForTimeout(350); if (i % 6 === 5) { await page.evaluate(() => { const n = document.getElementById('next'); if (n) n.click(); }); } r = await ler(); }
        for (let i = 0; i < 4; i++) { await page.keyboard.press('ArrowRight'); await page.waitForTimeout(350); const r2 = await ler(); r = { ...r2, folhas: Math.max(r.folhas, r2.folhas), emLink: Math.max(r.emLink, r2.emLink), sublinhadas: Math.max(r.sublinhadas, r2.sublinhadas), linksLongos: Math.max(r.linksLongos, r2.linksLongos) }; }
        await page.screenshot({ path: path.join(CAPTURAS, `links-${id}-${larg}.png`) });
        await ctx.close();
        assert.ok(r.folhas > 0, 'o teste não chegou a nenhum trecho de texto do livro');
        assert.strictEqual(r.emLink, 0, `${r.emLink} trecho(s) do corpo dentro de <a> (ex.: "${r.exemplo}")`);
        assert.strictEqual(r.linksLongos, 0, `${r.linksLongos} <a> com texto longo`);
        assert.strictEqual(r.sublinhadas, 0, `${r.sublinhadas} trecho(s) do corpo sublinhado(s)`);
        assert.deepStrictEqual(erros, [], 'erro de JavaScript: ' + erros[0]);
      });
    }
  }
  await browser.close(); srv.close();
  console.log(`\n${total - falhas.length}/${total} ok${falhas.length ? '\nFALHARAM:\n - ' + falhas.join('\n - ') : ''}\nCapturas em relatorios\\capturas_lote (links-<obra>-<largura>.png)`);
  process.exit(falhas.length ? 1 : 0);
})().catch((e) => { console.error('ERRO', e); process.exit(1); });
