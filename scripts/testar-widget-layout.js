// Widget do chat e botão "Baixar PDF" — posição na tela (Chromium, 390 e 1366 px).
//
// C1: com o chat ABERTO, nada cobre o título do chat (o botão flutuante "Baixar PDF" some/fica por baixo).
// C2: no celular (390 px), o botão flutuante "Livro-Vivo" não cobre nenhum controle do leitor (barra de baixo, setas, sumário…).
// Rota real (src/routes/livros.js), Storage/tabela de acessos simulados (HTML do bucket = cópias de _staging); as obras de private/livros/
// usam o widget gravado no arquivo (por isso a reinjeção com scripts/injetar-chat-livros.js entra no mesmo commit).
// Capturas: relatorios/capturas_lote/c2-<obra>-390.png (leitura, botões) e c1-<obra>-1366-chat.png (chat aberto).
// C3: botão redondo no celular, botão largo no computador, 0 sobreposições nos dois tamanhos e depois de redimensionar.
// Uso: node scripts/testar-widget-layout.js [--obras=a,b]

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
const ANTIGAS = ['ela-tem-classe', 'os-bastidores-da-mente-2-o-antidoto', 'tempo-para-viver'];
const arg = (n) => { const a = process.argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.split('=')[1].split(',') : null; };
const OBRAS = arg('obras') || [...LOTE, ...ANTIGAS];

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
const app = express(); app.use('/', require('../src/routes/livros'));

let total = 0; const falhas = [];
async function teste(nome, fn) { total++; try { await fn(); console.log(`  ok   ${nome}`); } catch (e) { falhas.push(nome); console.log(`  FALHOU ${nome}: ${e.message.split('\n')[0]}`); } }
const intersecta = (a, b) => a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1;

