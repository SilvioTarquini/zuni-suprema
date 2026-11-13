// Botões flutuantes (Livro-Vivo e "Baixar PDF") nas 65 obras com leitor, em 390 px (celular) e 1366 px (computador).
//
// Rota real (src/routes/livros.js) com Supabase/Storage simulados (HTML do bucket = cópias de _staging; as demais vêm de private/livros/).
// O Livro-Vivo é injetado em TODAS as obras (o teste mede layout, não a ficha do catálogo). Para cada obra e tamanho mede, de forma
// independente do widget (elemento do topo no ponto central = controle realmente tocável):
//   S1  botão Livro-Vivo × controles do leitor, com 16 px de margem de toque;
//   S2  "Baixar PDF" flutuante × controles do leitor, com 16 px de margem de toque;
//   S3  Livro-Vivo × "Baixar PDF" flutuante;
//   S4  (celular) Livro-Vivo × linhas de texto da página;
//   S5  exatamente 1 widget; botão dentro da tela.
// Saída: relatorios/flutuantes_<data>/medicao_<rotulo>.json + capturas de 4 leitores (--capturas).
// Uso: node scripts/testar-flutuantes-65.js [--obras=a,b] [--rotulo=antes] [--capturas] [--paralelo=4]

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
const arg = (n) => { const a = process.argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.split('=').slice(1).join('=') : null; };
const ROTULO = arg('rotulo') || 'atual';
const CAPTURAR = process.argv.includes('--capturas');
const PARALELO = parseInt(arg('paralelo') || '4', 10);
const SAIDA = path.join(RAIZ, 'relatorios', 'flutuantes_2026-11-12');
const MARGEM_TOQUE = 16;

const { CATALOGO } = require('../src/lib/catalogoLivros');
const TODAS = Object.keys(CATALOGO).filter((id) => fs.existsSync(path.join(RAIZ, 'private', 'livros', id, 'index.html')) || fs.existsSync(path.join(STAGING, `${id}.html`)));
const OBRAS = arg('obras') ? arg('obras').split(',') : TODAS;
for (const id of TODAS) CATALOGO[id].chatDisponivel = true; // o teste mede layout em todos os leitores

const fsPromises = fs.promises; const acessoOriginal = fsPromises.access.bind(fsPromises);
// obras que existem em _staging não devem ser lidas de private/livros (como em produção: Da Terra vem do bucket)
fsPromises.access = (p, ...r) => (/private[\\/]+livros[\\/]+da-terra-ao-resultado[\\/]/.test(String(p)) ? Promise.reject(Object.assign(new Error('ENOENT'), { code: 'ENOENT' })) : acessoOriginal(p, ...r));

const agora = Date.now();
const db = { acessos_livros: TODAS.map((id) => ({ email: 'x@x', tipo_produto: 'livro', data_pagamento: new Date(agora).toISOString(), usado_em: new Date(agora).toISOString(), revogado_em: null, livro_id: id, token: `ok-${id}`, data_expiracao: new Date(agora + 86400000).toISOString() })) };
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
const { injetarWidgetNoServico } = require('../src/lib/widgetLivroVivo');
const app = express();
// obras do disco que não são "bundler" não recebem o widget na hora de servir (as 10 antigas já o trazem gravado): o teste o injeta em todas
app.use('/livros/:id', (req, res, next) => {
  if (req.path.endsWith('/pdf')) return next();
  const enviar = res.send.bind(res); const id = req.params.id; // (req.params muda quando a rota interna assume)
  res.send = (corpo) => enviar(typeof corpo === 'string' && /<\/body>/i.test(corpo) ? injetarWidgetNoServico(corpo, id, { chatDisponivel: true }).html : corpo);
  next();
});
app.use('/', require('../src/routes/livros'));

