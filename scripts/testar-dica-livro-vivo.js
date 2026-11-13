// Livro-Vivo no celular: pílula "💬 Livro-Vivo" e dica de primeira leitura. Página sintética com o widget REAL (modelo embutido), Chromium.
//   D1  celular: o botão é uma pílula com o rótulo "Livro-Vivo" (mais larga que alta), no canto superior direito;
//   D2  a dica aparece na primeira abertura da obra, com o texto exato, dentro da tela, ao lado (ou abaixo) do botão;
//   D3  some sozinha em ~6 s; D4 some ao tocar em qualquer lugar; D5 some ao abrir o chat;
//   D6  não reaparece (recarregar a página; mesma obra), mas aparece em OUTRA obra;
//   D7  sem localStorage (acesso lança erro) nada quebra e a dica aparece;
//   D8  sem espaço (página lotada de controles no topo e à direita) o botão cai para o círculo com a palavra "Livro-Vivo" embaixo.
// Uso: node scripts/testar-dica-livro-vivo.js
const assert = require('assert');
const { chromium } = require('playwright');
const { modeloWidgetPronto } = require('../src/lib/widgetLivroVivo');
const TEXTO = 'Dúvida sobre o que está lendo? Converse com o Livro-Vivo.';
const pagina = (livro, corpo = '<p style="margin:80px 20px">Texto do livro de teste.</p>') => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#222;color:#eee">${corpo}${modeloWidgetPronto().split('__ZUNI_LIVRO_ID__').join(livro)}</body></html>`;
let total = 0; const falhas = [];
async function teste(n, fn) { total++; try { await fn(); console.log(`  ok   ${n}`); } catch (e) { falhas.push(n); console.log(`  FALHOU ${n}: ${e.message.split('\n')[0]}`); } }
(async () => {
  const b = await chromium.launch();
  async function abrir(ctx, livro, corpo) {
    const p = await ctx.newPage(); const erros = []; p.on('pageerror', (e) => erros.push(e.message));
    await p.route('**/*', (r) => r.fulfill({ contentType: 'text/html; charset=utf-8', body: pagina(livro, corpo) }));
    await p.goto(`http://widget.test/livros/${livro}?token=tok`); return { p, erros };
  }
  const dica = (p) => p.evaluate(() => { const d = document.getElementById('zuni-chat-dica'); const r = d.getBoundingClientRect(); const t = document.getElementById('zuni-chat-toggle').getBoundingClientRect(); const vis = d.classList.contains('zuni-chat-dica-visivel') && r.width > 0; return { vis, texto: d.textContent.trim(), r: { l: r.left, t: r.top, rt: r.right, b: r.bottom }, tog: { l: t.left, t: t.top, rt: t.right, b: t.bottom }, vw: innerWidth, vh: innerHeight }; });
  const mobile = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 };

  await teste('D1 celular: pílula "💬 Livro-Vivo" no canto superior direito', async () => {
    const ctx = await b.newContext(mobile); const { p } = await abrir(ctx, 'obra-a'); await p.waitForTimeout(1500);
    const r = await p.evaluate(() => { const t = document.getElementById('zuni-chat-toggle'); const q = t.getBoundingClientRect(); const rot = t.querySelector('.zuni-chat-rotulo'); return { w: q.width, h: q.height, top: q.top, right: innerWidth - q.right, rotulo: getComputedStyle(rot).display !== 'none' ? rot.textContent : null, circulo: t.classList.contains('zuni-chat-modo-circulo') }; });
    assert.strictEqual(r.rotulo, 'Livro-Vivo'); assert.ok(r.w > r.h * 1.8, `não é pílula (${r.w}×${r.h})`); assert.ok(r.top < 60 && r.right < 30, `fora do canto superior direito: top ${r.top}, direita ${r.right}`); assert.ok(!r.circulo);
    await ctx.close();
  });
  await teste('D2 a dica aparece na primeira abertura, com o texto exato, dentro da tela e junto do botão', async () => {
    const ctx = await b.newContext(mobile); const { p } = await abrir(ctx, 'obra-b'); await p.waitForTimeout(3800);
    const d = await dica(p); assert.ok(d.vis, 'dica não apareceu'); assert.strictEqual(d.texto, TEXTO);
    assert.ok(d.r.l >= 0 && d.r.rt <= d.vw && d.r.t >= 0 && d.r.b <= d.vh, 'fora da tela ' + JSON.stringify(d.r));
    const junto = (d.r.rt <= d.tog.l + 1 && Math.abs((d.r.t + d.r.b) / 2 - (d.tog.t + d.tog.b) / 2) < 40) || (d.r.t >= d.tog.b - 1 && d.r.t - d.tog.b < 16);
    assert.ok(junto, 'não está ao lado/abaixo do botão ' + JSON.stringify({ r: d.r, tog: d.tog }));
    await ctx.close();
  });
  await teste('D3 some sozinha em ~6 s', async () => {
    const ctx = await b.newContext(mobile); const { p } = await abrir(ctx, 'obra-c'); await p.waitForTimeout(3500); assert.ok((await dica(p)).vis);
    await p.waitForTimeout(6500); assert.ok(!(await dica(p)).vis, 'continuou na tela'); await ctx.close();
  });
  await teste('D4 some ao tocar em qualquer lugar', async () => {
    const ctx = await b.newContext(mobile); const { p } = await abrir(ctx, 'obra-d'); await p.waitForTimeout(3500); assert.ok((await dica(p)).vis);
    await p.touchscreen.tap(150, 500); await p.waitForTimeout(300); assert.ok(!(await dica(p)).vis); await ctx.close();
  });
  await teste('D5 some ao abrir o chat', async () => {
    const ctx = await b.newContext(mobile); const { p } = await abrir(ctx, 'obra-e'); await p.waitForTimeout(3500); assert.ok((await dica(p)).vis);
    await p.click('#zuni-chat-toggle'); await p.waitForTimeout(400); assert.ok(!(await dica(p)).vis); await ctx.close();
  });
  await teste('D6 não reaparece na mesma obra (recarregando), mas aparece em outra obra', async () => {
    const ctx = await b.newContext(mobile); const a = await abrir(ctx, 'obra-f'); await a.p.waitForTimeout(3500); assert.ok((await dica(a.p)).vis); await a.p.waitForTimeout(6500); await a.p.close();
    const a2 = await abrir(ctx, 'obra-f'); await a2.p.waitForTimeout(3800); assert.ok(!(await dica(a2.p)).vis, 'reapareceu na mesma obra');
    const o = await abrir(ctx, 'obra-g'); await o.p.waitForTimeout(3800); assert.ok((await dica(o.p)).vis, 'não apareceu em outra obra'); await ctx.close();
  });
  await teste('D7 sem localStorage (lança erro): nada quebra e a dica aparece', async () => {
    const ctx = await b.newContext(mobile); await ctx.addInitScript(() => { const lanca = () => { throw new Error('storage bloqueado'); }; Storage.prototype.getItem = lanca; Storage.prototype.setItem = lanca; });
    const { p, erros } = await abrir(ctx, 'obra-h'); await p.waitForTimeout(3800); assert.ok((await dica(p)).vis, 'dica não apareceu sem storage'); assert.deepStrictEqual(erros, [], 'erros: ' + erros.join(' | ')); await ctx.close();
  });
  await teste('D8 sem espaço para a pílula: círculo com a palavra "Livro-Vivo" embaixo', async () => {
    // topo cheio de controles de ponta a ponta e coluna da direita ocupada: a pílula (~120 px) não cabe a 16 px de nada nas posições de cima
    const botoes = Array.from({ length: 60 }, (_, i) => `<button style="position:fixed;left:${(i % 6) * 66 + 6}px;top:${Math.floor(i / 6) * 84 + 8}px;width:60px;height:78px">B${i}</button>`).join('');
    const ctx = await b.newContext(mobile); const { p } = await abrir(ctx, 'obra-i', botoes); await p.waitForTimeout(2500);
    const r = await p.evaluate(() => { const t = document.getElementById('zuni-chat-toggle'); const q = t.getBoundingClientRect(); const rot = t.querySelector('.zuni-chat-rotulo'); return { circulo: t.classList.contains('zuni-chat-modo-circulo'), rotulo: getComputedStyle(rot).display !== 'none' ? rot.textContent : null, fs: parseFloat(getComputedStyle(rot).fontSize), w: q.width, h: q.height }; });
    assert.ok(r.circulo, 'não caiu para o círculo'); assert.strictEqual(r.rotulo, 'Livro-Vivo'); assert.ok(r.fs <= 11, 'letra não é pequena: ' + r.fs); assert.ok(r.h > r.w * 0.9, `rótulo não está embaixo (${r.w}×${r.h})`); await ctx.close();
  });
  await b.close();
  console.log(`\n${total - falhas.length}/${total} ok${falhas.length ? '\nFALHARAM:\n - ' + falhas.join('\n - ') : ''}`); process.exit(falhas.length ? 1 : 0);
})().catch((e) => { console.error('ERRO', e); process.exit(1); });