(async () => {
  fs.mkdirSync(CAPTURAS, { recursive: true });
  const srv = await new Promise((r) => { const s = app.listen(0, '127.0.0.1', () => r(s)); }); const base = `http://127.0.0.1:${srv.address().port}`;
  const { chromium } = require('playwright'); const browser = await chromium.launch();

  async function abrir(id, vp, mobile) {
    const ctx = await browser.newContext({ viewport: vp, isMobile: mobile, hasTouch: mobile }); const page = await ctx.newPage();
    await page.route('**/*', (rt) => (/^(http:\/\/127|data:|blob:)/.test(rt.request().url()) ? rt.continue() : rt.abort()));
    await page.goto(`${base}/livros/${id}?token=ok-${id}`, { waitUntil: 'domcontentloaded', timeout: 90000 }); await page.waitForTimeout(3500);
    await page.evaluate(() => { const o = document.getElementById('openBtn') || [...document.querySelectorAll('button')].find((b) => /abrir|clique para abrir/i.test(b.textContent)); if (o) o.click(); });
    await page.waitForTimeout(2000);
    for (let i = 0; i < 6; i++) { await page.keyboard.press('ArrowRight'); await page.waitForTimeout(300); }
    return { ctx, page };
  }

  console.log('C2 — celular (390 px): o botão "Livro-Vivo" não cobre controles do leitor');
  for (const id of OBRAS) {
    await teste(`${id}: o botão "Livro-Vivo" está acima da barra e não cobre nenhum controle`, async () => {
      const { ctx, page } = await abrir(id, { width: 390, height: 844 }, true);
      const r = await page.evaluate(() => {
        const t = document.getElementById('zuni-chat-toggle'); if (!t) return { sem: true };
        const nWidgets = document.querySelectorAll('#zuni-chat-widget').length;
        const rt = t.getBoundingClientRect();
        const ctrl = [...document.querySelectorAll('button, [role=button], input[type=range], a[href], select')].filter((e) => {
          if (e.closest('#zuni-chat-widget') || e.id === 'zs-baixar-pdf') return false;
          const r = e.getBoundingClientRect(); const cs = getComputedStyle(e);
          if (!(r.width > 4 && r.height > 4 && cs.visibility !== 'hidden' && cs.display !== 'none' && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth)) return false;
          // só conta controle realmente visível: o elemento no topo do ponto central é ele mesmo (ex.: os botões da capa ficam atrás do leitor)
          const cx = Math.min(Math.max(r.left + r.width / 2, 1), innerWidth - 1); const cy = Math.min(Math.max(r.top + r.height / 2, 1), innerHeight - 1);
          // (se quem está por cima é o próprio widget/botão flutuante, o controle está sendo COBRIDO — isso é justamente o que se quer pegar)
          const topo = document.elementFromPoint(cx, cy); return !!topo && (topo === e || e.contains(topo) || !!topo.closest('#zuni-chat-widget, #zs-baixar-pdf'));
        }).map((e) => { const r = e.getBoundingClientRect(); return { id: e.id || e.className.toString().slice(0, 20) || e.tagName, left: r.left, right: r.right, top: r.top, bottom: r.bottom }; });
        return { nWidgets, toggle: { left: rt.left, right: rt.right, top: rt.top, bottom: rt.bottom }, ctrl, vh: innerHeight, vw: innerWidth };
      });
      await page.screenshot({ path: path.join(CAPTURAS, `c2-${id}-390.png`) }); await ctx.close();
      assert.ok(!r.sem, 'sem botão do chat (o leitor apagou o widget?)');
      assert.strictEqual(r.nWidgets, 1, `${r.nWidgets} widgets na tela (esperado exatamente 1)`);
      assert.ok(r.toggle.left >= 0 && r.toggle.right <= r.vw && r.toggle.bottom <= r.vh, 'botão fora da tela');
      const cobertos = r.ctrl.filter((c) => intersecta(r.toggle, c)); assert.strictEqual(cobertos.length, 0, 'cobre: ' + cobertos.map((c) => c.id).join(', '));
    });
  }

  console.log('C1 — computador (1366 px): com o chat aberto, nada cobre o título do chat');
  for (const id of OBRAS) {
    await teste(`${id}: título do chat visível e livre; "Baixar PDF" some enquanto o chat está aberto e volta ao fechar`, async () => {
      const { ctx, page } = await abrir(id, { width: 1366, height: 800 }, false);
      const ehCapaOuFim = false; // (o teste abre o livro e vira 6 páginas)
      const antes = await page.evaluate(() => { const p = document.getElementById('zs-baixar-pdf'); return p ? getComputedStyle(p).display !== 'none' : null; });
      await page.click('#zuni-chat-toggle'); await page.waitForTimeout(700);
      const r = await page.evaluate(() => {
        const tit = document.getElementById('zuni-chat-titulo'); const rt = tit.getBoundingClientRect(); const cx = rt.left + rt.width / 2; const cy = rt.top + rt.height / 2;
        const topo = document.elementFromPoint(cx, cy); const p = document.getElementById('zs-baixar-pdf');
        let pillCobre = false; if (p && getComputedStyle(p).display !== 'none') { const a = p.getBoundingClientRect(); pillCobre = a.left < rt.right && a.right > rt.left && a.top < rt.bottom && a.bottom > rt.top; }
        return { tituloLivre: !!topo && !!topo.closest('#zuni-chat-painel'), pillVisivel: p ? getComputedStyle(p).display !== 'none' : null, pillCobre };
      });
      await page.screenshot({ path: path.join(CAPTURAS, `c1-${id}-1366-chat.png`) });
      await page.keyboard.press('Escape'); await page.waitForTimeout(500);
      const depois = await page.evaluate(() => { const p = document.getElementById('zs-baixar-pdf'); return p ? getComputedStyle(p).display !== 'none' : null; });
      await ctx.close();
      assert.ok(r.tituloLivre, 'algo cobre o título do chat'); assert.ok(!r.pillCobre, '"Baixar PDF" cobre o título');
      // desde 12/11/2026 o flutuante só aparece na capa e na última página: no meio do livro (aqui, depois de virar 6 páginas) fica escondido, com o chat fechado, aberto e de novo fechado
      if (antes !== null) { assert.ok(antes === false || ehCapaOuFim, '"Baixar PDF" deveria estar escondido no meio do livro'); assert.strictEqual(r.pillVisivel, false, '"Baixar PDF" visível com o chat aberto'); assert.ok(depois === false || ehCapaOuFim, '"Baixar PDF" apareceu no meio do livro ao fechar o chat'); }
    });
  }

  // Medida independente do widget: controles realmente visíveis (o elemento do topo no ponto central é ele mesmo) que o botão cobre.
  const medir = () => {
    const t = document.getElementById('zuni-chat-toggle'); if (!t) return { sem: true };
    const rt = t.getBoundingClientRect(); const cs = getComputedStyle(t);
    const ctrl = [...document.querySelectorAll('button, [role=button], input[type=range], a[href], select')].filter((e) => {
      if (e.closest('#zuni-chat-widget') || e.id === 'zs-baixar-pdf') return false;
      const r = e.getBoundingClientRect(); const c = getComputedStyle(e);
      if (!(r.width > 4 && r.height > 4 && c.visibility !== 'hidden' && c.display !== 'none' && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth)) return false;
      const cx = Math.min(Math.max(r.left + r.width / 2, 1), innerWidth - 1); const cy = Math.min(Math.max(r.top + r.height / 2, 1), innerHeight - 1);
      const topo = document.elementFromPoint(cx, cy); return !!topo && (topo === e || e.contains(topo) || !!topo.closest('#zuni-chat-widget, #zs-baixar-pdf'));
    }).map((e) => { const r = e.getBoundingClientRect(); return { id: e.id || e.className.toString().slice(0, 20) || e.tagName, left: r.left, right: r.right, top: r.top, bottom: r.bottom }; });
    const pdf = document.getElementById('zs-baixar-pdf'); const pr = pdf && getComputedStyle(pdf).display !== 'none' ? pdf.getBoundingClientRect() : null;
    if (pr) ctrl.push({ id: 'zs-baixar-pdf', left: pr.left, right: pr.right, top: pr.top, bottom: pr.bottom });
    return { toggle: { left: rt.left, right: rt.right, top: rt.top, bottom: rt.bottom, w: rt.width, h: rt.height }, rotuloVisivel: getComputedStyle(t.querySelector('.zuni-chat-rotulo')).display !== 'none', raio: cs.borderRadius, ctrl, vw: innerWidth, vh: innerHeight };
  };
  const sobrepostos = (r) => r.ctrl.filter((c) => intersecta(r.toggle, c)).map((c) => c.id);

  console.log('C3 — formato e posição em 390 px e 1366 px, e depois de redimensionar a tela');
  for (const id of OBRAS) {
    await teste(`${id}: celular = pílula "💬 Livro-Vivo" (ou, sem espaço, círculo com a palavra embaixo); computador = botão com rótulo; 0 sobreposições nos dois e depois de redimensionar`, async () => {
      const { ctx, page } = await abrir(id, { width: 390, height: 844 }, true);
      const m = await page.evaluate(medir);
      assert.ok(!m.sem, 'sem botão');
      // desde 12/11/2026: pílula compacta com o rótulo; se não coube sem sobrepor, círculo de 48 px com a palavra embaixo (rótulo também visível)
      assert.ok(m.toggle.w > m.toggle.h * 1.5 || (m.toggle.h > 50 && m.toggle.w <= 80), `no celular o botão deveria ser a pílula ou o círculo com rótulo (${Math.round(m.toggle.w)}×${Math.round(m.toggle.h)})`);
      assert.strictEqual(m.rotuloVisivel, true, 'no celular o rótulo "Livro-Vivo" deveria estar visível');
      assert.deepStrictEqual(sobrepostos(m), [], 'cobre no celular: ' + sobrepostos(m).join(', '));
      assert.ok(m.toggle.left >= 0 && m.toggle.right <= m.vw && m.toggle.top >= 0 && m.toggle.bottom <= m.vh, 'botão fora da tela (celular)');
      // celular → computador (redimensionar): o widget reavalia sozinho
      await page.setViewportSize({ width: 1366, height: 800 }); await page.waitForTimeout(1500);
      const d = await page.evaluate(medir);
      assert.strictEqual(d.rotuloVisivel, true, 'no computador o rótulo deveria aparecer');
      assert.ok(d.toggle.w > 80, `no computador o botão deveria ser o botão largo (${Math.round(d.toggle.w)} px)`);
      assert.deepStrictEqual(sobrepostos(d), [], 'cobre no computador (depois de redimensionar): ' + sobrepostos(d).join(', '));
      // computador → celular
      await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(1500);
      const c = await page.evaluate(medir);
      assert.deepStrictEqual(sobrepostos(c), [], 'cobre no celular (depois de redimensionar de volta): ' + sobrepostos(c).join(', '));
      await ctx.close();
      const { ctx: ctx2, page: p2 } = await abrir(id, { width: 1366, height: 800 }, false);
      const dd = await p2.evaluate(medir);
      await ctx2.close();
      assert.deepStrictEqual(sobrepostos(dd), [], 'cobre no computador: ' + sobrepostos(dd).join(', '));
    });
  }

  await browser.close(); srv.close();
  console.log(`\n${total - falhas.length}/${total} ok${falhas.length ? '\nFALHARAM:\n - ' + falhas.join('\n - ') : ''}\nCapturas em relatorios\\capturas_lote (c1-*, c2-*)`);
  process.exit(falhas.length ? 1 : 0);
})().catch((e) => { console.error('ERRO', e); process.exit(1); });