(async () => {
  fs.mkdirSync(SAIDA, { recursive: true });
  const srv = await new Promise((r) => { const s = app.listen(0, '127.0.0.1', () => r(s)); }); const base = `http://127.0.0.1:${srv.address().port}`;
  const { chromium } = require('playwright'); const browser = await chromium.launch();

  // Tudo o que é medido roda dentro da página, com os mesmos critérios nos dois tamanhos.
  const medir = (margem) => {
    const vw = innerWidth, vh = innerHeight;
    const ret = (r) => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom });
    const toggle = document.getElementById('zuni-chat-toggle');
    const pdfEl = document.getElementById('zs-baixar-pdf');
    const pdfVisivel = pdfEl && getComputedStyle(pdfEl).display !== 'none';
    const ctrl = [...document.querySelectorAll('button, [role=button], input, select, textarea, summary, a[href]')].filter((e) => {
      if (e.closest('#zuni-chat-widget') || e.id === 'zs-baixar-pdf') return false;
      const r = e.getBoundingClientRect(); const cs = getComputedStyle(e);
      if (!(r.width > 4 && r.height > 4 && cs.visibility !== 'hidden' && cs.display !== 'none' && cs.pointerEvents !== 'none' && parseFloat(cs.opacity) !== 0 && r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw)) return false;
      if (r.width * r.height > 0.35 * vw * vh) return false;
      const cx = Math.min(Math.max(r.left + r.width / 2, 1), vw - 1); const cy = Math.min(Math.max(r.top + r.height / 2, 1), vh - 1);
      const topo = document.elementFromPoint(cx, cy);
      return !!topo && (topo === e || e.contains(topo) || !!topo.closest('#zuni-chat-widget, #zs-baixar-pdf'));
    }).map((e) => ({ id: (e.id || String(e.className).slice(0, 24) || e.tagName) + (e.textContent ? `[${e.textContent.trim().slice(0, 12)}]` : ''), ...ret(e.getBoundingClientRect()) }));
    // controles que não são <button>/<a> (div.zs-btn etc.): pequenos, visíveis, cursor:pointer e no topo no ponto central; vale o de fora (círculo inteiro)
    for (const e of document.querySelectorAll('div, span, li, svg, label, i, img, [onclick], [tabindex]')) {
      const r = e.getBoundingClientRect();
      if (r.width < 8 || r.height < 8 || r.width > 140 || r.height > 140 || r.right <= 0 || r.bottom <= 0 || r.left >= vw || r.top >= vh) continue;
      if (e.closest('#zuni-chat-widget') || e.id === 'zs-baixar-pdf' || e.closest('#zs-baixar-pdf')) continue;
      const cs = getComputedStyle(e); if (cs.cursor !== 'pointer' || cs.visibility === 'hidden' || cs.display === 'none' || cs.pointerEvents === 'none' || parseFloat(cs.opacity) === 0) continue;
      const pai = e.parentElement; if (pai && pai !== document.body) { const rp2 = pai.getBoundingClientRect(); if (rp2.width <= 140 && rp2.height <= 140 && rp2.width > 0 && getComputedStyle(pai).cursor === 'pointer') continue; }
      const topo = document.elementFromPoint(Math.min(Math.max(r.left + r.width / 2, 1), vw - 1), Math.min(Math.max(r.top + r.height / 2, 1), vh - 1)); if (!topo || !(topo === e || e.contains(topo))) continue;
      if (ctrl.some((c) => Math.abs(c.left - r.left) < 2 && Math.abs(c.top - r.top) < 2 && Math.abs(c.right - r.right) < 2)) continue;
      ctrl.push({ id: `ptr:${e.id || String(e.className).slice(0, 18) || e.tagName}`, ...ret(r) });
    }
    // linhas de texto visíveis (para o celular): nós de texto fora de controles e do widget
    const linhas = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n; let guarda = 0;
    while ((n = walker.nextNode()) && guarda++ < 40000) {
      const t = n.nodeValue.replace(/\s+/g, ' ').trim();
      const p = n.parentElement; if (!p || (t.length < 12 && !/^H[1-4]$/.test(p.tagName)) || t.length < 3 || p.closest('#zuni-chat-widget, #zs-baixar-pdf, script, style, noscript, button, a, select, textarea, label, svg, [role=button]')) continue;
      const cs = getComputedStyle(p); if (cs.visibility === 'hidden' || cs.display === 'none' || parseFloat(cs.opacity) === 0) continue;
      const rg = document.createRange(); rg.selectNodeContents(n);
      for (const r of rg.getClientRects()) {
        if (r.width < 8 || r.height < 6 || r.bottom <= 0 || r.top >= vh || r.right <= 0 || r.left >= vw) continue;
        const cx = Math.min(Math.max(r.left + r.width / 2, 1), vw - 1); const cy = Math.min(Math.max(r.top + r.height / 2, 1), vh - 1);
        const topo = document.elementFromPoint(cx, cy); if (!topo || !(p.contains(topo) || topo.contains(p) || topo === p)) continue; // coberto por outra coisa (capa, painel)
        linhas.push(ret(r)); if (linhas.length > 1500) break;
      }
      if (linhas.length > 1500) break;
    }
    return { vw, vh, nWidgets: document.querySelectorAll('#zuni-chat-widget').length, toggle: toggle ? ret(toggle.getBoundingClientRect()) : null, pdf: pdfVisivel ? ret(pdfEl.getBoundingClientRect()) : null, ctrl, linhas, margem };
  };
  const toca = (a, b, folga) => a.left < b.right + folga && a.right > b.left - folga && a.top < b.bottom + folga && a.bottom > b.top - folga;

  async function abrir(id, vp, mobile) {
    const ctx = await browser.newContext({ viewport: vp, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 3 : 1 }); const page = await ctx.newPage();
    await page.route('**/*', (rt) => (/^(http:\/\/127|data:|blob:)/.test(rt.request().url()) ? rt.continue() : rt.abort()));
    await page.goto(`${base}/livros/${id}?token=ok-${id}`, { waitUntil: 'domcontentloaded', timeout: 90000 }); await page.waitForTimeout(3000);
    await page.evaluate(() => { const o = document.getElementById('openBtn') || [...document.querySelectorAll('button')].find((b) => /abrir|clique para abrir/i.test(b.textContent)); if (o) o.click(); });
    await page.waitForTimeout(1800);
    // alguns leitores demoram a ligar o clique: se a capa ainda está na tela, clica de novo (até 3 vezes)
    for (let t = 0; t < 3; t++) {
      const capa = await page.evaluate(() => { const o = document.getElementById('openBtn'); if (!o) return false; const r = o.getBoundingClientRect(); const topo = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return r.width > 0 && !!topo && (topo === o || o.contains(topo)); });
      if (!capa) break;
      await page.evaluate(() => document.getElementById('openBtn').click()); await page.waitForTimeout(1800);
    }
    for (let i = 0; i < 6; i++) { await page.keyboard.press('ArrowRight'); await page.waitForTimeout(250); }
    await page.waitForTimeout(900); // o widget reavalia a posição ~300 ms depois da última mudança
    return { ctx, page };
  }

  const resultados = [];
  async function medirObra(id, nome, vp, mobile) {
    let tent = 0;
    for (;;) {
      try {
        const { ctx, page } = await abrir(id, vp, mobile);
        const m = await page.evaluate(medir, MARGEM_TOQUE);
        if (CAPTURAR) { fs.mkdirSync(path.join(SAIDA, 'capturas'), { recursive: true }); await page.screenshot({ path: path.join(SAIDA, 'capturas', `${ROTULO}-${id}-${nome}.png`) }); }
        await ctx.close();
        const falhas = []; const avisos = []; let fracaoTexto = null;
        if (!m.toggle) falhas.push('S5 sem botão Livro-Vivo'); else {
          if (m.nWidgets !== 1) falhas.push(`S5 ${m.nWidgets} widgets`);
          if (m.toggle.left < 0 || m.toggle.top < 0 || m.toggle.right > m.vw || m.toggle.bottom > m.vh) falhas.push('S5 botão fora da tela');
          const s1 = m.ctrl.filter((c) => toca(m.toggle, c, MARGEM_TOQUE)).map((c) => `${c.id}@${Math.round(c.left)},${Math.round(c.top)},${Math.round(c.right)},${Math.round(c.bottom)} (botão ${Math.round(m.toggle.left)},${Math.round(m.toggle.top)},${Math.round(m.toggle.right)},${Math.round(m.toggle.bottom)})`); if (s1.length) falhas.push(`S1 Livro-Vivo a <${MARGEM_TOQUE}px de: ${s1.join(' | ')}`);
          if (m.pdf && toca(m.toggle, m.pdf, MARGEM_TOQUE)) falhas.push('S3 Livro-Vivo encosta no "Baixar PDF"');
          if (mobile && m.toggle.bottom > m.vh * 0.7) avisos.push(`S6 botão no terço de baixo da tela (top ${Math.round(m.toggle.top)}/${m.vh})`);
          if (mobile) {
            // fração do botão coberta por linhas de texto: até 30% = aviso (leitor de página-cheia, sem posição sem texto a 16 px dos controles); acima = falha
            const t = m.toggle; const areaBotao = (t.right - t.left) * (t.bottom - t.top);
            const cobre = m.linhas.reduce((acc, l) => { const w = Math.min(t.right, l.right) - Math.max(t.left, l.left); const h = Math.min(t.bottom, l.bottom) - Math.max(t.top, l.top); return acc + (w > 0 && h > 0 ? w * h : 0); }, 0);
            fracaoTexto = cobre / areaBotao;
            if (id === 'entre-o-encanto-e-a-escolha' && fracaoTexto > 0.02) falhas.push(`S4 Livro-Vivo cobre ${Math.round(fracaoTexto * 100)}% de texto em Entre o Encanto (tolerância 0)`); else if (fracaoTexto > 0.3) falhas.push(`S4 Livro-Vivo cobre ${Math.round(fracaoTexto * 100)}% de texto`); else if (fracaoTexto > 0.02) avisos.push(`S4 ${Math.round(fracaoTexto * 100)}% do botão sobre texto (sem posição melhor a 16 px dos controles)`);
          }
        }
        if (m.pdf) { const s2 = m.ctrl.filter((c) => toca(m.pdf, c, MARGEM_TOQUE)).map((c) => `${c.id}@${Math.round(c.left)},${Math.round(c.top)},${Math.round(c.right)},${Math.round(c.bottom)} (pdf ${Math.round(m.pdf.left)},${Math.round(m.pdf.top)},${Math.round(m.pdf.right)},${Math.round(m.pdf.bottom)})`); if (s2.length) falhas.push(`S2 "Baixar PDF" a <${MARGEM_TOQUE}px de: ${s2.join(' | ')}`); }
        return { id, tamanho: nome, temPdfFlutuante: !!m.pdf, toggle: m.toggle, pdf: m.pdf, nControles: m.ctrl.length, nLinhasTexto: m.linhas.length, fracaoTexto, avisos, falhas };
      } catch (e) { if (++tent >= 2) return { id, tamanho: nome, erro: e.message.split('\n')[0], falhas: ['ERRO ' + e.message.split('\n')[0]] }; }
    }
  }

  const CELULARES = [[360, 800], [390, 844], [412, 915], [430, 932]];
  const tarefas = []; for (const id of OBRAS) { for (const [w, h] of CELULARES) tarefas.push([id, String(w), { width: w, height: h }, true]); tarefas.push([id, '1366', { width: 1366, height: 800 }, false]); }
  let i = 0; let feitos = 0;
  await Promise.all(Array.from({ length: PARALELO }, async () => { while (i < tarefas.length) { const t = tarefas[i++]; const r = await medirObra(...t); resultados.push(r); if (++feitos % 10 === 0) process.stdout.write(`  ${feitos}/${tarefas.length}\n`); } }));
  await browser.close(); srv.close();

  resultados.sort((a, b) => a.id.localeCompare(b.id) || a.tamanho.localeCompare(b.tamanho));
  fs.writeFileSync(path.join(SAIDA, `medicao_${ROTULO}.json`), JSON.stringify(resultados, null, 1));
  const ruins = resultados.filter((r) => r.falhas.length);
  const porTipo = {}; ruins.forEach((r) => r.falhas.forEach((f) => { const k = f.split(' ')[0]; (porTipo[k] = porTipo[k] || new Set()).add(`${r.id}@${r.tamanho}`); }));
  console.log(`\nObras: ${OBRAS.length} · medições: ${resultados.length} · com PDF flutuante: ${new Set(resultados.filter((r) => r.temPdfFlutuante).map((r) => r.id)).size} obras`);
  for (const [k, v] of Object.entries(porTipo).sort()) console.log(`  ${k}: ${v.size} medições`);
  for (const r of ruins) console.log(`  ✗ ${r.id} @${r.tamanho}: ${r.falhas.join(' ;; ')}`);
  const comAviso = resultados.filter((r) => !r.falhas.length && r.avisos && r.avisos.length);
  for (const r of comAviso) console.log(`  ~ ${r.id} @${r.tamanho}: ${r.avisos.join(' ;; ')}`);
  console.log(`\n${resultados.length - ruins.length}/${resultados.length} medições sem sobreposição com controles (${comAviso.length} com aviso de texto)`);
  process.exit(ruins.length ? 1 : 0);
})().catch((e) => { console.error('ERRO', e); process.exit(1); });
